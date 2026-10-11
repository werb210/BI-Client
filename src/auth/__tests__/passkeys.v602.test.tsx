// BI_CLIENT_BLOCK_v602 - browser passkeys: WebAuthn binary fields are converted
// both ways, the returned session is stored, native apps never offer it, and
// the sign-in page and the account bar expose it.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// passkeysSupported is decided when the module loads, so the browser must
// look WebAuthn-capable before any import runs.
const webauthn = vi.hoisted(() => {
  const credentials = { get: vi.fn(), create: vi.fn() };
  const hadPkc = "PublicKeyCredential" in window;
  const originalCredentials = Object.getOwnPropertyDescriptor(navigator, "credentials");
  Object.defineProperty(window, "PublicKeyCredential", { configurable: true, writable: true, value: function PublicKeyCredential() {} });
  Object.defineProperty(navigator, "credentials", { configurable: true, value: credentials });
  return { credentials, hadPkc, originalCredentials };
});
const post = vi.hoisted(() => vi.fn());
const signedInDestination = vi.hoisted(() => vi.fn(async () => "/home"));

vi.mock("@/api/client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  api: { get: vi.fn(), post },
}));
vi.mock("@/auth/signedInDestination", () => ({ signedInDestination }));

import { PasskeyError, passkeysSupported, signInWithPasskey } from "@/auth/passkeys";
import { APPLICANT_TOKEN_KEY, expireSession, getCachedToken, getPhone } from "@/auth/token";
import SignInPage from "@/pages/SignInPage";
import AccountBar from "@/components/AccountBar";

afterAll(() => {
  if (!webauthn.hadPkc) delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  if (webauthn.originalCredentials) Object.defineProperty(navigator, "credentials", webauthn.originalCredentials);
  else delete (navigator as { credentials?: unknown }).credentials;
});

const bytes = (...values: number[]) => new Uint8Array(values).buffer;
const asArray = (value: unknown) => Array.from(new Uint8Array(value as ArrayBuffer));

function assertion() {
  return {
    id: "cred-1",
    rawId: bytes(0xfb, 0xff, 0xfe),
    type: "public-key",
    response: {
      authenticatorData: bytes(0xfb, 0xff, 0xbf),
      clientDataJSON: bytes(0x7b, 0x7d),
      signature: bytes(1, 2, 3, 4),
      userHandle: bytes(0xff),
    },
  };
}

function signInServer(result: unknown = { token: "passkey-jwt", phone: "+17805551212" }) {
  post.mockImplementation(async (path: string) => {
    if (path === "/applicants/passkeys/authentication-options") {
      return { challenge: "AQID", rpId: "boreal.test", allowCredentials: [{ id: "-_8", type: "public-key", transports: ["internal"] }] };
    }
    if (path === "/applicants/passkeys/authenticate") return result;
    throw new Error(`unexpected POST ${path}`);
  });
}

beforeEach(async () => {
  await expireSession();
  localStorage.clear();
  post.mockReset();
  webauthn.credentials.get.mockReset();
  webauthn.credentials.create.mockReset();
  signedInDestination.mockClear();
});

describe("browser passkeys v602", () => {
  it("converts WebAuthn binary fields and stores the returned applicant session", async () => {
    signInServer();
    webauthn.credentials.get.mockResolvedValue(assertion());
    expect(passkeysSupported).toBe(true);

    await signInWithPasskey();

    expect(webauthn.credentials.get).toHaveBeenCalledTimes(1);
    const { publicKey } = webauthn.credentials.get.mock.calls[0][0];
    expect(asArray(publicKey.challenge)).toEqual([1, 2, 3]);
    expect(publicKey.rpId).toBe("boreal.test");
    expect(asArray(publicKey.allowCredentials[0].id)).toEqual([0xfb, 0xff]);
    expect(publicKey.allowCredentials[0].type).toBe("public-key");

    expect(post).toHaveBeenCalledWith("/applicants/passkeys/authenticate", {
      id: "cred-1",
      rawId: "-__-",
      type: "public-key",
      response: { authenticatorData: "-_-_", clientDataJSON: "e30", signature: "AQIDBA", userHandle: "_w" },
    });
    expect(getCachedToken()).toBe("passkey-jwt");
    expect(localStorage.getItem(APPLICANT_TOKEN_KEY)).toBe("passkey-jwt");
    expect(await getPhone()).toBe("+17805551212");
  });

  it("stores nothing when the browser prompt is cancelled or the server sends no session", async () => {
    signInServer();
    webauthn.credentials.get.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    await expect(signInWithPasskey()).rejects.toMatchObject({ name: "PasskeyError", code: "cancelled" });
    expect(post).not.toHaveBeenCalledWith("/applicants/passkeys/authenticate", expect.anything());

    signInServer({});
    webauthn.credentials.get.mockResolvedValueOnce(assertion());
    await expect(signInWithPasskey()).rejects.toBeInstanceOf(PasskeyError);
    expect(getCachedToken()).toBeNull();
  });

  it("keeps browser passkeys out of the native app", async () => {
    vi.resetModules();
    vi.doMock("@capacitor/core", async (importOriginal) => {
      const original = await importOriginal<typeof import("@/test-capacitor-mock")>();
      return { ...original, Capacitor: { ...original.Capacitor, isNativePlatform: () => true, getPlatform: () => "ios" } };
    });
    try {
      const native = await import("@/auth/passkeys");
      // WebAuthn is present in this window, but the app build still says no.
      expect(native.passkeysSupported).toBe(false);
      await expect(native.signInWithPasskey()).rejects.toMatchObject({ code: "unsupported" });
      await expect(native.createPasskey()).rejects.toMatchObject({ code: "unsupported" });
      expect(post).not.toHaveBeenCalled();
      expect(webauthn.credentials.get).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("@capacitor/core");
      vi.resetModules();
    }
  });

  it("wires passkey sign-in into the sign-in page", async () => {
    signInServer();
    webauthn.credentials.get.mockResolvedValue(assertion());
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<SignInPage />} />
          <Route path="/home" element={<h1>Home screen</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    const button = screen.getByTestId("passkey-sign-in");
    expect(button.textContent).toBe("Sign in with a passkey");
    fireEvent.click(button);
    expect(await screen.findByRole("heading", { name: "Home screen" })).toBeTruthy();
    expect(getCachedToken()).toBe("passkey-jwt");
    expect(signedInDestination).toHaveBeenCalled();
  });

  it("shows the passkey error on the sign-in page and stays there", async () => {
    signInServer();
    webauthn.credentials.get.mockRejectedValue(new DOMException("aborted", "AbortError"));
    render(
      <MemoryRouter initialEntries={["/"]}>
        <SignInPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("passkey-sign-in"));
    expect(await screen.findByText("Passkey sign-in was cancelled.")).toBeTruthy();
    expect(signedInDestination).not.toHaveBeenCalled();
  });

  it("wires passkey enrollment into the account bar", async () => {
    post.mockImplementation(async (path: string) => {
      if (path === "/applicants/passkeys/registration-options") {
        return { challenge: "AQID", rp: { name: "Boreal" }, user: { id: "_w", name: "applicant", displayName: "Applicant" }, pubKeyCredParams: [] };
      }
      if (path === "/applicants/passkeys/register") return { ok: true };
      throw new Error(`unexpected POST ${path}`);
    });
    webauthn.credentials.create.mockResolvedValue({
      id: "new-cred",
      rawId: bytes(9),
      type: "public-key",
      response: { attestationObject: bytes(0xfb, 0xff), clientDataJSON: bytes(0x7b, 0x7d), getTransports: () => ["internal"] },
    });
    render(
      <MemoryRouter>
        <AccountBar />
      </MemoryRouter>,
    );
    const setting = screen.getByTestId("passkey-sign-in-setting");
    expect(screen.getByTestId("account-bar").contains(setting)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Create a passkey" }));
    expect(await screen.findByText("Ready")).toBeTruthy();

    const { publicKey } = webauthn.credentials.create.mock.calls[0][0];
    expect(asArray(publicKey.challenge)).toEqual([1, 2, 3]);
    expect(asArray(publicKey.user.id)).toEqual([0xff]);
    expect(post).toHaveBeenCalledWith("/applicants/passkeys/register", {
      id: "new-cred",
      rawId: "CQ",
      type: "public-key",
      response: { attestationObject: "-_8", clientDataJSON: "e30", transports: ["internal"] },
    });
  });
});

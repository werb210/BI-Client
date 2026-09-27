// BI_CLIENT_BLOCK_v602 - browser passkey registration and authentication.
import { Capacitor } from "@capacitor/core";
import { api } from "@/api/client";
import { setPhone, setToken } from "@/auth/token";

export class PasskeyError extends Error {
  constructor(message: string, readonly code = "passkey_failed") {
    super(message);
    this.name = "PasskeyError";
  }
}

const decode = (value: string): ArrayBuffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
  return bytes.buffer;
};

const encode = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const passkeysSupported = !Capacitor.isNativePlatform()
  && typeof window !== "undefined"
  && typeof window.PublicKeyCredential !== "undefined"
  && typeof navigator?.credentials?.get === "function";

function authenticationOptions(value: PublicKeyCredentialRequestOptionsJSON): PublicKeyCredentialRequestOptions {
  return {
    ...value,
    challenge: decode(value.challenge),
    allowCredentials: value.allowCredentials?.map((item) => ({ ...item, id: decode(item.id), type: "public-key" as const, transports: item.transports as AuthenticatorTransport[] | undefined })),
  } as unknown as PublicKeyCredentialRequestOptions;
}

function registrationOptions(value: PublicKeyCredentialCreationOptionsJSON): PublicKeyCredentialCreationOptions {
  return {
    ...value,
    challenge: decode(value.challenge),
    user: { ...value.user, id: decode(value.user.id) },
    excludeCredentials: value.excludeCredentials?.map((item) => ({ ...item, id: decode(item.id), type: "public-key" as const, transports: item.transports as AuthenticatorTransport[] | undefined })),
  } as unknown as PublicKeyCredentialCreationOptions;
}

function assertionJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: encode(response.authenticatorData),
      clientDataJSON: encode(response.clientDataJSON),
      signature: encode(response.signature),
      userHandle: response.userHandle ? encode(response.userHandle) : null,
    },
  };
}

function attestationJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: encode(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: encode(response.attestationObject),
      clientDataJSON: encode(response.clientDataJSON),
      transports: response.getTransports?.() ?? [],
    },
  };
}

function ensureSupported(): void {
  if (!passkeysSupported) throw new PasskeyError("Passkeys are not available in this browser.", "unsupported");
}

export async function signInWithPasskey(): Promise<void> {
  ensureSupported();
  try {
    const options = await api.post<PublicKeyCredentialRequestOptionsJSON>("/applicants/passkeys/authentication-options");
    const credential = await navigator.credentials.get({ publicKey: authenticationOptions(options) }) as PublicKeyCredential | null;
    if (!credential) throw new PasskeyError("Passkey sign-in was cancelled.", "cancelled");
    const result = await api.post<{ token: string; phone?: string }>("/applicants/passkeys/authenticate", assertionJSON(credential));
    if (!result?.token) throw new PasskeyError("Boreal did not return a sign-in session.");
    await setToken(result.token);
    if (result.phone) await setPhone(result.phone);
  } catch (error) {
    if (error instanceof PasskeyError) throw error;
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
      throw new PasskeyError("Passkey sign-in was cancelled.", "cancelled");
    }
    throw new PasskeyError("Passkey sign-in didn't work. Sign in with a text code instead.");
  }
}

export async function createPasskey(): Promise<void> {
  ensureSupported();
  try {
    const options = await api.post<PublicKeyCredentialCreationOptionsJSON>("/applicants/passkeys/registration-options");
    const credential = await navigator.credentials.create({ publicKey: registrationOptions(options) }) as PublicKeyCredential | null;
    if (!credential) throw new PasskeyError("Passkey setup was cancelled.", "cancelled");
    await api.post("/applicants/passkeys/register", attestationJSON(credential));
  } catch (error) {
    if (error instanceof PasskeyError) throw error;
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "AbortError")) {
      throw new PasskeyError("Passkey setup was cancelled.", "cancelled");
    }
    throw new PasskeyError("Boreal could not create a passkey. Try again.");
  }
}

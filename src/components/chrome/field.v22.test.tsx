// BI_CLIENT_FIELD_v22 - the sign-in field was ~44px where every later field
// was 56, so the first control a user touches did not match the rest.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderLoadedPage, stubApi } from "@/test-utils/chrome-pages";
import { backgroundOf, colorOf, declared, rgb, stateRules } from "@/test-utils/chrome-dom";

beforeEach(() => { stubApi(); });
afterEach(() => { vi.unstubAllGlobals(); });

const css = (el: Element) => getComputedStyle(el);
const RING = "0 0 0 3px rgba(191, 155, 73, 0.45)";

describe("one field treatment", () => {
  it("honours the locked 56px mobile touch target", () => {
    render(<input className="bi-field" aria-label="f" />);
    const field = screen.getByLabelText("f");
    expect(css(field).minHeight).toBe("56px");
    expect(css(field).borderRadius).toBe("8px");
    expect(css(field).fontSize).toBe("16px");
  });

  it("rings gold on focus, like every other property", () => {
    render(<><input className="bi-field" aria-label="a" /><input className="bi-field" aria-label="b" /></>);
    const [a, b] = [screen.getByLabelText("a"), screen.getByLabelText("b")];
    a.focus();
    expect(document.activeElement).toBe(a);
    // jsdom caches an element's computed style, so each field is read once:
    // the focused one rings gold, the one at rest does not.
    expect(css(a).boxShadow).toBe(RING);
    expect(css(b).boxShadow).toBe("");
    const focused = stateRules(b, "focus");
    expect(declared(focused, "box-shadow")).toBe(RING);
    expect(declared(focused, "border-color")).toBe("#BF9B49");
    expect(declared(focused, "outline")).toBe("none");
  });

  it("handles textarea, which cannot use a fixed height", () => {
    render(<textarea className="bi-field" aria-label="t" />);
    const area = screen.getByLabelText("t");
    expect(css(area).minHeight).toBe("96px");
    expect(css(area).paddingTop).toBe("14px");
    expect(css(area).lineHeight).toBe("1.5");
  });
});

describe("both pages use it", () => {
  it("sign-in no longer defines a shorter field", async () => {
    await renderLoadedPage("SignInPage");
    const phone = screen.getByLabelText("Mobile number");
    expect(phone.classList.contains("bi-field")).toBe(true);
    expect(phone.style.padding).toBe("");
    expect(css(phone).paddingTop).toBe("0px");
    expect(css(phone).paddingLeft).toBe("14px");
    expect(css(phone).minHeight).toBe("56px");
  });

  it("the sign-in code field, after a code is sent, is the same field", async () => {
    const fetchMock = stubApi();
    await renderLoadedPage("SignInPage");
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "4165550123" } });
    const code = await screen.findByLabelText("6-digit code");
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/applicants/otp/start"))).toBe(true);
    expect(code.classList.contains("bi-field")).toBe(true);
    expect(code.style.padding).toBe("");
    expect(css(code).minHeight).toBe("56px");
  });

  it("start keeps its behaviour and gains the ring", async () => {
    const { container } = await renderLoadedPage("StartPage");
    const fields = Array.from(container.querySelectorAll("input, select"));
    expect(fields.map((f) => f.id)).toEqual(["industry", "businessName", "applicantName", "email", "country"]);
    for (const f of fields) {
      // nothing inline: the whole treatment comes from .bi-field
      expect(f.classList.contains("bi-field")).toBe(true);
      expect(f.getAttribute("style") ?? "").toBe("");
      expect(css(f).minHeight).toBe("56px");
    }
    const name = screen.getByLabelText("Business name");
    name.focus();
    expect(name.matches(".bi-field:focus")).toBe(true);
    expect(declared(stateRules(name, "focus"), "box-shadow")).toBe(RING);
    // the CTA keeps its own 56px, which is a button height, not a field height
    expect(css(screen.getByRole("button", { name: "Continue" })).minHeight).toBe("56px");
  });

  it("the read-only phone field matches too", async () => {
    await renderLoadedPage("StartPage");
    const label = screen.getByText("Mobile");
    const phone = label.nextElementSibling as HTMLElement;
    expect(phone.classList.contains("bi-field")).toBe(true);
    expect(css(phone).minHeight).toBe("56px");
    expect(css(phone).borderRadius).toBe("8px");
    expect(backgroundOf(phone)).toBe(rgb("#f1f5f9"));
    expect(colorOf(phone)).toBe(rgb("#51617D"));
    expect(phone.style.lineHeight).toBe("56px");
  });
});

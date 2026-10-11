// Test harness for the "pages1" behaviour tests: a fetch stub that answers the
// bi-server routes a page calls, and helpers that render a page (or the whole
// router) inside a MemoryRouter with a probe that exposes the current location.
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { expect, vi } from "vitest";
import { ENV } from "@/env";
import AppRouter from "@/router/AppRouter";
import { restoreToken, setToken } from "@/auth/token";
import type { Question } from "@/api/questions";

export type ApiCall = { method: string; path: string; url: string; body: unknown };
export type Reply = { status: number; body: unknown };
export type Handler = unknown | ((call: ApiCall) => Reply | unknown | Promise<Reply | unknown>);

const REPLY = Symbol("pages1-reply");
/** A non-200 answer (or an explicit status) for a stubbed route. */
export function reply(status: number, body: unknown = {}): Reply {
  return Object.assign({ status, body }, { [REPLY]: true });
}
const isReply = (v: unknown): v is Reply => !!v && typeof v === "object" && REPLY in (v as object);

/**
 * Stub global fetch. Keys are "METHOD /path?query" (the path after the API
 * prefix). A value is the JSON body to return with 200, a reply(status, body),
 * or a function of the call returning either. Unknown routes answer 404.
 */
export function stubApi(routes: Record<string, Handler>) {
  const calls: ApiCall[] = [];
  const prefix = `${ENV.API_BASE}${ENV.API_PREFIX}`;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    const path = url.startsWith(prefix) ? url.slice(prefix.length) : url;
    const method = String(init.method ?? "GET").toUpperCase();
    let body: unknown = init.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { /* keep the raw string */ }
    }
    const call: ApiCall = { method, path, url, body };
    calls.push(call);
    const key = `${method} ${path}`;
    let out: unknown = key in routes ? routes[key] : reply(404, { error: "not_found" });
    if (typeof out === "function") out = await (out as (c: ApiCall) => unknown)(call);
    const r = isReply(out) ? out : { status: 200, body: out };
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    fetchMock,
    /** Every call made to "METHOD /path". */
    to: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path),
  };
}

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="pages1-location">{loc.pathname + loc.search}</output>;
}

/** The pathname (plus query) the router is on right now. */
export function currentLocation(): string {
  return screen.getByTestId("pages1-location").textContent ?? "";
}

export async function expectLocation(path: string) {
  await waitFor(() => {
    if (currentLocation() !== path) throw new Error(`location is ${currentLocation()}, expected ${path}`);
  });
}

/**
 * Render one page at `url`, matched by `routePath` so useParams works.
 * `history` entries are pushed before `url`, so navigate(-1) has somewhere to go.
 */
export function renderPage(page: ReactElement, opts: { routePath: string; url: string; history?: string[] }) {
  return render(
    <MemoryRouter initialEntries={[...(opts.history ?? []), opts.url]} initialIndex={(opts.history ?? []).length}>
      <Routes>
        <Route path={opts.routePath} element={page} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

/** Sign an applicant in (web storage) or out, as the router guard sees it. */
export async function signIn(signedIn: boolean) {
  if (signedIn) {
    await setToken("pages1-test-token");
  } else {
    localStorage.removeItem("boreal_bi_applicant_token");
    await restoreToken();
  }
}

/** Render the real AppRouter at `url`. */
export function renderApp(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AppRouter />
      <LocationProbe />
    </MemoryRouter>,
  );
}

/**
 * Check `url` is guarded: signed in it shows the account bar and `marker`;
 * signed out it bounces to "/" and `marker` never appears.
 */
export async function expectGuardedRoute(url: string, marker: string | RegExp) {
  await signIn(true);
  const first = renderApp(url);
  await screen.findByText(marker);
  expect(screen.getByTestId("account-bar")).toBeTruthy();
  expect(currentLocation()).toBe(url);
  first.unmount();

  await signIn(false);
  const second = renderApp(url);
  await expectLocation("/");
  expect(screen.queryByText(marker)).toBeNull();
  expect(screen.queryByTestId("account-bar")).toBeNull();
  second.unmount();
}

/** A question as bi-server sends it, with every field defaulted. */
export function question(over: Partial<Question> & { questionKey: string }): Question {
  return {
    prompt: `Prompt for ${over.questionKey}`,
    helpText: null,
    inputType: "yes_no",
    group: "general",
    adverseAnswer: null,
    required: true,
    dependsOnKey: null,
    dependsOnValue: null,
    sortOrder: 0,
    askedBy: [],
    value: null,
    reason: null,
    options: null,
    minValue: null,
    maxValue: null,
    placeholder: null,
    ...over,
  };
}

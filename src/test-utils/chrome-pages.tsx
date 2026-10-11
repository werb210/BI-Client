// Renders the applicant pages for the chrome behaviour tests, against a fake
// bi-server. Every page talks to the server through apiRequest -> fetch, so
// stubbing fetch exercises the real api modules; each test can override a
// route (or hold it pending to see a loading state).
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import CoveragePage from "@/pages/CoveragePage";
import HomePage from "@/pages/HomePage";
import QuestionsPage from "@/pages/QuestionsPage";
import RequirementsPage from "@/pages/RequirementsPage";
import ReviewPage from "@/pages/ReviewPage";
import SignInPage from "@/pages/SignInPage";
import StartPage from "@/pages/StartPage";
import UploadContractPage from "@/pages/UploadContractPage";
import "./chrome-dom";

export const APP_ID = "app-1";

const product = (code: string, display_name: string, sort_order: number) => ({
  code, display_name, carrier: "Carrier", coverage_category: "liability", description: `${display_name} cover`, sort_order,
});

const question = (q: Record<string, unknown>) => ({
  helpText: null, adverseAnswer: null, required: true, dependsOnKey: null, dependsOnValue: null,
  askedBy: [], value: null, reason: null, options: null, minValue: null, maxValue: null, placeholder: null,
  ...q,
});

export const FIXTURES = {
  selection: {
    applicationId: APP_ID, country: "CA",
    selected: [{ ...product("pgi", "Personal Guarantee Insurance", 1), source: "contract" }],
  },
  products: {
    country: "CA", kind: "categories",
    products: [product("pgi", "Personal Guarantee Insurance", 1), product("cgl", "Commercial General Liability", 2)],
  },
  questions: {
    applicationId: APP_ID, country: "CA",
    questions: [
      question({ questionKey: "full_name", prompt: "Your full legal name", inputType: "text", group: "guarantor", sortOrder: 1 }),
      question({ questionKey: "province", prompt: "Province of residence", inputType: "select", group: "guarantor", sortOrder: 2, options: ["Ontario", "Alberta"] }),
      question({ questionKey: "bankrupt", prompt: "Have you ever been bankrupt?", inputType: "yes_no", group: "declarations", sortOrder: 3, adverseAnswer: "yes" }),
    ],
  },
  summary: {
    applicationId: APP_ID, status: "in_progress", country: "CA",
    businessName: "Acme Framing Ltd", applicantName: "Pat Doe", email: "pat@example.com",
    coverages: [{ code: "pgi", display_name: "Personal Guarantee Insurance", source: "contract" }],
    documents: [], answered: 12, outstanding: [], referrals: [], canSubmit: true,
  },
  requirements: {
    requirements: [{
      id: "r1", coverageCode: "cgl", displayName: "Commercial General Liability", extractedLimit: 2000000,
      limitBasis: "per occurrence", clauseText: "The Subcontractor shall carry CGL of not less than $2,000,000.",
      confidence: 0.9, confirmedByClient: null, available: true,
    }],
  },
  actionCenter: { outstanding: [], completed: [], outstandingCount: 0, canSubmit: false },
  progress: { progress: null },
  unread: { unreadCount: 0 },
  industries: { industries: [{ code: "construction", display_name: "Construction", wants_contract: true }] },
};

/** A route answer: a JSON body, or { status, body }, or PENDING to never answer. */
export const PENDING = Symbol("pending");
type Answer = unknown;
export type ApiRoutes = Array<[method: string, path: RegExp, answer: Answer]>;

const DEFAULT_ROUTES: ApiRoutes = [
  ["GET", /^\/applicants\/applications\/[^/]+\/products$/, FIXTURES.selection],
  ["GET", /^\/applicants\/products\?/, FIXTURES.products],
  ["GET", /^\/applicants\/applications\/[^/]+\/questions$/, FIXTURES.questions],
  ["GET", /^\/applicants\/applications\/[^/]+\/summary$/, FIXTURES.summary],
  ["GET", /^\/applicants\/applications\/[^/]+\/requirements$/, FIXTURES.requirements],
  ["GET", /^\/applicants\/action-center\//, FIXTURES.actionCenter],
  ["GET", /^\/applicants\/me\/progress$/, FIXTURES.progress],
  ["GET", /^\/applicants\/messages\/unread-count$/, FIXTURES.unread],
  ["GET", /^\/applicants\/industries$/, FIXTURES.industries],
  ["POST", /.*/, {}],
];

/**
 * Replaces global fetch with a fake bi-server. `overrides` are tried first.
 * Returns the mock so a test can assert on the calls.
 */
export function stubApi(overrides: ApiRoutes = []) {
  const routes = [...overrides, ...DEFAULT_ROUTES];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.slice(url.indexOf("/api/v1") + "/api/v1".length);
    const method = String(init?.method ?? "GET").toUpperCase();
    const hit = routes.find(([m, re]) => m === method && re.test(path));
    if (hit && hit[2] === PENDING) return new Promise<never>(() => undefined);
    const answer = hit ? hit[2] : { status: 404, body: { error: "not_found" } };
    const shaped = answer && typeof answer === "object" && "status" in (answer as object) && "body" in (answer as object)
      ? answer as { status: number; body: unknown }
      : { status: 200, body: answer };
    return Promise.resolve({
      status: shaped.status,
      ok: shaped.status >= 200 && shaped.status < 300,
      text: async () => JSON.stringify(shaped.body),
    } as unknown as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export type PageName =
  | "CoveragePage" | "HomePage" | "QuestionsPage" | "RequirementsPage"
  | "ReviewPage" | "SignInPage" | "StartPage" | "UploadContractPage";

export const PAGE_NAMES: PageName[] = [
  "CoveragePage", "HomePage", "QuestionsPage", "RequirementsPage",
  "ReviewPage", "SignInPage", "StartPage", "UploadContractPage",
];

const PAGES: Record<PageName, { path: string; url: string; element: ReactElement; ready: string }> = {
  CoveragePage: { path: "/coverage/:applicationId", url: `/coverage/${APP_ID}`, element: <CoveragePage />, ready: "What do you need covered?" },
  HomePage: { path: "/home", url: "/home", element: <HomePage />, ready: "You are signed in" },
  QuestionsPage: { path: "/questions/:applicationId", url: `/questions/${APP_ID}`, element: <QuestionsPage />, ready: "About you" },
  RequirementsPage: { path: "/requirements/:applicationId", url: `/requirements/${APP_ID}`, element: <RequirementsPage />, ready: "What your contract asks for" },
  ReviewPage: { path: "/review/:applicationId", url: `/review/${APP_ID}`, element: <ReviewPage />, ready: "Check this over" },
  SignInPage: { path: "/", url: "/", element: <SignInPage />, ready: "Boreal Risk Management" },
  StartPage: { path: "/start", url: "/start", element: <StartPage />, ready: "Tell us who you are" },
  UploadContractPage: { path: "/upload", url: "/upload", element: <UploadContractPage />, ready: "Upload your subcontract" },
};

function Elsewhere() {
  const location = useLocation();
  return <div data-testid="navigated-to">{location.pathname}</div>;
}

/** Renders a page at its route without waiting for it to load. */
export function renderPage(name: PageName) {
  const page = PAGES[name];
  return render(
    <MemoryRouter initialEntries={[page.url]}>
      <Routes>
        <Route path={page.path} element={page.element} />
        <Route path="*" element={<Elsewhere />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Renders a page and waits until its main view has loaded. */
export async function renderLoadedPage(name: PageName) {
  const result = renderPage(name);
  await screen.findByRole("heading", { name: PAGES[name].ready });
  return result;
}

/** Every button, input, select and textarea the page rendered. */
export function controls(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, input, select, textarea"));
}

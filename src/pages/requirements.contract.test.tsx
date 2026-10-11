// BI_CLIENT_CONTRACT_UPLOAD_v1 - behaviour tests for the contract upload and
// the requirements it produces.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import RequirementsPage from "@/pages/RequirementsPage";
import UploadContractPage from "@/pages/UploadContractPage";
import type { Requirement } from "@/api/contract";
import { expectGuardedRoute, expectLocation, renderPage, reply, stubApi } from "@/test-utils/pages1-harness";

const HOST = "https://bi-server-cse0apamgkheb9d5.canadacentral-01.azurewebsites.net";
const BASE = "/applicants/applications/app-1";

function requirement(over: Partial<Requirement> & { id: string; coverageCode: string; displayName: string }): Requirement {
  return { extractedLimit: 2000000, limitBasis: "per occurrence", clauseText: "x", confidence: 0.9, confirmedByClient: null, ...over };
}
const CGL = requirement({
  id: "r1", coverageCode: "cgl", displayName: "Commercial General Liability",
  clauseText: "Subcontractor shall maintain CGL of not less than $2,000,000 per occurrence.",
});

function stubRequirements(requirements: Requirement[]) {
  return stubApi({
    [`GET ${BASE}/requirements`]: { requirements },
    [`GET ${BASE}/products`]: { applicationId: "app-1", country: "CA", selected: [] },
    [`POST ${BASE}/requirements/r1/confirm`]: { ok: true },
  });
}
const renderRequirements = () => renderPage(<RequirementsPage />, { routePath: "/requirements/:applicationId", url: "/requirements/app-1" });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("BI_CLIENT_CONTRACT_UPLOAD_v1", () => {
  it("points at the bi-server host that actually resolves", async () => {
    vi.stubEnv("VITE_API_BASE", "");
    vi.resetModules();
    const { ENV } = await import("@/env");
    expect(ENV.API_BASE).toBe(HOST);
    expect(ENV.API_BASE).not.toBe("https://bi-server.azurewebsites.net");
    // And requests really go there.
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ requirements: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getRequirements: freshGetRequirements } = await import("@/api/contract");
    await freshGetRequirements("app-1");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(`${HOST}/api/v1${BASE}/requirements`);
  });

  it("quotes the clause it read, so the applicant can check it", async () => {
    stubRequirements([CGL]);
    renderRequirements();
    const card = await screen.findByTestId("requirement-cgl");
    expect(card.textContent).toContain("\u201cSubcontractor shall maintain CGL of not less than $2,000,000 per occurrence.\u201d");
  });

  it("asks the applicant to confirm rather than asserting", async () => {
    const api = stubRequirements([CGL]);
    const first = renderRequirements();
    await screen.findByTestId("requirement-cgl");
    expect(screen.getByRole("button", { name: "No, that is not in my contract" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Yes, that is right" }));
    await screen.findByText("Confirmed");
    expect(api.to("POST", `${BASE}/requirements/r1/confirm`).map((c) => c.body)).toEqual([{ confirmed: true }]);
    expect(screen.queryByRole("button", { name: "Yes, that is right" })).toBeNull();
    first.unmount();
    vi.unstubAllGlobals();

    const api2 = stubRequirements([CGL]);
    renderRequirements();
    await screen.findByTestId("requirement-cgl");
    fireEvent.click(screen.getByRole("button", { name: "No, that is not in my contract" }));
    await screen.findByText("Marked as not required. We will leave it off.");
    expect(api2.to("POST", `${BASE}/requirements/r1/confirm`).map((c) => c.body)).toEqual([{ confirmed: false }]);
  });

  it("does not show a confirmation the server refused", async () => {
    stubApi({
      [`GET ${BASE}/requirements`]: { requirements: [CGL] },
      [`POST ${BASE}/requirements/r1/confirm`]: reply(500, { error: "boom" }),
    });
    renderRequirements();
    await screen.findByTestId("requirement-cgl");
    fireEvent.click(screen.getByRole("button", { name: "Yes, that is right" }));
    await screen.findByText("That did not save. Please try again.");
    expect(screen.getByRole("button", { name: "Yes, that is right" })).toBeTruthy();
  });

  it("explains an empty result instead of showing a blank screen", async () => {
    stubRequirements([]);
    renderRequirements();
    await screen.findByText("We did not find any insurance clauses");
    expect(screen.queryByTestId(/^requirement-/)).toBeNull();
  });

  describe("tells the applicant which upload failures they can act on", () => {
    const cases: Array<[string, RegExp]> = [
      ["no_text_found", /We could not read any text from that file\. If it is a scan, a clearer copy or the original PDF usually works\./],
      ["unsupported_file_type", /We can read PDF, Word and photos\. Please try one of those\./],
      ["file_too_large", /That file is over 25 MB\. Please upload a smaller copy\./],
    ];
    for (const [code, shown] of cases) {
      it(`explains ${code} from the server`, async () => {
        const api = stubApi({ "POST /applicants/contract/upload": reply(422, { error: code }) });
        renderPage(<UploadContractPage />, { routePath: "/upload", url: "/upload" });
        const file = new File(["%PDF-1.4"], "contract.pdf", { type: "application/pdf" });
        fireEvent.change(screen.getByTestId("contract-file-input"), { target: { files: [file] } });
        await screen.findByText(shown);
        expect(api.to("POST", "/applicants/contract/upload")).toHaveLength(1);
        expect(api.to("POST", "/applicants/contract/upload")[0].body).toBeInstanceOf(FormData);
      });
    }
    it("catches an unsupported file before uploading it", async () => {
      const api = stubApi({});
      renderPage(<UploadContractPage />, { routePath: "/upload", url: "/upload" });
      const file = new File(["MZ"], "setup.exe", { type: "application/octet-stream" });
      fireEvent.change(screen.getByTestId("contract-file-input"), { target: { files: [file] } });
      // The local check rejects it with the generic sentence; nothing is sent.
      await screen.findByText("That upload did not go through. Please try again.");
      expect(api.calls).toHaveLength(0);
    });
    it("goes on to the requirements once the upload is read", async () => {
      stubApi({ "POST /applicants/contract/upload": { applicationId: "app-1", documentId: "d1", requirements: [] } });
      renderPage(<UploadContractPage />, { routePath: "/upload", url: "/upload" });
      const file = new File(["%PDF-1.4"], "contract.pdf", { type: "application/pdf" });
      fireEvent.change(screen.getByTestId("contract-file-input"), { target: { files: [file] } });
      await expectLocation("/requirements/app-1");
    });
  });

  it("keeps both new screens behind the applicant guard", async () => {
    stubRequirements([CGL]);
    await expectGuardedRoute("/upload", "Upload your subcontract");
    await expectGuardedRoute("/requirements/app-1", "What your contract asks for");
  });
});

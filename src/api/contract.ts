// BI_CLIENT_CONTRACT_UPLOAD_v1
import { api, apiRequest } from "@/api/client";

export type Requirement = {
  id: string;
  coverageCode: string;
  displayName: string;
  extractedLimit: number | null;
  limitBasis: string | null;
  clauseText: string;
  confidence: number;
  confirmedByClient: boolean | null;
  // BI_CLIENT_REFERRAL_v8 - false when the contract demands a coverage we
  // cannot place in this country.
  available?: boolean;
};

export type UploadResult = {
  applicationId: string;
  documentId: string;
  requirements: Requirement[];
};

export function uploadContract(file: File): Promise<UploadResult> {
  const body = new FormData();
  body.append("file", file);
  // FormData sets its own multipart boundary; apiRequest deliberately does not
  // set Content-Type when the body is FormData, or the boundary is lost.
  return apiRequest<UploadResult>("/applicants/contract/upload", { method: "POST", body });
}

export function getRequirements(applicationId: string) {
  return api.get<{ requirements: Requirement[] }>(
    `/applicants/applications/${encodeURIComponent(applicationId)}/requirements`,
  );
}

export function confirmRequirement(applicationId: string, requirementId: string, confirmed: boolean) {
  return api.post<{ ok: boolean }>(
    `/applicants/applications/${encodeURIComponent(applicationId)}/requirements/${encodeURIComponent(requirementId)}/confirm`,
    { confirmed },
  );
}

export function formatLimit(value: number | null): string {
  if (value === null) return "no amount stated";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

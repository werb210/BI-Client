// BI_CLIENT_REVIEW_v7
import { api } from "@/api/client";

export type Coverage = { code: string; display_name: string; source: string };
export type Doc = { original_filename: string; doc_type: string };
export type Outstanding = { questionKey: string; prompt: string };

export type Summary = {
  applicationId: string;
  status: string;
  country: "CA" | "US";
  businessName: string | null;
  applicantName: string | null;
  email: string | null;
  coverages: Coverage[];
  documents: Doc[];
  answered: number;
  outstanding: Outstanding[];
  canSubmit: boolean;
  alreadySubmitted?: boolean;
};

export function getSummary(applicationId: string) {
  return api.get<Summary>(`/applicants/applications/${encodeURIComponent(applicationId)}/summary`);
}

export function submitApplication(applicationId: string) {
  return api.post<Summary>(`/applicants/applications/${encodeURIComponent(applicationId)}/submit`, {});
}

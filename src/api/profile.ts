// BI_CLIENT_STEP1_PROFILE_v3
import { api } from "@/api/client";

export type Profile = {
  businessName: string;
  applicantName: string;
  email: string;
  country: "CA" | "US";
  industry?: string;
  src?: string;
};

export type Industry = { code: string; display_name: string; wants_contract: boolean };
export type ProfileResult = { applicationId: string; phone: string; industry?: string; wantsContract?: boolean };

export function listIndustries() {
  return api.get<{ industries: Industry[] }>("/applicants/industries");
}

export function saveProfile(p: Profile) {
  return api.post<ProfileResult>("/applicants/profile", p);
}

// BI_CLIENT_STEP1_PROFILE_v3
import { api } from "@/api/client";

export type Profile = {
  businessName: string;
  applicantName: string;
  email: string;
  country: "CA" | "US";
};

export type ProfileResult = { applicationId: string; phone: string };

export function saveProfile(p: Profile) {
  return api.post<ProfileResult>("/applicants/profile", p);
}

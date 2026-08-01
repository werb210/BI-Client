// BI_CLIENT_SCAFFOLD_v1 - wired to the routes bi-server already exposes.
import { api } from "@/api/client";
import { setToken } from "@/auth/token";

export type VerifyResult = { token: string; phone: string; contactId: string | null };

// bi-server normalises to E.164 itself, but sending a bare 10-digit string
// makes it guess at the country. Normalise here so a Canadian and a US number
// are both unambiguous.
export function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return raw.trim();
}

export function startOtp(phone: string) {
  return api.post<{ ok?: boolean }>("/applicants/otp/start", { phone: toE164(phone) });
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyResult> {
  const r = await api.post<VerifyResult>("/applicants/otp/verify", {
    phone: toE164(phone),
    code: code.trim(),
  });
  if (!r?.token) throw new Error("verify_failed");
  setToken(r.token);
  return r;
}

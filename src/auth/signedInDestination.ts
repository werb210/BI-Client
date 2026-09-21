// BI_CLIENT_SIGNED_IN_DESTINATION_v368 - where a signed-in applicant lands, for
// every way in (text code, Face ID button, Face ID unlock). Both sign-ins used to
// go to /start (Step 1) even for an applicant whose application was already
// submitted, who then saw "Tell us who you are" instead of their status page.
// A notification deep link still wins; then the server's own progress decides.
import { api } from "@/api/client";
import { consumeNativeDestination } from "@/native/deepLinks";

type Progress = { steps?: Array<{ key?: string; state?: string }> } | null;

export function destinationFor(progress: Progress): "/home" | "/start" {
  // The first progress step, "Application", is done once the applicant submitted.
  return progress?.steps?.[0]?.state === "done" ? "/home" : "/start";
}

export async function signedInDestination(): Promise<string> {
  const deepLink = consumeNativeDestination();
  if (deepLink) return deepLink;
  try {
    const r = await api.get<{ progress: Progress }>("/applicants/me/progress");
    return destinationFor(r?.progress ?? null);
  } catch {
    return "/start";
  }
}

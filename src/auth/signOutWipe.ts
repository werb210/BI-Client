// BI_CLIENT_v789_SIGN_OUT_WIPE
// Signing out leaves nothing of the applicant on the phone: queued contract
// files, cached screens and unsent saves, Capacitor Preferences, the profile
// draft, the home-screen widget's snapshot and token, the app badge and any
// background send. This phone's push token is unregistered on BI-Server first,
// while the applicant's token can still authorise the call, so a signed-out
// phone stops receiving the applicant's notifications.
// The caller (clearToken in auth/token.ts) clears the sign-in token afterwards.
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { ENV } from "@/env";
import { clearQueue } from "@/upload/queue";
import { clearOfflineData } from "@/offline/offlineStore";
import { clearDraft } from "@/entry/draft";
import { clearClientWidget } from "@/native/clientWidget";
import { clearAppBadge } from "@/native/appBadge";
import { cancelBackgroundSync } from "@/native/backgroundSync";
import { devicePlatform, forgetPushDeviceToken, registeredPushDeviceToken } from "@/native/pushNotifications";
import { forgetDataKey } from "@/secure/vault";

/** BI-Server's biClientPushRoutes, under the client API base (/api/v1). */
export const UNREGISTER_PUSH_PATH = "/client/push/unregister-token";
const UNREGISTER_TIMEOUT_MS = 5000;

/** Best effort: sign-out never waits more than a few seconds on the network. */
export async function unregisterPushToken(sessionToken: string | null): Promise<boolean> {
  const platform = devicePlatform();
  if (!sessionToken || !platform || !Capacitor.isNativePlatform()) return false;
  const deviceToken = await registeredPushDeviceToken();
  const controller = typeof AbortController === "undefined" ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), UNREGISTER_TIMEOUT_MS) : null;
  try {
    // Plain fetch, not apiRequest: a 401 here must not re-enter sign-out.
    const res = await fetch(`${ENV.API_BASE}${ENV.API_PREFIX}${UNREGISTER_PUSH_PATH}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(deviceToken ? { token: deviceToken, platform } : { platform }),
      signal: controller?.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const quietly = async (step: () => unknown): Promise<void> => {
  try { await step(); } catch { /* one failed step must not keep the rest on the phone */ }
};

export async function signOutWipe(sessionToken: string | null): Promise<void> {
  await unregisterPushToken(sessionToken);
  await quietly(cancelBackgroundSync);
  await quietly(clearQueue);
  await quietly(clearOfflineData);
  await quietly(clearDraft);
  await quietly(clearClientWidget);
  await quietly(clearAppBadge);
  await quietly(forgetPushDeviceToken);
  await quietly(() => Preferences.clear());
  await quietly(forgetDataKey);
}

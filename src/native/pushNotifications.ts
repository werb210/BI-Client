import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
// BI_CLIENT_PUSH_REGISTER_v159
import { api } from "@/api/client";

export type DeviceRegistration = { token: string; platform: "ios" | "android" };

/** BI_CLIENT_PUSH_REGISTER_v159 - the server contract now exists
 * (BI_SERVER_PUSH_TOKENS_v159: POST /api/v1/client/push/register-token), so the
 * token no longer stays on the device. The adapter is kept so tests and any
 * future transport can substitute the call. */
export interface DeviceRegistrationAdapter {
  register(device: DeviceRegistration): Promise<void>;
}

/** The platform BI-Server stores. It picks APNs or FCM from this, so
 * "capacitor" or "web" must never be sent - only the two real platforms. */
export function devicePlatform(): "ios" | "android" | null {
  try {
    const platform = Capacitor.getPlatform();
    return platform === "ios" || platform === "android" ? platform : null;
  } catch {
    return null;
  }
}

export const serverRegistration: DeviceRegistrationAdapter = {
  async register(device) {
    await api.post("/client/push/register-token", device);
  },
};

type Handle = { remove: () => Promise<void> };
export async function initializePushNotifications(
  onUrl: (url: string) => void,
  adapter: DeviceRegistrationAdapter = serverRegistration,
): Promise<Handle[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const handles: Handle[] = [];
  handles.push(await PushNotifications.addListener("registration", (event: { value?: string }) => {
    // BI_CLIENT_PUSH_REGISTER_v159 - hand the token to BI-Server. Failure is
    // silent on purpose: the next launch registers again, and a push the
    // applicant never asked for must not surface an error.
    const token = String(event?.value ?? "").trim();
    const platform = devicePlatform();
    if (!token || !platform) return;
    void adapter.register({ token, platform }).catch(() => undefined);
  }));
  handles.push(await PushNotifications.addListener("registrationError", (error) => console.error("Push registration failed", error)));
  handles.push(await PushNotifications.addListener("pushNotificationReceived", () => undefined));
  handles.push(await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const url = notification.data?.url;
    if (typeof url === "string") onUrl(url);
  }));
  const permission = await PushNotifications.checkPermissions();
  if (permission.receive === "prompt") return handles; // request only from future user-facing opt-in UI
  if (permission.receive === "granted") await PushNotifications.register();
  return handles;
}

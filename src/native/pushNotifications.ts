import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

export type DeviceRegistration = { token: string; platform: "ios" | "android" };

/** BI-Server has no device-registration endpoint yet. The real token stays on
 * device until that server contract exists; callers must not invent a URL. */
export interface DeviceRegistrationAdapter {
  register(device: DeviceRegistration): Promise<void>;
}

type Handle = { remove: () => Promise<void> };
export async function initializePushNotifications(onUrl: (url: string) => void): Promise<Handle[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const handles: Handle[] = [];
  handles.push(await PushNotifications.addListener("registration", () => {
    // Intentionally no network call; see DeviceRegistrationAdapter above.
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

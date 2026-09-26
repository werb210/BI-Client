// BI_CLIENT_BLOCK_v551_APP_BADGE
// The app icon shows how many items the applicant still owes (the action
// center's outstanding count). iOS only: Android launchers badge from notifications.
import { Capacitor, registerPlugin } from "@capacitor/core";

interface AppBadgePlugin { set(options: { count: number }): Promise<void>; }
const AppBadge = registerPlugin<AppBadgePlugin>("AppBadge");

export function badgeCount(value: unknown): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 99) : 0;
}

export async function setAppBadge(count: unknown): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("AppBadge")) return;
  await AppBadge.set({ count: badgeCount(count) }).catch((): void => undefined);
}

export async function clearAppBadge(): Promise<void> {
  await setAppBadge(0);
}

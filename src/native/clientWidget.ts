// BI_CLIENT_BLOCK_v603_HOME_WIDGET
// Native-only snapshot: applicant information is never persisted by the browser.
import { Capacitor, registerPlugin } from "@capacitor/core";
export type ClientWidgetSnapshot = { stage: string; toDoCount: number };
interface ClientWidgetPlugin { update(options: ClientWidgetSnapshot): Promise<void>; clear(): Promise<void>; }
const ClientWidget = registerPlugin<ClientWidgetPlugin>("ClientWidget");
export function widgetStage(value: unknown): string {
  const stage = typeof value === "string" ? value.trim().replace(/[_-]+/g, " ") : "";
  return (stage || "Application in progress").replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 80);
}
export function widgetToDoCount(value: unknown): number {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? Math.min(count, 99) : 0;
}
export async function updateClientWidget(stage: unknown, toDoCount: unknown): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ClientWidget")) return;
  await ClientWidget.update({ stage: widgetStage(stage), toDoCount: widgetToDoCount(toDoCount) }).catch((): void => undefined);
}
export async function clearClientWidget(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ClientWidget")) return;
  await ClientWidget.clear().catch((): void => undefined);
}

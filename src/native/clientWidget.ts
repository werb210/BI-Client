// BI_CLIENT_BLOCK_v603_HOME_WIDGET
// Native-only snapshot: applicant information is never persisted by the browser.
import { Capacitor, registerPlugin } from "@capacitor/core";
export type ClientWidgetSnapshot = { stage: string; toDoCount: number };
interface ClientWidgetPlugin { update(options: ClientWidgetSnapshot): Promise<void>; clear(): Promise<void>; }
const ClientWidget = registerPlugin<ClientWidgetPlugin>("ClientWidget");
export function widgetStage(value: unknown): string {
  // BI_CLIENT_BLOCK_v605 - a sentence ("We are reviewing your application") is shown as is;
  // only a raw code ("ready_for_submission") is turned into words.
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Application in progress";
  if (!/[_-]/.test(raw) || /\s/.test(raw)) return raw.slice(0, 80);
  return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 80);
}
export function widgetToDoCount(value: unknown): number {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count > 0 ? Math.min(count, 99) : 0;
}
// BI_CLIENT_BLOCK_v605 - last values, so a stage update keeps the count and vice versa.
let lastStage: string | undefined;
let lastCount: number | undefined;
export function mergeWidget(stage: unknown, toDoCount: unknown): ClientWidgetSnapshot {
  if (typeof stage === "string" && stage.trim()) lastStage = widgetStage(stage);
  if (toDoCount !== undefined && toDoCount !== null) lastCount = widgetToDoCount(toDoCount);
  return { stage: lastStage ?? widgetStage(null), toDoCount: lastCount ?? 0 };
}
export async function updateClientWidget(stage: unknown, toDoCount: unknown): Promise<void> {
  const snapshot = mergeWidget(stage, toDoCount);
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ClientWidget")) return;
  await ClientWidget.update(snapshot).catch((): void => undefined);
}
export async function clearClientWidget(): Promise<void> {
  lastStage = undefined; lastCount = undefined;
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ClientWidget")) return;
  await ClientWidget.clear().catch((): void => undefined);
}

// BI_CLIENT_BLOCK_v603_HOME_WIDGET
// Native-only snapshot: applicant information is never persisted by the browser.
import { Capacitor, registerPlugin } from "@capacitor/core";
export type ClientWidgetSnapshot = { stage: string; toDoCount: number; action?: string };

// BI_CLIENT_WIDGET_BRAND_v631 - the widget's action line in plain words.
export function actionLine(items: Array<{ kind?: string }> | null | undefined): string {
  const list = Array.isArray(items) ? items : [];
  const docs = list.filter((i) => i?.kind === "document").length;
  const questions = list.filter((i) => i?.kind === "question").length;
  const parts: string[] = [];
  if (docs > 0) parts.push(docs === 1 ? "Upload 1 document" : "Upload " + docs + " documents");
  if (questions > 0) parts.push(questions === 1 ? "Answer 1 question" : "Answer " + questions + " questions");
  return parts.length ? parts.join(" · ") : "Nothing to do";
}
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
let lastAction: string | undefined; // BI_CLIENT_WIDGET_BRAND_v631
export function mergeWidget(stage: unknown, toDoCount: unknown, action?: unknown): ClientWidgetSnapshot {
  if (typeof stage === "string" && stage.trim()) lastStage = widgetStage(stage);
  if (toDoCount !== undefined && toDoCount !== null) lastCount = widgetToDoCount(toDoCount);
  if (typeof action === "string" && action.trim()) lastAction = action.trim().slice(0, 60);
  const snap: ClientWidgetSnapshot = { stage: lastStage ?? widgetStage(null), toDoCount: lastCount ?? 0 };
  if (lastAction) snap.action = lastAction;
  return snap;
}
export async function updateClientWidget(stage: unknown, toDoCount: unknown, action?: unknown): Promise<void> {
  const snapshot = mergeWidget(stage, toDoCount, action);
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ClientWidget")) return;
  await ClientWidget.update(snapshot).catch((): void => undefined);
}
export async function clearClientWidget(): Promise<void> {
  lastStage = undefined; lastCount = undefined; lastAction = undefined;
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("ClientWidget")) return;
  await ClientWidget.clear().catch((): void => undefined);
}

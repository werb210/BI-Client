// BI_CLIENT_FLOW_v12
const KEY = "boreal_bi_draft_profile";
export function loadDraft<T extends Record<string, string>>(fallback: T): T { try { const raw = localStorage.getItem(KEY); return raw ? { ...fallback, ...JSON.parse(raw) as Partial<T> } : fallback; } catch { return fallback; } }
export function saveDraft(values: Record<string, string>): void { try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* Storage unavailable. */ } }
export function clearDraft(): void { try { localStorage.removeItem(KEY); } catch { /* Nothing to clear. */ } }

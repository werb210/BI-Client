// BI_CLIENT_INDUSTRY_v11
const INDUSTRY_KEY = "boreal_bi_entry_industry";
const SRC_KEY = "boreal_bi_entry_src";

const clean = (raw: string | null, max: number) =>
  String(raw ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, max);

function read(key: string): string {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

function write(key: string, value: string): void {
  try { if (value) localStorage.setItem(key, value); } catch { /* applicant can pick manually */ }
}

export function captureEntryParams(search: string): void {
  const params = new URLSearchParams(search || "");
  write(INDUSTRY_KEY, clean(params.get("industry"), 40));
  write(SRC_KEY, clean(params.get("src"), 60));
}

export function getEntryIndustry(): string { return read(INDUSTRY_KEY); }
export function getEntrySource(): string { return read(SRC_KEY); }

const CHOSEN_KEY = "boreal_bi_industry";
export function setChosenIndustry(code: string): void { write(CHOSEN_KEY, clean(code, 40)); }
export function getChosenIndustry(): string { return read(CHOSEN_KEY) || getEntryIndustry(); }

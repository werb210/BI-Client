const STATIC_ROUTES = new Set(["home", "start", "upload"]);
const ID_ROUTES = new Set(["coverage", "questions", "review", "requirements"]);
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
let pendingDestination: string | null = null;

export function retainNativeDestination(path: string): void {
  pendingDestination = path === "/" ? null : path;
}

export function consumeNativeDestination(): string | null {
  const destination = pendingDestination;
  pendingDestination = null;
  return destination;
}

/** Parse only BI's registered custom scheme. Route guards still enforce auth. */
export function parseNativeUrl(raw: string, authenticated: boolean): string {
  const fallback = authenticated ? "/home" : "/";
  try {
    const url = new URL(raw);
    if (url.protocol !== "borealrisk:" || url.search || url.hash) return fallback;
    const segments = [url.hostname, ...url.pathname.split("/")].filter(Boolean);
    if (segments.length === 1 && STATIC_ROUTES.has(segments[0])) return `/${segments[0]}`;
    if (segments.length === 2 && ID_ROUTES.has(segments[0]) && SAFE_ID.test(segments[1])) {
      return `/${segments[0]}/${encodeURIComponent(segments[1])}`;
    }
  } catch { /* malformed URL */ }
  return fallback;
}

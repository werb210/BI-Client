// BI_CLIENT_SCAFFOLD_v1 - the applicant token from bi-server. Its own storage
// key: a subcontractor and a Boreal staff member may share a browser, and the
// BF client token must never be read or overwritten from here.
const KEY = "boreal_bi_applicant_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // private browsing - the session will not survive a reload, which is
    // recoverable: the applicant can request another code.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}

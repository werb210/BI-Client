// Shared helpers for the "pages2" behaviour tests.

function base64Url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** An unsigned JWT with the given claims (the client never verifies signatures). */
export function makeJwt(claims: Record<string, unknown>): string {
  return `${base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${base64Url(JSON.stringify(claims))}.sig`;
}

/** A session token that is valid for another hour. */
export function liveJwt(claims: Record<string, unknown> = {}): string {
  return makeJwt({ sub: "applicant-1", exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
}

/** A session token that ran out an hour ago. */
export function expiredJwt(claims: Record<string, unknown> = {}): string {
  return makeJwt({ sub: "applicant-1", exp: Math.floor(Date.now() / 1000) - 3600, ...claims });
}

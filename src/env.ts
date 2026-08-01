// BI_CLIENT_SCAFFOLD_v1 - bi-server is a separate service from BF-Server, on
// its own database (bi-pg01), and it mounts every route under /api/v1 rather
// than /api. That prefix belongs here, once, so no caller has to remember it.
export const ENV = {
  API_BASE: (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "")
    // BI_CLIENT_CONTRACT_UPLOAD_v1 - the real bi-server host. The scaffold
    // guessed bi-server.azurewebsites.net; no custom domain is configured, so
    // this generated hostname is the only address that resolves. Set
    // VITE_API_BASE in the Static Web App so this default is never relied on.
    || "https://bi-server-cse0apamgkheb9d5.canadacentral-01.azurewebsites.net",
  API_PREFIX: "/api/v1",
} as const;

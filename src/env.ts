// BI_CLIENT_SCAFFOLD_v1 - bi-server is a separate service from BF-Server, on
// its own database (bi-pg01), and it mounts every route under /api/v1 rather
// than /api. That prefix belongs here, once, so no caller has to remember it.
export const ENV = {
  API_BASE: (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "")
    || "https://bi-server.azurewebsites.net",
  API_PREFIX: "/api/v1",
} as const;

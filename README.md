# BI-Client

Subcontractor insurance and bond application front end for Boreal Risk
Management. Built for the SLF channel: a subcontractor signs in, uploads their
subcontract, and is shown the coverages that contract requires plus what else
is available to them.

## Stack

Vite + React 18 + TypeScript, deployed as an Azure Static Web App.
Backend is **bi-server**, which is a separate service from BF-Server on its own
database, and which mounts every route under `/api/v1`.

## Layout

`src/` sits at the repository root. There is no workspace directory. This is
deliberate: bf-client's `client-app/` workspace meant every path written as
`src/...` silently resolved to nothing, which broke idempotency checks and
caused a block to apply twice.

## Commands

    npm install
    npm run dev
    npm run typecheck
    npm run test
    npm run build

## Environment

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_BASE` | bi-server origin | `https://bi-server.azurewebsites.net` |

## Not done yet

- Contract upload and OCR extraction of insurance requirement clauses
- Product catalogue and requirement matching
- Dynamic carrier application form
- Signature

## Mobile applications

BI-Client supports its existing browser/PWA deployment plus Capacitor 8 native shells for iOS/iPadOS and Android. These projects are foundations for native builds and have **not** been published to the App Store or Play Store. They reuse the same React Router applicant routes and BI-Server API contract; no separate native business flow exists.

- iOS bundle ID: `com.boreal.risk.client`
- Android application ID: `com.boreal.risk.client` (target API 36)
- Native fallback links: `borealrisk://`

See [NATIVE_BUILD.md](NATIVE_BUILD.md) for build/configuration commands and [MOBILE_RELEASE_READINESS.md](MOBILE_RELEASE_READINESS.md) for credential and store work that remains. BI-Client remains strictly isolated from BF authentication, storage, data, and server configuration.

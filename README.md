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

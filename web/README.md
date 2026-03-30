# ProcureChain Frontend

Next.js App Router frontend for ProcureChain procurement workflows.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000`.

## Environment

` .env.local ` keys:

- `NEXT_PUBLIC_API_BASE_URL` default `http://127.0.0.1:8080`
- `NEXT_PUBLIC_TENANT_ID` default `dev-tenant`
- `NEXT_PUBLIC_COMPANY_ID` default `dev-company`
- `NEXT_PUBLIC_USE_MOCK`:
  - `false` = live backend reads
  - `true` = full mock data mode
- `NEXT_PUBLIC_ACTOR_NAME` default `Kyle`
- `NEXT_PUBLIC_ACTOR_INITIALS` default `KY`
- `NEXT_PUBLIC_ACTOR_ROLES` default `PROCUREMENT_OFFICER` (comma-separated role list)

## Sprint F1 scope delivered

- Shared API client with tenant/company/request-id headers
- Unified API error parsing (status/code/details/requestId)
- React Query retry policy tuned for backend errors
- Live-read wiring for:
  - requisitions (`/pr`, `/pr/:id`, `/pr/:id/lines`)
  - approvals inbox source (derived from live requisitions)
  - suppliers (`/suppliers`, `/suppliers/:id`)
  - audit events (`/audit/events`)
- Reusable UI error alert showing request-id for support/debug
- Mock/live mode switch via environment variable

## Note

PR create wizard and some write flows are still partially mock-backed and will be completed in Sprint F2.

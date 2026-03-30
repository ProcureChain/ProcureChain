# Frontend Technical Notes

## Overview

The frontend is a Next.js App Router application located at [web](/opt/procurechain/web). It provides the procurement user interface across organization and supplier workflows.

## Stack

- Next.js 16
- React 19
- TypeScript
- React Query
- React Hook Form
- Radix UI based components

## Main App Areas

- Dashboard
- Requisitions
- Approvals
- RFQs
- Bids and comparison
- Suppliers
- Purchase orders
- Finance
- Governance
- Audit
- Supplier portal views

Key routes live under [web/app](/opt/procurechain/web/app).

## Supporting Libraries

- Runtime configuration: [web/lib/runtime-config.ts](/opt/procurechain/web/lib/runtime-config.ts)
- API clients: [web/lib/api/client.ts](/opt/procurechain/web/lib/api/client.ts)
- Mock/live switching: [web/lib/api/mock-api.ts](/opt/procurechain/web/lib/api/mock-api.ts), [web/lib/api/live-api.ts](/opt/procurechain/web/lib/api/live-api.ts)
- Session helpers: [web/lib/session.ts](/opt/procurechain/web/lib/session.ts)

## Environment Contract

Primary frontend variables:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_TENANT_ID`
- `NEXT_PUBLIC_COMPANY_ID`
- `NEXT_PUBLIC_USE_MOCK`
- actor profile variables for development

Example file: [web/.env.example](/opt/procurechain/web/.env.example)

## Behavioral Notes

- The app supports live backend reads for core entities and retains some mock-backed flows for incomplete write paths.
- Runtime config supports role and portal switching, including supplier-portal behavior.
- API requests are built around tenant/company headers expected by the backend.

## Frontend Publishing Guidance

- Keep `.env.local`, `.next`, and `node_modules` out of git.
- Prefer documenting route ownership and API dependencies as features stabilize.
- Treat `web/README.md` as app-specific setup and the root `README.md` as monorepo setup.

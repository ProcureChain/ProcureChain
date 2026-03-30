# ProcureChain API

NestJS + Prisma service for ProcureChain procurement workflows.

This service is part of the ProcureChain monorepo rooted at `/opt/procurechain`.

## Stack

- Node.js 20+
- NestJS 11
- Prisma 6
- PostgreSQL 16

## Prerequisites

- `npm`
- PostgreSQL (local) or Docker Compose from repo root

## Environment

Create an env file in this folder from [`.env.example`](/opt/procurechain/api/procurechain-api/.env.example).

Minimum required variables:

```bash
PORT=8080
DATABASE_URL=postgresql://procurechain:procurechain_dev_pw@127.0.0.1:5432/procurechain_dev?schema=dev
ENV_NAME=dev
```

## Install

```bash
npm install
```

## Run

Development:

```bash
npm run start:dev
```

Build:

```bash
npm run build
```

Production:

```bash
npm run start:prod
```

Helper scripts:

```bash
./scripts/dev.sh
./scripts/staging.sh
```

## Database

Run migrations:

```bash
npx prisma migrate deploy --schema ./src/prisma/schema.prisma
```

Seed minimum tenant/company:

```bash
npx ts-node ./src/prisma/seed.ts
```

Seed taxonomy + rule/form mappings + dynamic required-field rules (Appendix A/C dataset file driven):

```bash
npx ts-node ./src/prisma/seed-taxonomy.ts
```

Seed approval rules:

```bash
npx ts-node ./src/prisma/seed-approval-rules.ts
```

## Request Headers (Required)

All tenant-scoped endpoints require:

- `x-tenant-id`
- `x-company-id`

Optional:

- `x-request-id` (generated automatically if omitted)

## API Surface (Current)

- `GET /health`
- `GET /`

Audit:

- `POST /audit/test`
- `GET /audit/events?limit=50`

Taxonomy:

- `GET /taxonomy/subcategories?q=&archetype=`
- `GET /taxonomy/effective-config?subcategoryId=&country=`
- `GET /taxonomy/integrity`

Rules / Dynamic Validation:

- `POST /rules/validate/pr`
- `POST /rules/validate/rfq`
- `POST /rules/validate/bid`
- `GET /rules/family-hooks?subcategoryId=&type=evaluation|invoice&varianceAbs=`

Purchase Requisitions:

- `POST /pr`
- `GET /pr?limit=50`
- `GET /pr/:id`
- `POST /pr/:id/submit`
- `POST /pr/:id/lines`
- `GET /pr/:id/lines`
- `DELETE /pr/:id/lines/:lineId`
- `POST /pr/:id/recalculate`

Suppliers:

- `POST /suppliers`
- `GET /suppliers?limit=50&q=&subcategoryId=`
- `GET /suppliers/:id`
- `PATCH /suppliers/:id`
- `POST /suppliers/:id/contacts`
- `DELETE /suppliers/:id/contacts/:contactId`
- `POST /suppliers/:id/tags`

RFQs:

- `POST /rfqs`
- `GET /rfqs/:id`
- `POST /rfqs/:id/suppliers`
- `POST /rfqs/:id/release`
- `POST /rfqs/:id/open`
- `POST /rfqs/:id/award`
- `POST /rfqs/:id/close`

Purchase Orders:

- `POST /pos/from-award`
- `GET /pos?limit=50`
- `GET /pos/:id`
- `POST /pos/:id/release`
- `POST /pos/:id/respond`
- `POST /pos/:id/close`

Finance:

- `POST /finance/invoices/sync`
- `GET /finance/invoices?poId=&limit=`
- `GET /finance/po/:poId/validation`

## Example Request

```bash
curl -X GET "http://localhost:8080/health"
```

Tenant-scoped example:

```bash
curl -X GET "http://localhost:8080/pr" \
  -H "x-tenant-id: dev-tenant" \
  -H "x-company-id: dev-company"
```

## Validation and Errors

- Global DTO validation is enabled (whitelist + reject unknown fields).
- Error responses include:
  - `statusCode`
  - `code`
  - `message`
  - `details` (validation errors)
  - `requestId`
  - `path`
  - `timestamp`

## Tests

```bash
npm run test
npm run test:e2e
./scripts/smoke-sprint2.sh
./scripts/smoke-sprint3.sh
./scripts/smoke-sprint4.sh
./scripts/smoke-sprint5.sh
```

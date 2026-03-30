# Backend Technical Notes

## Overview

The backend is a NestJS application located at [api/procurechain-api](/opt/procurechain/api/procurechain-api). It exposes procurement workflows, validation logic, persistence, and audit capabilities.

## Stack

- NestJS 11
- TypeScript
- Prisma 6
- PostgreSQL 16
- Jest and Supertest for tests

## Module Areas

Major backend modules currently include:

- health
- audit
- rules
- compliance
- policy
- governance
- partners
- PR
- suppliers
- RFQ
- bid
- PO
- finance
- taxonomy

Source tree: [api/procurechain-api/src](/opt/procurechain/api/procurechain-api/src)

## API Behavior

- CORS is enabled for development and staging style use.
- Global DTO validation is enforced.
- Request ID middleware and metrics instrumentation are enabled.
- Tenant/company headers are required on most business endpoints.

Entry point: [api/procurechain-api/src/main.ts](/opt/procurechain/api/procurechain-api/src/main.ts)

## Persistence

- Prisma schema: [api/procurechain-api/src/prisma/schema.prisma](/opt/procurechain/api/procurechain-api/src/prisma/schema.prisma)
- Seed scripts and migrations live under the `src/prisma` subtree.

## Environment Contract

Primary backend variables:

- `PORT`
- `DATABASE_URL`
- `ENV_NAME`
- geocoder configuration variables

Example file: [api/procurechain-api/.env.example](/opt/procurechain/api/procurechain-api/.env.example)

## Operational Notes

- The repository currently stores uploaded artifacts locally under `uploads/`; those files are now excluded from git.
- Monitoring assets under `infra/monitoring/` can be used to extend backend observability.
- Database bootstrap should include migrations and required seed data before full workflow testing.

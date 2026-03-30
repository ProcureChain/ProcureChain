# ProcureChain Architecture

## Overview

ProcureChain is structured as a monorepo with a clear split between presentation, application logic, and operational tooling.

- `web/` delivers the user-facing procurement application.
- `api/procurechain-api/` exposes tenant-scoped procurement workflows and persistence.
- `infra/monitoring/` contains observability assets for local or hosted monitoring.
- `Docs/` and `ProcureChain/` retain the original business and specification packs used as project reference material.

## High-Level Architecture

```text
Users
  |
  v
Next.js frontend (web)
  |
  v
NestJS API (api/procurechain-api)
  |
  v
PostgreSQL + Prisma
```

Supporting systems:

- Monitoring stack: Prometheus, Grafana, Loki, Alloy
- File uploads: local storage under `api/procurechain-api/uploads/`
- Reference documentation: legacy `.docx`, `.xlsx`, `.json`, and `.csv` source materials

## Major Domains

- Purchase requisitions
- Approval workflows
- Supplier management
- RFQ lifecycle
- Bid comparison
- Purchase orders
- Finance and invoice validation
- Compliance, policy, governance, and audit

## Request Model

The backend enforces tenant and company scoping through request headers:

- `x-tenant-id`
- `x-company-id`
- optional actor context such as `x-user-id` and `x-user-roles`

This keeps business operations partitioned by tenant and company and supports future organization and partner portals.

## Data Layer

- Database: PostgreSQL 16
- ORM: Prisma
- Main schema file: [api/procurechain-api/src/prisma/schema.prisma](/opt/procurechain/api/procurechain-api/src/prisma/schema.prisma)

Core entities include:

- `Tenant`
- `Company`
- `User`
- `AuditEvent`
- procurement policy and governance entities
- requisition, supplier, RFQ, bid, PO, and finance entities
- taxonomy and rule-pack entities

## Runtime Topology

Local development can run in two ways:

1. Separate processes for database, API, and web app
2. Root Docker Compose stack for all three services

The frontend reads API configuration from `NEXT_PUBLIC_*` environment variables and defaults to localhost development endpoints.

## Technical Risks To Track

- Existing legacy documents are large binary reference assets and should be curated if long-term version control hygiene becomes a priority.
- Uploaded files and live environment files must remain excluded from git.
- Several product flows still rely on partial mock behavior in the frontend and should be documented during feature hardening.

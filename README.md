# ProcureChain

ProcureChain is a monorepo containing the frontend, backend, infrastructure support files, and technical documentation for the procurement platform.

## Ownership

- Delivery authoring entity: Blueprints K2025626063
- Maintainer: Joshua Boyd (`jboyd@blprnts`)
- Platform owner: ProcureChain (`admin@procurechain.co.za`)

## Repository Structure

```text
.
|-- api/procurechain-api      # NestJS + Prisma backend
|-- web                       # Next.js frontend
|-- infra/monitoring          # Grafana / Prometheus / Loki assets
|-- docs/technical            # Markdown technical documentation
|-- Docs/                     # Legacy source documents and reference packs
|-- ProcureChain/             # Legacy developer pack documents
`-- docker-compose.yml        # Local development stack
```

## Stack

- Frontend: Next.js 16, React 19, TypeScript
- Backend: NestJS 11, Prisma 6, PostgreSQL 16
- Infrastructure: Docker Compose, Prometheus, Grafana, Loki

## Quick Start

### 1. Start PostgreSQL only

```bash
docker compose up -d db
```

### 2. Run the backend

```bash
cd api/procurechain-api
cp .env.example .env.dev
npm install
npm run start:dev
```

Backend default URL: `http://127.0.0.1:8080`

### 3. Run the frontend

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Frontend default URL: `http://127.0.0.1:3000`

## Full Dev Stack With Compose

The root compose file runs PostgreSQL, the API, and the frontend using official Node images and mounted source code.

```bash
docker compose up --build
```

## Environment Files

- Frontend example: [web/.env.example](/opt/procurechain/web/.env.example)
- Backend example: [api/procurechain-api/.env.example](/opt/procurechain/api/procurechain-api/.env.example)

Real env files and uploaded artifacts are excluded from git by default.

## Documentation

- Architecture: [docs/technical/architecture.md](/opt/procurechain/docs/technical/architecture.md)
- Frontend: [docs/technical/frontend.md](/opt/procurechain/docs/technical/frontend.md)
- Backend: [docs/technical/backend.md](/opt/procurechain/docs/technical/backend.md)
- GitHub publishing: [docs/technical/github-setup.md](/opt/procurechain/docs/technical/github-setup.md)
- Contribution guide: [CONTRIBUTING.md](/opt/procurechain/CONTRIBUTING.md)

## GitHub Setup

This directory is now initialized as a single git repository. To publish it:

```bash
git add .
git commit -m "Initial ProcureChain monorepo"
git remote add origin <your-github-repo-url>
git push -u origin main
```

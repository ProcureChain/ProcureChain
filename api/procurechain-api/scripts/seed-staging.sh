#!/usr/bin/env bash
set -e
cd /opt/procurechain/api/procurechain-api
set -a; source .env.staging; set +a
npx ts-node src/prisma/seed.ts

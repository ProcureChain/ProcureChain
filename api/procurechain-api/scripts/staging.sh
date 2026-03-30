#!/usr/bin/env bash
set -e
cd /opt/procurechain/api/procurechain-api
set -a; source .env.staging; set +a
exec npm run start:dev

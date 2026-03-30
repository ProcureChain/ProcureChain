# ProcureChain Local Monitoring

This stack runs locally on the VPS only. Nothing here is exposed publicly.

## Services
- Grafana: `127.0.0.1:3001`
- Prometheus: `127.0.0.1:9090`
- Loki: `127.0.0.1:3100`
- Alloy: internal only
- Node Exporter: internal only
- Postgres Exporter: internal only

## Start
```bash
cd /opt/procurechain/infra/monitoring
docker compose up -d
```

## Stop
```bash
cd /opt/procurechain/infra/monitoring
docker compose down
```

## Check
```bash
cd /opt/procurechain/infra/monitoring
docker compose ps
```

## Access from your machine
Tunnel local ports:
```bash
ssh -N -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 -L 3100:127.0.0.1:3100 sigma@102.37.192.12
```

Then open:
- Grafana: `http://127.0.0.1:3001`
- Prometheus: `http://127.0.0.1:9090`
- Loki: `http://127.0.0.1:3100`

## Grafana login
- User: `admin`
- Password: `procurechain-dev-admin`

Change this password before any broader team usage.

## Data sources provisioned
- Prometheus
- Loki

## Logs collected
- `procurechain-api-dev.service` via journald
- `procurechain-web-dev.service` via journald
- nginx access/error logs

## Metrics scraped
- Prometheus self metrics
- ProcureChain API metrics from `/metrics`
- node exporter
- postgres exporter
- Loki metrics
- Alloy metrics

## Nginx log format
- access logs are structured JSON
- Alloy parses them and sends them to Loki with `method`, `status`, and `host_name` labels

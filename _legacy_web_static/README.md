# ProcureChain Frontend Control Deck

Minimal static frontend to drive the ProcureChain backend APIs.

## Run

1. Ensure API is running (default `http://127.0.0.1:8080`).
2. Serve this folder:

```bash
cd /opt/procurechain/web
python3 -m http.server 4173
```

3. Open `http://127.0.0.1:4173`.

## What It Covers

- Connection headers (`x-tenant-id`, `x-company-id`, `x-user-id`, `x-user-roles`)
- End-to-end flow: `PR -> RFQ -> Award`
- Policy/SoD/retention/audit evidence actions
- Government export generation (CSV/PDF snapshot)
- Live API log panel

## Notes

- Config is stored in browser localStorage (`procurechain.frontend.config`).
- For Sprint 6/7 flows, default subcategory is `FAC-SRV-MNT-001`.

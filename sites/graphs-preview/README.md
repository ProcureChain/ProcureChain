# Graphs Preview Site

This is a standalone static mock site for sharing the ProcureChain graph preview with clients.

## Purpose

- separate from the main ProcureChain application
- no app shell
- no authentication dependency
- suitable for its own domain or subdomain

## Files

- `index.html`
- `graphs.js`

## Local Preview

From this folder:

```bash
python3 -m http.server 8081
```

Then open:

```text
http://localhost:8081
```

## Recommended Hosting

Mount this site under the existing development domain at:

```text
https://dev.procurechain.co.za/mock/graphical_dash/
```

This keeps the preview on the same domain while staying outside the main application. The route should be served directly by Nginx, not by Next.js.

## Deployment Shape

Copy the contents of this folder to a static web root on the server, for example:

```bash
sudo mkdir -p /var/www/graphs-preview
sudo cp index.html graphs.js /var/www/graphs-preview/
```

Then apply the full Nginx server-block example from:

`/opt/procurechain/deploy/nginx/graphs-preview.conf`

The example assumes:

- `dev.procurechain.co.za` proxies the main app to `127.0.0.1:3000`
- `/mock/graphical_dash/` is served from `/var/www/graphs-preview/`
- TLS certificates exist under `/etc/letsencrypt/live/dev.procurechain.co.za/`

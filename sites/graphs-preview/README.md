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

Then add the Nginx location config from:

`/opt/procurechain/deploy/nginx/graphs-preview.conf`

That config is intended to be pasted into the existing `server_name dev.procurechain.co.za` block.

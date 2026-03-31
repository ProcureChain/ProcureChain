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

If `dev.procurechain.co.za` is reserved for this mock preview only, point the web server root at this folder.

If `dev.procurechain.co.za` already serves another application, use a separate host such as:

- `mock.dev.procurechain.co.za`
- `graphs.dev.procurechain.co.za`

## Deployment Shape

Copy the contents of this folder to a static web root on the server, for example:

```bash
sudo mkdir -p /var/www/graphs-preview
sudo cp index.html graphs.js /var/www/graphs-preview/
```

Then apply the Nginx host config from:

`/opt/procurechain/deploy/nginx/graphs-preview.conf`

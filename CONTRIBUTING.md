# Contributing

## Ownership

- Delivery authoring entity: Blueprints K2025626063
- Maintainer: Joshua Boyd (`jboyd@blprnts`)
- Platform owner: ProcureChain (`admin@procurechain.co.za`)

## Working Agreement

This codebase should read like it was written by engineers for engineers.

- Prefer direct, plain language in docs, comments, PRs, and issues.
- Avoid filler, slogans, and generic generated phrasing.
- Explain tradeoffs, assumptions, and edge cases when they matter.
- Do not add comments that simply restate the code.
- Add comments where a future maintainer would otherwise need to reverse-engineer intent.

## Pull Requests

- Keep changes scoped to one clear outcome.
- Update docs when behaviour, setup, or operating assumptions change.
- Call out migrations, seed data changes, and new environment variables.
- If a change touches both frontend and backend, note the contract between them.

## Code Comments

Use comments for:

- request or data flow boundaries
- non-obvious cache invalidation
- validation rules tied to business policy
- compatibility shims or temporary constraints

Avoid comments for:

- obvious assignments
- framework boilerplate
- repeating function names in sentence form

## Local Checks

Frontend:

```bash
cd web
npm ci
npm run lint
npm run build
```

Backend:

```bash
cd api/procurechain-api
npm ci
npm run lint
npm run build
npm test -- --runInBand
```

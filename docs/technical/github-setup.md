# GitHub Repository Setup

## Current State

ProcureChain is now prepared as a single monorepo rooted at `/opt/procurechain`.

Changes made to support GitHub publication:

- initialized a git repository at the project root
- renamed the default branch to `main`
- preserved previous nested git metadata under `.repo-backups/`
- added a root `.gitignore`
- created root documentation and technical docs
- aligned `docker-compose.yml` to the actual repository structure

## Publish Steps

1. Review the working tree:

```bash
git status
```

2. Stage and commit:

```bash
git add .
git commit -m "Initial ProcureChain monorepo"
```

3. Create an empty GitHub repository in your account or organization.

Suggested repository names:

- `procurechain`
- `procurechain-platform`
- `procurechain-monorepo`

4. Connect and push:

```bash
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Recommended Follow-Up

- Add branch protection on `main`
- Add GitHub Actions for frontend and backend CI
- Add issue templates and a pull request template
- Move any remaining secrets into a secret manager or GitHub Actions secrets

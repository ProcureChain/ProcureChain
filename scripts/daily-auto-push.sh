#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/opt/procurechain"
BRANCH="main"
LOG_DIR="/opt/procurechain/logs"
LOG_FILE="$LOG_DIR/daily-auto-push.log"

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] Starting daily auto-push"

cd "$REPO_DIR"

# Ensure we are on the target branch
current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  git checkout "$BRANCH"
fi

# Stage and check if there is anything to commit
git add -A
if git diff --cached --quiet; then
  echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] No changes to commit"
  exit 0
fi

commit_msg="chore: daily dev sync $(date -u +'%Y-%m-%d')"
git commit -m "$commit_msg"
git push origin "$BRANCH"

echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] Auto-push complete"

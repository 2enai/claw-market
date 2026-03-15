#!/usr/bin/env bash
set -euo pipefail

echo "🤖 Agent starting: Add API auth middleware (X-API-Key header lookup in DB, attach agent to Hono context, 401 for invalid). Apply to POST/PATCH/DELETE routes. Update task routes to use authed agent from context. Add OpenAPI 3.1 spec at /openapi.json and Swagger UI at /docs. Ensure tsc --noEmit passes."
echo "📁 Working in: $(pwd)"
echo "🌿 Branch: feat/auth-and-openapi"
echo "📋 Prompt template: default"
echo ""

# ===== AGENT PHASE (LLM) =====
codex exec --full-auto "$(cat .agent-prompt.md)"

# ===== DETERMINISTIC PHASE (no LLM) =====

echo ""
echo "━━━ Pre-commit checks ━━━"
PRE_COMMIT_FAILED=false
echo "  → npx tsc --noEmit"
if ! npx tsc --noEmit 2>&1; then
  echo "  ❌ npx tsc --noEmit failed"
  PRE_COMMIT_FAILED=true
  # Try auto-fix for lint
  if echo "npx tsc --noEmit" | grep -qi "check"; then
    bunx biome check --write . 2>/dev/null || true
  fi
fi

echo ""
echo "━━━ Committing ━━━"

git add -A
if git diff --cached --quiet; then
  echo "ℹ️  No changes to commit."
  exit 0
fi
git commit -m "feat: Add API auth middleware (X-API-Key header lookup in DB, attach agent to Hono context, 401 for invalid). Apply to POST/PATCH/DELETE routes. Update task routes to use authed agent from context. Add OpenAPI 3.1 spec at /openapi.json and Swagger UI at /docs. Ensure tsc --noEmit passes.

Automated by task-1773568045-31968"

echo ""
echo "━━━ Pre-push checks ━━━"
PRE_PUSH_FAILED=false

if [[ "$PRE_PUSH_FAILED" == "true" ]]; then
  echo ""
  echo "⚠️  Pre-push checks failed. Branch NOT pushed."
  echo "   Agent session ending — monitor will handle retry."
  exit 1
fi

echo ""
echo "━━━ Pushing + PR ━━━"
git push origin "feat/auth-and-openapi"

if command -v gh &>/dev/null; then
  PR_URL=$(gh pr create \
    --title "Add API auth middleware (X-API-Key header lookup in DB, attach agent to Hono context, 401 for invalid). Apply to POST/PATCH/DELETE routes. Update task routes to use authed agent from context. Add OpenAPI 3.1 spec at /openapi.json and Swagger UI at /docs. Ensure tsc --noEmit passes." \
    --body "## Automated PR

**Task:** Add API auth middleware (X-API-Key header lookup in DB, attach agent to Hono context, 401 for invalid). Apply to POST/PATCH/DELETE routes. Update task routes to use authed agent from context. Add OpenAPI 3.1 spec at /openapi.json and Swagger UI at /docs. Ensure tsc --noEmit passes.
**Agent:** codex
**Task ID:** task-1773568045-31968
**Prompt:** default

---
_Created by agent swarm via OpenClaw_" \
    --base main \
    --head "feat/auth-and-openapi" 2>/dev/null || echo "")

  if [[ -n "$PR_URL" ]]; then
    echo "✅ PR created: $PR_URL"
    PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
    TMP=$(mktemp)
    jq --arg id "task-1773568045-31968" --arg pr "$PR_NUM" --arg url "$PR_URL" \
      '(.tasks[] | select(.id == $id)) |= . + {status: "pr-created", prNumber: $pr, prUrl: $url, completedAt: (now | todate)}' \
      "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json" > "$TMP" && mv "$TMP" "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json"
  fi
else
  echo "⚠️  gh CLI not found. Push complete but no PR created."
fi

echo ""
echo "🏁 Agent session complete."

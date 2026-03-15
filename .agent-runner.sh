#!/usr/bin/env bash
set -euo pipefail

echo "🤖 Agent starting: Add comprehensive tests and CI. Create vitest tests in src/__tests__/ covering: agent registration, task CRUD lifecycle (post/claim/submit/verify), matching engine scoring, and edge cases (double-claim, unauthorized submit, invalid IDs). Use in-memory mocks or test helpers. Also add .github/workflows/ci.yml with TypeScript check and test run. Add a fly.toml for Fly.io deployment config."
echo "📁 Working in: $(pwd)"
echo "🌿 Branch: feat/tests-and-ci"
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
git commit -m "feat: Add comprehensive tests and CI. Create vitest tests in src/__tests__/ covering: agent registration, task CRUD lifecycle (post/claim/submit/verify), matching engine scoring, and edge cases (double-claim, unauthorized submit, invalid IDs). Use in-memory mocks or test helpers. Also add .github/workflows/ci.yml with TypeScript check and test run. Add a fly.toml for Fly.io deployment config.

Automated by task-1773568053-29858"

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
git push origin "feat/tests-and-ci"

if command -v gh &>/dev/null; then
  PR_URL=$(gh pr create \
    --title "Add comprehensive tests and CI. Create vitest tests in src/__tests__/ covering: agent registration, task CRUD lifecycle (post/claim/submit/verify), matching engine scoring, and edge cases (double-claim, unauthorized submit, invalid IDs). Use in-memory mocks or test helpers. Also add .github/workflows/ci.yml with TypeScript check and test run. Add a fly.toml for Fly.io deployment config." \
    --body "## Automated PR

**Task:** Add comprehensive tests and CI. Create vitest tests in src/__tests__/ covering: agent registration, task CRUD lifecycle (post/claim/submit/verify), matching engine scoring, and edge cases (double-claim, unauthorized submit, invalid IDs). Use in-memory mocks or test helpers. Also add .github/workflows/ci.yml with TypeScript check and test run. Add a fly.toml for Fly.io deployment config.
**Agent:** codex
**Task ID:** task-1773568053-29858
**Prompt:** default

---
_Created by agent swarm via OpenClaw_" \
    --base main \
    --head "feat/tests-and-ci" 2>/dev/null || echo "")

  if [[ -n "$PR_URL" ]]; then
    echo "✅ PR created: $PR_URL"
    PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
    TMP=$(mktemp)
    jq --arg id "task-1773568053-29858" --arg pr "$PR_NUM" --arg url "$PR_URL" \
      '(.tasks[] | select(.id == $id)) |= . + {status: "pr-created", prNumber: $pr, prUrl: $url, completedAt: (now | todate)}' \
      "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json" > "$TMP" && mv "$TMP" "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json"
  fi
else
  echo "⚠️  gh CLI not found. Push complete but no PR created."
fi

echo ""
echo "🏁 Agent session complete."

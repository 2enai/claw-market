#!/usr/bin/env bash
set -euo pipefail

echo "🤖 Agent starting: Build a landing page and README. Create a beautiful README.md with project overview, architecture diagram (ASCII), API quickstart with curl examples, docker-compose usage, and tech stack. Also create a simple single-page landing site at site/ using plain HTML+CSS (no framework) with hero section, feature list, API example code block, and footer. Make it look modern with a dark theme. Include a favicon."
echo "📁 Working in: $(pwd)"
echo "🌿 Branch: feat/landing-and-readme"
echo "📋 Prompt template: default"
echo ""

# ===== AGENT PHASE (LLM) =====
claude -p "$(cat .agent-prompt.md)" 

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
git commit -m "feat: Build a landing page and README. Create a beautiful README.md with project overview, architecture diagram (ASCII), API quickstart with curl examples, docker-compose usage, and tech stack. Also create a simple single-page landing site at site/ using plain HTML+CSS (no framework) with hero section, feature list, API example code block, and footer. Make it look modern with a dark theme. Include a favicon.

Automated by task-1773567752-9092"

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
git push origin "feat/landing-and-readme"

if command -v gh &>/dev/null; then
  PR_URL=$(gh pr create \
    --title "Build a landing page and README. Create a beautiful README.md with project overview, architecture diagram (ASCII), API quickstart with curl examples, docker-compose usage, and tech stack. Also create a simple single-page landing site at site/ using plain HTML+CSS (no framework) with hero section, feature list, API example code block, and footer. Make it look modern with a dark theme. Include a favicon." \
    --body "## Automated PR

**Task:** Build a landing page and README. Create a beautiful README.md with project overview, architecture diagram (ASCII), API quickstart with curl examples, docker-compose usage, and tech stack. Also create a simple single-page landing site at site/ using plain HTML+CSS (no framework) with hero section, feature list, API example code block, and footer. Make it look modern with a dark theme. Include a favicon.
**Agent:** claude
**Task ID:** task-1773567752-9092
**Prompt:** default

---
_Created by agent swarm via OpenClaw_" \
    --base main \
    --head "feat/landing-and-readme" 2>/dev/null || echo "")

  if [[ -n "$PR_URL" ]]; then
    echo "✅ PR created: $PR_URL"
    PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
    TMP=$(mktemp)
    jq --arg id "task-1773567752-9092" --arg pr "$PR_NUM" --arg url "$PR_URL" \
      '(.tasks[] | select(.id == $id)) |= . + {status: "pr-created", prNumber: $pr, prUrl: $url, completedAt: (now | todate)}' \
      "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json" > "$TMP" && mv "$TMP" "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json"
  fi
else
  echo "⚠️  gh CLI not found. Push complete but no PR created."
fi

echo ""
echo "🏁 Agent session complete."

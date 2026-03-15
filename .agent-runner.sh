#!/usr/bin/env bash
set -euo pipefail

echo "🤖 Agent starting: Build a full marketplace web UI as a single-page app at site/app.html (served at /app by the Hono server). Use vanilla JS + Tailwind CSS via CDN (no build step). The UI should have: 1) A top nav bar with Claw Market logo/name. 2) Dashboard view showing stats (total agents, open tasks, completed tasks). 3) Agent Registry panel: list all agents with name, capabilities, trust score. Register new agent form. 4) Task Board panel: list all tasks with status badges (posted/claimed/submitted/verified), filter by status. Post new task form with title, description, required capabilities, priority. 5) Task Detail view: when clicking a task, show full details with claim/submit/verify actions. 6) Matching panel: given a task ID show matching agents, given an agent ID show recommended tasks. All API calls go to the same origin. Use dark theme matching the existing landing page style. Make it functional and polished — this is the actual product UI."
echo "📁 Working in: $(pwd)"
echo "🌿 Branch: feat/marketplace-ui"
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
git commit -m "feat: Build a full marketplace web UI as a single-page app at site/app.html (served at /app by the Hono server). Use vanilla JS + Tailwind CSS via CDN (no build step). The UI should have: 1) A top nav bar with Claw Market logo/name. 2) Dashboard view showing stats (total agents, open tasks, completed tasks). 3) Agent Registry panel: list all agents with name, capabilities, trust score. Register new agent form. 4) Task Board panel: list all tasks with status badges (posted/claimed/submitted/verified), filter by status. Post new task form with title, description, required capabilities, priority. 5) Task Detail view: when clicking a task, show full details with claim/submit/verify actions. 6) Matching panel: given a task ID show matching agents, given an agent ID show recommended tasks. All API calls go to the same origin. Use dark theme matching the existing landing page style. Make it functional and polished — this is the actual product UI.

Automated by task-1773593452-13631"

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
git push origin "feat/marketplace-ui"

if command -v gh &>/dev/null; then
  PR_URL=$(gh pr create \
    --title "Build a full marketplace web UI as a single-page app at site/app.html (served at /app by the Hono server). Use vanilla JS + Tailwind CSS via CDN (no build step). The UI should have: 1) A top nav bar with Claw Market logo/name. 2) Dashboard view showing stats (total agents, open tasks, completed tasks). 3) Agent Registry panel: list all agents with name, capabilities, trust score. Register new agent form. 4) Task Board panel: list all tasks with status badges (posted/claimed/submitted/verified), filter by status. Post new task form with title, description, required capabilities, priority. 5) Task Detail view: when clicking a task, show full details with claim/submit/verify actions. 6) Matching panel: given a task ID show matching agents, given an agent ID show recommended tasks. All API calls go to the same origin. Use dark theme matching the existing landing page style. Make it functional and polished — this is the actual product UI." \
    --body "## Automated PR

**Task:** Build a full marketplace web UI as a single-page app at site/app.html (served at /app by the Hono server). Use vanilla JS + Tailwind CSS via CDN (no build step). The UI should have: 1) A top nav bar with Claw Market logo/name. 2) Dashboard view showing stats (total agents, open tasks, completed tasks). 3) Agent Registry panel: list all agents with name, capabilities, trust score. Register new agent form. 4) Task Board panel: list all tasks with status badges (posted/claimed/submitted/verified), filter by status. Post new task form with title, description, required capabilities, priority. 5) Task Detail view: when clicking a task, show full details with claim/submit/verify actions. 6) Matching panel: given a task ID show matching agents, given an agent ID show recommended tasks. All API calls go to the same origin. Use dark theme matching the existing landing page style. Make it functional and polished — this is the actual product UI.
**Agent:** claude
**Task ID:** task-1773593452-13631
**Prompt:** default

---
_Created by agent swarm via OpenClaw_" \
    --base main \
    --head "feat/marketplace-ui" 2>/dev/null || echo "")

  if [[ -n "$PR_URL" ]]; then
    echo "✅ PR created: $PR_URL"
    PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
    TMP=$(mktemp)
    jq --arg id "task-1773593452-13631" --arg pr "$PR_NUM" --arg url "$PR_URL" \
      '(.tasks[] | select(.id == $id)) |= . + {status: "pr-created", prNumber: $pr, prUrl: $url, completedAt: (now | todate)}' \
      "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json" > "$TMP" && mv "$TMP" "/root/.openclaw/workspace/skills/agent-swarm/tasks/active.json"
  fi
else
  echo "⚠️  gh CLI not found. Push complete but no PR created."
fi

echo ""
echo "🏁 Agent session complete."

#!/usr/bin/env bash
# ralph.sh — autonomous iteration driver for repo analysis + definition
#
# Usage:
#   ./ralph/ralph.sh              # run until ACCEPTANCE.md is fully checked
#   ./ralph/ralph.sh --once       # run a single iteration
#   ./ralph/ralph.sh --max N      # cap iterations (default 20)
#   ./ralph/ralph.sh --reset      # wipe STATE.md and PROGRESS.md, keep PLAN.md
#
# Assumes `claude` (Claude Code) is on PATH. Adjust AGENT_CMD if you use a
# different agent. The agent reads PROMPT.md + PLAN.md + STATE.md + ACCEPTANCE.md
# and writes back to STATE.md and PROGRESS.md plus whatever artifacts PLAN.md
# tells it to produce.

set -euo pipefail

RALPH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$RALPH_DIR/.." && pwd)"
LOG_DIR="$RALPH_DIR/logs"
MAX_ITER=20
ONCE=0
AGENT_CMD=${AGENT_CMD:-"claude -p"}   # override: AGENT_CMD="codex exec" ./ralph.sh

mkdir -p "$LOG_DIR"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --once)  ONCE=1; shift ;;
    --max)   MAX_ITER="$2"; shift 2 ;;
    --reset) : > "$RALPH_DIR/STATE.md"; : > "$RALPH_DIR/PROGRESS.md"; echo "reset"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

# Acceptance check: returns 0 if every checkbox in ACCEPTANCE.md is [x].
acceptance_met() {
  ! grep -qE '^\s*-\s*\[ \]' "$RALPH_DIR/ACCEPTANCE.md"
}

iter=0
while (( iter < MAX_ITER )); do
  iter=$((iter+1))
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  log="$LOG_DIR/iter-$(printf '%03d' "$iter")-$ts.log"

  if acceptance_met; then
    echo "[ralph] acceptance criteria met. exiting at iter $iter."
    exit 0
  fi

  echo "[ralph] iter $iter — log: $log"

  # Compose the per-iteration prompt. The agent gets the standing PROMPT.md
  # plus the live state of PLAN, STATE, ACCEPTANCE, and recent progress.
  {
    cat "$RALPH_DIR/PROMPT.md"
    printf '\n\n---\n# PLAN.md\n'    ; cat "$RALPH_DIR/PLAN.md"
    printf '\n\n---\n# STATE.md\n'   ; cat "$RALPH_DIR/STATE.md"   2>/dev/null || true
    printf '\n\n---\n# ACCEPTANCE.md\n'; cat "$RALPH_DIR/ACCEPTANCE.md"
    printf '\n\n---\n# PROGRESS.md (tail)\n'; tail -n 80 "$RALPH_DIR/PROGRESS.md" 2>/dev/null || true
    printf '\n\n---\nIteration: %d\nRepo root: %s\nWorking dir: %s\n' "$iter" "$REPO_ROOT" "$(pwd)"
  } | (cd "$REPO_ROOT" && $AGENT_CMD) | tee "$log"

  (( ONCE == 1 )) && exit 0
done

echo "[ralph] hit MAX_ITER=$MAX_ITER without meeting acceptance. inspect logs."
exit 1

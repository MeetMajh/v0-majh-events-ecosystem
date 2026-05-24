# Ralph loop — generic repo analyze & define

Drop this `ralph/` directory at the root of any repo. The loop runs an
agent (Claude Code by default) repeatedly until the repo has a complete,
verified definition: inventory → architecture → behavior → contributor
docs → verification.

## Files

| File              | Role                                                |
|-------------------|-----------------------------------------------------|
| `ralph.sh`        | Driver. Polls acceptance, invokes agent per iter.   |
| `PROMPT.md`       | Standing rules for the agent. Stable across iters.  |
| `PLAN.md`         | What to produce, in phases. **You customize this.** |
| `ACCEPTANCE.md`   | Checkbox exit criteria. Agent flips boxes.          |
| `STATE.md`        | Live phase + next goal. Agent rewrites each iter.   |
| `PROGRESS.md`     | Append-only log. The loop's memory.                 |
| `logs/`           | Per-iteration stdout, auto-created.                 |

## Quick start

```bash
# 1. drop ralph/ at repo root
cp -r /path/to/ralph .

# 2. customize PLAN.md (repo name, root, out-of-scope)
$EDITOR ralph/PLAN.md

# 3. run
chmod +x ralph/ralph.sh
./ralph/ralph.sh
```

## Common operations

```bash
./ralph/ralph.sh --once          # single iteration, useful for debugging
./ralph/ralph.sh --max 50        # raise iteration cap
./ralph/ralph.sh --reset         # wipe STATE + PROGRESS, keep PLAN

# inspect progress
tail -f ralph/PROGRESS.md
rg -n '^- \[ \]' ralph/ACCEPTANCE.md      # what's left
rg -n '^BLOCKED|^PLAN_DRIFT' ralph/STATE.md
```

## Swapping the agent

Default is `claude -p` (Claude Code, headless). Override:

```bash
AGENT_CMD="codex exec" ./ralph/ralph.sh
AGENT_CMD="aider --yes --message-file -" ./ralph/ralph.sh
```

The agent contract: read stdin (PROMPT + PLAN + STATE + ACCEPTANCE +
PROGRESS tail), execute one iteration's worth of work in the repo, write
files, exit. The driver concatenates everything into one prompt on stdin.

## Customizing for a different goal

This template is shaped for **analyze & define**. To adapt for, say,
"migrate to TypeScript" or "add test coverage to 80%":

1. Rewrite `PLAN.md` phases (keep the phase structure, change the content).
2. Rewrite `ACCEPTANCE.md` checkboxes to match.
3. Leave `PROMPT.md` alone — its rules (incremental, honest, no scope
   change) generalize.
4. Reset and run: `./ralph/ralph.sh --reset && ./ralph/ralph.sh`.

## Failure modes & recovery

- **Loop hits `--max` without acceptance met:** inspect `logs/` and
  `PROGRESS.md` tail. Usually the plan is too vague or the agent is stuck
  in a phase. Tighten the relevant `ACCEPTANCE.md` items.
- **`BLOCKED:` in STATE.md:** human-in-the-loop moment. Read the reason,
  unblock, clear the marker, re-run.
- **`PLAN_DRIFT:` in STATE.md:** the plan disagrees with reality. Edit
  `PLAN.md` and `ACCEPTANCE.md`, clear the marker, re-run.
- **Agent keeps redoing work:** PROGRESS.md isn't being read. Check that
  the agent's reply actually appends an entry; if not, sharpen the
  "Append one entry to PROGRESS.md" line in `PROMPT.md`.

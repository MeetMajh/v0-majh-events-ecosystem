# ACCEPTANCE.md — Exit criteria

The driver loop reads this file. When every `[ ]` becomes `[x]`, the loop
exits successfully. The agent flips boxes only after the corresponding
artifact exists and is non-trivial.

## Phase 1 — INVENTORY
- [ ] `docs/INVENTORY.md` exists
- [ ] File tree to depth 2 captured
- [ ] Languages + LOC breakdown captured (cloc, scc, or `rg --files | ...`)
- [ ] All build/package manifests listed with path and purpose
- [ ] Every entry point identified (CLI, server, worker, cron, lambda)
- [ ] CI config summarized (or noted absent)
- [ ] Env/secret surface listed (`.env.example`, secret refs)

## Phase 2 — MAP
- [ ] `docs/ARCHITECTURE.md` exists with a Components section
- [ ] Mermaid component diagram renders without syntax errors
- [ ] External dependencies enumerated (network calls, DBs, queues, APIs)
- [ ] Config surface documented (where, format, defaults)
- [ ] Public surface of each module identified (exports / routes / handlers)

## Phase 3 — CHARACTERIZE
- [ ] "Behavior" section added to `docs/ARCHITECTURE.md`
- [ ] At least one end-to-end request/job/event lifecycle traced step by step
- [ ] Known failure modes listed with where they originate
- [ ] `docs/GLOSSARY.md` exists with project-specific terms defined

## Phase 4 — DEFINE
- [ ] `README.md` covers: what, why, install, run, test, deploy
- [ ] `docs/CONTRIBUTING.md` covers: dev loop, conventions, layout
- [ ] `docs/RUNBOOK.md` exists (or PLAN_DRIFT logged if N/A)

## Phase 5 — VERIFY
- [ ] `docs/VERIFICATION.md` exists
- [ ] Every load-bearing claim in README cross-checked against code
- [ ] Every load-bearing claim in ARCHITECTURE cross-checked against code
- [ ] Drift / known gaps recorded
- [ ] No unresolved `BLOCKED:` or `PLAN_DRIFT:` markers in STATE.md

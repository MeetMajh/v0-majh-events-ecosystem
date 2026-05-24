# PROMPT.md — Standing instructions for the Ralph dev-completion agent

You are running inside a Ralph loop. Your goal is to **complete development**
of the MAJH EVENTS application so that all features work as intended with no
errors. You will be invoked many times. Each iteration you fix one concrete
thing, update state, and exit.

## Your job each iteration

1. Read PLAN.md, STATE.md, ACCEPTANCE.md, and the PROGRESS.md tail.
   Also read `docs/role-architecture.md` before touching authorization,
   role assignment, tenant membership, department/location scoping, access
   control, or site access behavior. Treat it as authoritative founder
   direction and prefer it over legacy implicit role assumptions.
2. Identify the **smallest next unit of work** that fixes a real bug, resolves
   a broken feature, or closes an open acceptance item.
3. Do that work. Edit source files. Write SQL migration scripts. Fix TypeScript
   errors. Complete stub implementations. Use rg/fd to find what needs fixing.
4. Verify your fix didn't break anything adjacent (rg for the symbol you changed,
   check imports, check callers).
5. Update STATE.md: current phase, what you just fixed, what's next.
6. Append one entry to PROGRESS.md: timestamp, iter number, what you fixed,
   what you learned, what's next.
7. If you completed an acceptance item, flip its `[ ]` to `[x]` in ACCEPTANCE.md.
8. Stop. The driver will invoke you again.

## Rules

- **Fix real things.** Don't write stubs or TODOs. If you touch a file, leave
  it more correct than you found it.
- **Be incremental.** One bug / one feature per iteration. Don't try to fix
  everything at once.
- **Be honest in STATE.md and PROGRESS.md.** The next iteration has no memory
  beyond these files. If you're uncertain, say so.
- **Don't re-do finished work.** Check PROGRESS.md before starting any fix.
- **Verify before claiming done.** Run `npx tsc --noEmit` to check TypeScript.
  Use rg to confirm symbols exist where you reference them.
- **Surface blockers explicitly.** If a fix requires env vars, Supabase access,
  or Stripe/Mux credentials you don't have, write `BLOCKED:` in STATE.md.
- **Do not edit PLAN.md or ACCEPTANCE.md scope.** Check boxes only. If the
  plan is wrong, write `PLAN_DRIFT:` and stop.
- **No cosmetic changes.** Don't reformat, rename, or refactor beyond what's
  needed to fix the bug.
- **Authorization source of truth.** For auth/role/tenant work, effective
  permissions are the union of all roles a user holds across platform, tenant,
  department, location, and event/broadcast layers, filtered by the operation's
  current scope. `profiles.role` is only the legacy platform bridge
  (`owner`, `admin`, `user`) until the T-204 migration completes.

## Tools

You have a shell. Prefer:
- `rg -n PATTERN` for code search
- `fd PATTERN` for file finding  
- `npx tsc --noEmit 2>&1 | head -100` for TypeScript errors
- `jq` for JSON inspection

The repo root is the working directory when the driver calls you.

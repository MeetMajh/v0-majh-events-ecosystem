#!/usr/bin/env node
/*
  THE TYPECHECK GATE — a per-file ratchet.

  WHY THIS EXISTS.

  next.config.mjs sets `typescript: { ignoreBuildErrors: true }`, so
  `next build` has never type-checked this repository. On 2026-11-18 the
  first `tsc --noEmit` run reported 377 errors, and 52 of them were a single
  bug: `supabaseAdmin` referenced out of scope in all seventeen Stripe
  webhook handlers, which would have thrown ReferenceError on the first real
  payment. A further 26 were in lib/role-actions.ts, where `createClient` was
  called with an argument it does not accept and never awaited, so every
  permission change was a property access on a Promise.

  Neither was exotic. Both were sitting in plain sight for months because
  nothing ran the compiler.

  WHY A RATCHET AND NOT "FAIL ON ANY ERROR".

  A clean-slate rule would require fixing ~300 pre-existing errors before
  anything could merge, so it would be switched off within a day. A ratchet
  is enforceable today: the backlog is tolerated, but it can only shrink.

  WHY PER-FILE AND NOT A TOTAL.

  A total count hides the case that matters. Fix 10 errors in one file and
  introduce 5 new ones in a previously clean payment route, and the total
  falls — the gate passes, and the new bug ships. Per-file, that fails,
  because a file at 0 going to 5 is a regression regardless of the total.

  FAILS ON:
    * a file with no baseline entry that now has errors   (new breakage)
    * a file whose error count has gone UP                (regression)

  PASSES ON:
    * unchanged counts
    * counts that went down  (and prints the command to re-baseline)

  USAGE
    pnpm run typecheck          plain tsc, full output
    pnpm run typecheck:gate     the gate — use this in CI
    pnpm run typecheck:baseline accept current counts as the new baseline

  The baseline is committed, so the number going down is visible in review.
*/

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = join(root, ".typecheck-baseline.json");
const update = process.argv.includes("--update");

/*
  Resolve the project's own tsc rather than going through npx.

  Under pnpm, node_modules is a tree of symlinks into node_modules/.pnpm, and
  `npx tsc` has been observed resolving its own download instead of the
  project's binary — which would typecheck against different library versions
  than the build uses. The local binary is unambiguous. npx stays only as a
  fallback for an environment where the bin link is missing.
*/
const localTsc = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsc.cmd" : "tsc"
);
const useLocal = existsSync(localTsc);

// tsc exits non-zero when it finds errors, which is the normal case here.
const run = spawnSync(
  useLocal ? localTsc : "npx",
  useLocal
    ? ["--noEmit", "--pretty", "false"]
    : ["tsc", "--noEmit", "--pretty", "false"],
  {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  }
);

if (run.error) {
  console.error(`Could not run tsc: ${run.error.message}`);
  console.error("Is TypeScript installed? Try: pnpm install --frozen-lockfile");
  process.exit(2);
}

const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;

// path/to/file.ts(12,34): error TS2304: Cannot find name 'x'.
const ERROR_LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/*
  Generated output is not source, and counting it would make this gate lie.

  tsconfig.json includes the generated ".next/types" route-type declarations,
  which Next writes during a build. They exist on a machine that has run `next
  build` and not in a fresh clone, so counting them would mean the gate
  reports "newly broken" purely because someone built locally, and passes in
  CI where no build has run. A gate that fires on where it ran is a gate that
  gets switched off. .next is gitignored, which is the test for "not source".
*/
const GENERATED = /^\.next\//;

const counts = new Map();
const samples = new Map();
let generatedSkipped = 0;
for (const line of output.split("\n")) {
  const m = ERROR_LINE.exec(line.trim());
  if (!m) continue;
  const file = m[1].replace(/\\/g, "/");
  if (GENERATED.test(file)) {
    generatedSkipped += 1;
    continue;
  }
  counts.set(file, (counts.get(file) ?? 0) + 1);
  if (!samples.has(file)) samples.set(file, `${m[4]}: ${m[5]}`.slice(0, 110));
}
if (generatedSkipped) {
  console.log(
    `(ignored ${generatedSkipped} error(s) in generated .next/ output)\n`
  );
}

const total = [...counts.values()].reduce((a, b) => a + b, 0);

// A tsc run that produced no parseable error lines AND no output at all is
// a clean tree. A run with unparseable output is a tooling failure, and must
// not be mistaken for success — that would make the gate lie.
if (total === 0 && output.trim() !== "" && !/^\s*$/.test(output)) {
  const looksLikeErrors = /error/i.test(output);
  if (looksLikeErrors) {
    console.error("tsc produced output the gate could not parse:\n");
    console.error(output.slice(0, 2000));
    process.exit(2);
  }
}

if (update || !existsSync(BASELINE)) {
  const record = {
    _comment:
      "Per-file tsc error counts. The gate fails if any file's count rises " +
      "or a file absent here gains errors. Regenerate with: pnpm run " +
      "typecheck:baseline",
    _generated: new Date().toISOString().slice(0, 10),
    _total: total,
    files: Object.fromEntries([...counts.entries()].sort()),
  };
  writeFileSync(BASELINE, `${JSON.stringify(record, null, 2)}\n`);
  console.log(
    `${existsSync(BASELINE) && !update ? "Created" : "Updated"} baseline: ` +
      `${total} errors across ${counts.size} files.`
  );
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const base = baseline.files ?? {};

const newlyBroken = [];
const regressed = [];
const improved = [];

for (const [file, n] of counts) {
  const was = base[file];
  if (was === undefined) newlyBroken.push([file, n]);
  else if (n > was) regressed.push([file, was, n]);
  else if (n < was) improved.push([file, was, n]);
}
for (const [file, was] of Object.entries(base)) {
  if (!counts.has(file)) improved.push([file, was, 0]);
}

const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
console.log(`typecheck: ${total} errors (baseline ${baseTotal})\n`);

if (newlyBroken.length) {
  console.error(`✗ ${newlyBroken.length} file(s) newly broken:\n`);
  for (const [file, n] of newlyBroken.sort()) {
    console.error(`    ${file}  (${n} error${n === 1 ? "" : "s"})`);
    console.error(`        ${samples.get(file)}`);
  }
  console.error("");
}

if (regressed.length) {
  console.error(`✗ ${regressed.length} file(s) got worse:\n`);
  for (const [file, was, now] of regressed.sort()) {
    console.error(`    ${file}  ${was} -> ${now}`);
    console.error(`        ${samples.get(file)}`);
  }
  console.error("");
}

if (improved.length) {
  const fixed = improved.reduce((a, [, was, now]) => a + (was - now), 0);
  console.log(`✓ ${fixed} error(s) fixed across ${improved.length} file(s):\n`);
  for (const [file, was, now] of improved.sort().slice(0, 12)) {
    console.log(`    ${file}  ${was} -> ${now}`);
  }
  if (improved.length > 12) console.log(`    ... and ${improved.length - 12} more`);
  console.log("");
}

if (newlyBroken.length || regressed.length) {
  console.error("Run `pnpm exec tsc --noEmit` to see the full errors.");
  console.error("These must be fixed — the backlog may shrink, never grow.");
  process.exit(1);
}

if (improved.length) {
  console.log("Lock it in so it cannot come back:");
  console.log("    pnpm run typecheck:baseline && git add .typecheck-baseline.json\n");
}

console.log("✓ no new type errors.");
process.exit(0);

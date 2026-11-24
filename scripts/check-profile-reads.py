#!/usr/bin/env python3
"""Fail if any user-scoped read of public.profiles requests a withheld column.

public.profiles holds contact, payout and compliance data. Migration 047
replaced `anon`'s table-wide SELECT with a named public column grant, and a
later migration does the same for `authenticated`. Column privileges are
checked BEFORE RLS, and PostgREST honours them, so a read naming a withheld
column does not return null - it fails outright with 42501.

That makes this a build-time question rather than a runtime surprise. A read
is allowed three ways:

  1. it selects only columns in the public grant, or
  2. it reads the caller's own row through public.my_profile, or
  3. it is the SERVICE acting, and runs with the service role.

Anything else fails once the floor is lowered, and this exits non-zero so it
fails the build instead of a payout.

    python3 scripts/check-profile-reads.py
    python3 scripts/check-profile-reads.py --list-safe
    python3 scripts/check-profile-reads.py --verbose

Exit codes: 0 clean, 1 offending reads found, 2 the script could not run.

Two shapes are easy to miss, and both are checked here because each was
missed once already:

  - An EMBEDDED JOIN - `.select("*, profiles!inner(username, email)")` -
    never says `.from("profiles")`, but PostgREST resolves it as a select
    against profiles and the column grant applies in full.
  - A SERVICE CLIENT held in a variable. The Stripe webhook builds its own
    client from the service-role key and calls it `supabaseAdmin`; column
    grants do not apply to it, so flagging it is a false positive.

PostgREST column syntax is `alias:column`, so for `email:id` the column read
is `id` and `email` is only the name it comes back under. The part AFTER the
colon is what authorization cares about.

Standard library only, no syntax newer than Python 3.6, so it runs wherever
CI happens to run.
"""

from __future__ import annotations

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The public grant on public.profiles, as migration 047 names it. Keep in step
# with the migration; it is the one duplication this design accepts, and it is
# why the list is written out here rather than inferred from something.
PUBLIC_COLUMNS = set("""
id username display_name first_name last_name avatar_url country created_at
rating career_wins career_losses career_tournaments
prediction_points predictions_correct predictions_total
follower_count following_count total_uploads approved_uploads is_organizer
""".split())

# Granted to `authenticated` as well: authorization flags that admin listings
# legitimately read across rows. NOT granted to `anon`.
AUTHENTICATED_EXTRA = set("is_admin role tenant_id".split())

# Columns that DO NOT EXIST on profiles. Selecting one fails today for a
# reason unrelated to authorization, so these are reported separately rather
# than counted as floor violations. See the profiles.email brief.
NONEXISTENT = set("""
email full_name stripe_customer_id subscription_status subscription_plan
subscription_period_end stripe_subscription_id discord_webhook_url
""".split())

# A read on one of these runs with the service role, so column grants do not
# apply. `supabaseAdmin` and `adminClient` are variables holding a client the
# file built from SUPABASE_SERVICE_ROLE_KEY.
SERVICE_CLIENTS = ("createAdminClient(", "supabaseAdmin", "adminClient", "admin.")

# A read written as `.from("profiles")`, with the chained call that follows.
DIRECT_RE = re.compile(
    r'\.from\(\s*["\'](profiles|my_profile)["\']\s*\)'
    r'(.{0,700}?)(?:\.single\(\)|\.maybeSingle\(\)|\n\s*\n|$)',
    re.S)

# Any .select() carrying a string or template literal.
SELECT_RE = re.compile(r'\.select\(\s*([`"\'])(.*?)\1', re.S)

# An embedded resource on profiles inside a select body:
#   profiles(a, b)   profiles!inner(a, b)   user:profiles(a, b)
# Only scanned INSIDE a select literal, which is what keeps raw SQL DDL such
# as `REFERENCES profiles(id)` out of the results.
EMBED_RE = re.compile(
    r'(?:(\w+)\s*:\s*)?profiles\s*(?:!\s*(?:inner|left))?\s*\(([^()]*)\)')


def column_of(token):
    """The column a select token actually reads.

    PostgREST spells an alias `alias:column`, so the column is the part after
    the last colon. `email:id` reads `id`. Returns None for a token that names
    no column (a nested resource, a count, a modifier).
    """
    t = token.strip()
    if not t or t.startswith(("{", "}")):
        return None
    if ":" in t:
        t = t.rsplit(":", 1)[1].strip()
    t = t.split("::")[0].strip()          # drop a cast
    t = t.split(".")[0].strip()           # drop an operator suffix
    if not t or t in ("count", "head", "exact", "planned", "estimated"):
        return None
    if not re.match(r'^[A-Za-z_*][A-Za-z0-9_*]*$', t):
        return None
    return t


def split_top_level(body):
    """Split a select body on commas that are not inside parentheses."""
    out, depth, cur = [], 0, []
    for ch in body:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append("".join(cur))
            cur = []
        else:
            cur.append(ch)
    out.append("".join(cur))
    return out


def client_is_service(text, start):
    """Does the statement containing this read use a service-role client?

    Looks back to the start of the statement rather than a fixed number of
    characters, so a multi-line `await createAdminClient()\n  .from(...)` is
    seen, and so a file that builds its own service-role client counts when
    that client is the one in use.
    """
    stmt = text[max(0, start - 400):start].rsplit(";", 1)[-1]
    return any(marker in stmt for marker in SERVICE_CLIENTS)


def iter_source_files():
    skip = ("node_modules", ".next", ".git", "dist", "build", "coverage")
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in skip]
        for name in files:
            if name.endswith((".ts", ".tsx", ".mts", ".js", ".jsx")):
                yield os.path.join(base, name)


def main():
    verbose = "--verbose" in sys.argv

    if "--list-safe" in sys.argv:
        print("public grant on public.profiles (anon and authenticated):")
        for c in sorted(PUBLIC_COLUMNS):
            print("  " + c)
        print("authenticated also:")
        for c in sorted(AUTHENTICATED_EXTRA):
            print("  " + c)
        return 0

    allowed = PUBLIC_COLUMNS | AUTHENTICATED_EXTRA
    violations, missing, seen = [], [], []
    direct = embedded = 0

    for path in sorted(iter_source_files()):
        try:
            with open(path, "r", errors="replace") as fh:
                text = fh.read()
        except OSError:
            continue
        if "profiles" not in text:
            continue
        rel = os.path.relpath(path, ROOT)

        def record(start, shape, table, cols):
            line = text[:start].count("\n") + 1
            names = [c for c in (column_of(t) for t in cols) if c]
            seen.append((rel, line, shape, table, ",".join(names)))

            gone = sorted({c for c in names if c in NONEXISTENT})
            if gone:
                missing.append((rel, line, ",".join(gone)))

            # my_profile is the caller's own row, every column; fine.
            if table == "my_profile":
                return
            # The service acting is not subject to column grants.
            if client_is_service(text, start):
                return

            bad = sorted({c for c in names
                          if c == "*" or (c not in allowed and c not in NONEXISTENT)})
            if bad:
                violations.append((rel, line, shape, ",".join(bad)))

        # 1. Direct reads: .from("profiles").select(...)
        for m in DIRECT_RE.finditer(text):
            sel = SELECT_RE.search(m.group(2))
            if not sel:
                continue
            direct += 1
            record(m.start(), "direct", m.group(1),
                   split_top_level(sel.group(2)))

        # 2. Embedded joins: .select("*, profiles!inner(...)")
        for s in SELECT_RE.finditer(text):
            body = s.group(2)
            for e in EMBED_RE.finditer(body):
                embedded += 1
                record(s.start(), "embed", "profiles",
                       split_top_level(e.group(2)))

    print("check-profile-reads: %d direct read(s) + %d embedded join(s) "
          "on public.profiles" % (direct, embedded))

    if verbose:
        print("")
        for rel, line, shape, table, cols in sorted(seen):
            print("    %-6s %-10s %s:%s  %s" % (shape, table, rel, line, cols))

    if missing:
        print("")
        print("  %d read(s) select a column that does not exist on profiles."
              % len(missing))
        print("  These fail today, for a reason unrelated to authorization:")
        for f, l, c in sorted(set(missing)):
            print("    %s:%s  -> %s" % (f, l, c))

    if violations:
        print("")
        print("  %d user-scoped read(s) request a WITHHELD column:"
              % len(violations))
        for f, l, shape, c in sorted(set(violations)):
            print("    %-6s %s:%s  -> %s" % (shape, f, l, c))
        print("")
        print("  Each needs one of:")
        print("    - select only the public columns  (--list-safe)")
        print("    - read the caller's own row via public.my_profile")
        print("    - use createAdminClient() where the SERVICE is acting")
        return 1

    print("  no user-scoped read requests a withheld column")
    return 0


if __name__ == "__main__":
    sys.exit(main())

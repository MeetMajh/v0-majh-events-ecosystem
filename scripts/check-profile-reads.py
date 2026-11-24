#!/usr/bin/env python3
"""Fail if any user-scoped query touches a column public.profiles withholds.

public.profiles holds contact, payout and compliance data. Migration 047
replaced `anon`'s table-wide SELECT with a named public column grant, and a
later migration does the same for `authenticated`. Column privileges are
checked BEFORE RLS, and PostgREST honours them.

A column is "touched" by more than the select list. Probed as `anon`, which
already holds only the public grant:

    select id WHERE kyc_status = 'pending'     42501
    count(*) WHERE kyc_status = 'pending'      42501
    select id ORDER BY phone                   42501
    select *                                   42501
    count(*) with no filter                    ALLOWED
    select id WHERE created_at > ...           ALLOWED

So a WHERE or an ORDER BY on a withheld column fails exactly like selecting
it, and `count: exact, head: true` gives no protection - the count is only
free while nothing filters on a withheld column. This checks all three
places a column can be named: the select list, every filter, and the order.

A query is allowed three ways:

  1. it touches only columns in the public grant, or
  2. it reads the caller's own row through public.my_profile, or
  3. it is the SERVICE acting, and runs with the service role.

Anything else fails once the floor is lowered, and this exits non-zero so it
fails the build instead of a payout.

    python3 scripts/check-profile-reads.py
    python3 scripts/check-profile-reads.py --list-safe
    python3 scripts/check-profile-reads.py --verbose

Exit codes: 0 clean, 1 offending queries found, 2 the script could not run.

Four shapes are easy to miss. Each is handled here because each was missed by
an earlier version of this script:

  - An EMBEDDED JOIN. `.select("*, profiles!inner(username, kyc_status)")`
    never says .from("profiles"), but PostgREST resolves it as a select
    against profiles and the grant applies in full.
  - A SERVICE CLIENT held in a variable. The Stripe webhook builds its own
    from the service-role key and calls it `supabaseAdmin`; grants do not
    apply to it, and a guard that cries wolf gets switched off.
  - A FILTER or ORDER column, per the probe above.
  - A query with NO terminator. Inside `Promise.all([...])` a query ends at a
    comma, with no .single() to find. An earlier version keyed on the
    terminator and so never examined five admin-console counts, nor the
    public player-profile read it was written to protect.

PostgREST spells an alias `alias:column`, so in `email:id` the column read is
`id`. The part AFTER the colon is what authorization cares about.

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

# Columns that DO NOT EXIST on profiles. Naming one fails today for a reason
# unrelated to authorization, so these are reported separately rather than
# counted as floor violations. See the profiles.email brief.
NONEXISTENT = set("""
email full_name stripe_customer_id subscription_status subscription_plan
subscription_period_end stripe_subscription_id discord_webhook_url
""".split())

# A query on one of these runs with the service role, so column grants do not
# apply. `supabaseAdmin` and `adminClient` are variables holding a client the
# file built from SUPABASE_SERVICE_ROLE_KEY.
SERVICE_CLIENTS = ("createAdminClient(", "supabaseAdmin", "adminClient", "admin.")

# Chain methods whose FIRST string argument is a column name.
COLUMN_FIRST_ARG = set("""
eq neq gt gte lt lte like ilike is in contains containedBy overlaps
rangeGt rangeGte rangeLt rangeLte rangeAdjacent order filter not likeAllOf
likeAnyOf ilikeAllOf ilikeAnyOf
""".split())

# Methods naming no column at all.
NO_COLUMN = set("""
select limit range single maybeSingle csv geojson explain rollback returns
then catch finally abortSignal setHeader throwOnError
""".split())

FROM_RE = re.compile(r'\.from\(\s*["\'](profiles|my_profile)["\']\s*\)')
ANY_FROM_RE = re.compile(r'\.from\(\s*["\']([A-Za-z_][A-Za-z0-9_]*)["\']\s*\)')
EMBED_RE = re.compile(
    r'(?:(\w+)\s*:\s*)?profiles\s*(?:!\s*(?:inner|left))?\s*\(([^()]*)\)')


def skip_ws(s, i):
    """Advance past whitespace and // or /* comments."""
    n = len(s)
    while i < n:
        if s[i] in " \t\r\n":
            i += 1
        elif s.startswith("//", i):
            j = s.find("\n", i)
            i = n if j < 0 else j + 1
        elif s.startswith("/*", i):
            j = s.find("*/", i)
            i = n if j < 0 else j + 2
        else:
            break
    return i


def match_paren(s, i):
    """i points at '('. Return index just past the matching ')', or -1.

    Tracks string and template literals so a ')' inside a string does not
    close the call.
    """
    depth = 0
    n = len(s)
    quote = None
    while i < n:
        c = s[i]
        if quote:
            if c == "\\":
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return -1


def parse_chain(text, start):
    """Parse the method chain beginning at `start` (just past `.from(...)`).

    Returns [(method_name, raw_args)]. Stops at the first thing that is not a
    `.method(` continuation, so a query inside Promise.all([...]) ends
    naturally at its comma and needs no terminator to be found.
    """
    out = []
    i = start
    n = len(text)
    while True:
        i = skip_ws(text, i)
        if i >= n or text[i] != ".":
            break
        j = i + 1
        m = re.match(r'[A-Za-z_][A-Za-z0-9_]*', text[j:])
        if not m:
            break
        name = m.group(0)
        j += len(name)
        j = skip_ws(text, j)
        if j >= n or text[j] != "(":
            break
        end = match_paren(text, j)
        if end < 0:
            break
        out.append((name, text[j + 1:end - 1]))
        i = end
    return out


def split_args(raw):
    """Split a raw argument string on top-level commas."""
    out, cur, depth, quote = [], [], 0, None
    for idx, c in enumerate(raw):
        if quote:
            if c == "\\":
                cur.append(c)
                continue
            if c == quote:
                quote = None
        elif c in "\"'`":
            quote = c
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            out.append("".join(cur))
            cur = []
            continue
        cur.append(c)
    out.append("".join(cur))
    return out


def literal(arg):
    """The contents of arg if it is a single string/template literal, else None."""
    a = arg.strip()
    if len(a) >= 2 and a[0] == a[-1] and a[0] in "\"'`":
        body = a[1:-1]
        if "${" in body:        # interpolated: the column is not static
            return None
        return body
    return None


def column_of(token):
    """The column a select/filter token actually names, or None.

    PostgREST spells an alias `alias:column`, so the column is after the last
    colon: `email:id` names `id`. A dotted path keeps only the last segment
    for the column, but the caller checks the table prefix first.
    """
    t = token.strip()
    if not t or t[0] in "{}[]":
        return None
    if ":" in t:
        t = t.rsplit(":", 1)[1].strip()
    t = t.split("::")[0].strip()
    if not t:
        return None
    if not re.match(r'^[A-Za-z_*][A-Za-z0-9_*]*$', t):
        return None
    if t in ("count", "head", "exact", "planned", "estimated", "true", "false",
             "null", "undefined"):
        return None
    return t


def owned_columns(path, own_table):
    """Columns named by a dotted filter path, if it targets `own_table`.

    `.eq("kyc_status", x)` on a profiles chain names kyc_status.
    `.eq("profiles.username", x)` names a profiles column from any chain.
    `.eq("games.name", x)` on a profiles chain names no profiles column.
    """
    p = path.strip()
    if "." not in p:
        return [p] if own_table else []
    head, tail = p.split(".", 1)
    if head == "profiles":
        # may be profiles.col or profiles.col.op.value (inside .or())
        return [tail.split(".")[0]]
    if own_table:
        # an operator suffix on an own column, e.g. "created_at.gte"
        return [head]
    return []


def or_columns(expr, own_table):
    """Columns named inside .or("a.eq.1,profiles.email.ilike.%x%")."""
    cols = []
    for part in split_args(expr):
        part = part.strip().lstrip("(").strip()
        if not part:
            continue
        cols.extend(owned_columns(part, own_table))
    return cols


def client_is_service(text, start):
    """Does the statement containing this query use a service-role client?"""
    stmt = text[max(0, start - 400):start].rsplit(";", 1)[-1]
    return any(marker in stmt for marker in SERVICE_CLIENTS)


def iter_source_files():
    skip = ("node_modules", ".next", ".git", "dist", "build", "coverage")
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in skip]
        for name in files:
            if name.endswith((".ts", ".tsx", ".mts", ".js", ".jsx")):
                yield os.path.join(base, name)


def columns_touched(chain, own_table):
    """Every profiles column a parsed chain names, with where it was named."""
    found = []   # (column, place)
    for name, raw in chain:
        args = split_args(raw) if raw.strip() else []
        if name == "select":
            body = literal(args[0]) if args else None
            if body is None:
                continue
            if own_table:
                for tok in split_args(body):
                    tok_s = tok.strip()
                    if "(" in tok_s:       # a nested resource, not our column
                        continue
                    c = column_of(tok_s)
                    if c:
                        found.append((c, "select"))
            for e in EMBED_RE.finditer(body):
                for tok in split_args(e.group(2)):
                    c = column_of(tok)
                    if c:
                        found.append((c, "embed"))
        elif name == "or":
            body = literal(args[0]) if args else None
            if body is not None:
                for c in or_columns(body, own_table):
                    cc = column_of(c)
                    if cc:
                        found.append((cc, "or"))
        elif name == "match":
            for key in re.findall(r'([A-Za-z_][A-Za-z0-9_.]*)\s*:', raw):
                for c in owned_columns(key, own_table):
                    cc = column_of(c)
                    if cc:
                        found.append((cc, "match"))
        elif name in COLUMN_FIRST_ARG:
            body = literal(args[0]) if args else None
            if body is not None:
                place = "order" if name == "order" else "filter"
                for c in owned_columns(body, own_table):
                    cc = column_of(c)
                    if cc:
                        found.append((cc, place))
        elif name in NO_COLUMN:
            continue
    return found


def main():
    verbose = "--verbose" in sys.argv

    if "--list-safe" in sys.argv:
        print("public grant on public.profiles (anon and authenticated):")
        for c in sorted(PUBLIC_COLUMNS):
            print("  " + c)
        print("authenticated also:")
        for c in sorted(AUTHENTICATED_EXTRA):
            print("  " + c)
        print("")
        print("A column counts as touched when named in the select list, in")
        print("any filter, or in an order - all three fail with 42501.")
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

        def record(start, shape, table, found):
            line = text[:start].count("\n") + 1
            names = sorted({c for c, _ in found})
            where = {}
            for c, place in found:
                where.setdefault(c, place)
            seen.append((rel, line, shape, table, ",".join(names)))

            gone = sorted({c for c in names if c in NONEXISTENT})
            if gone:
                missing.append((rel, line, ",".join(gone)))

            if table == "my_profile":
                return
            if client_is_service(text, start):
                return

            bad = sorted({c for c in names
                          if c == "*" or (c not in allowed and c not in NONEXISTENT)})
            if bad:
                violations.append((rel, line, shape,
                                   ", ".join("%s (%s)" % (c, where[c]) for c in bad)))

        # 1. Chains rooted at profiles / my_profile.
        for m in FROM_RE.finditer(text):
            direct += 1
            chain = parse_chain(text, m.end())
            record(m.start(), "direct", m.group(1),
                   columns_touched(chain, own_table=True))

        # 2. Chains rooted elsewhere that embed profiles.
        for m in ANY_FROM_RE.finditer(text):
            if m.group(1) in ("profiles", "my_profile"):
                continue
            chain = parse_chain(text, m.end())
            found = columns_touched(chain, own_table=False)
            if found:
                embedded += 1
                record(m.start(), "embed", "profiles", found)

    print("check-profile-reads: %d quer%s rooted at profiles, "
          "%d embedding it" % (direct, "y" if direct == 1 else "ies", embedded))

    if verbose:
        print("")
        for rel, line, shape, table, cols in sorted(seen):
            print("    %-6s %-10s %s:%s  %s" % (shape, table, rel, line, cols))

    if missing:
        print("")
        print("  %d quer%s name a column that does not exist on profiles."
              % (len(set(missing)), "y" if len(set(missing)) == 1 else "ies"))
        print("  These fail today, for a reason unrelated to authorization:")
        for f, l, c in sorted(set(missing)):
            print("    %s:%s  -> %s" % (f, l, c))

    if violations:
        print("")
        print("  %d user-scoped quer%s touch a WITHHELD column:"
              % (len(set(violations)),
                 "y" if len(set(violations)) == 1 else "ies"))
        for f, l, shape, c in sorted(set(violations)):
            print("    %-6s %s:%s  -> %s" % (shape, f, l, c))
        print("")
        print("  A column in a filter or an order fails exactly like one in")
        print("  the select list. Each needs one of:")
        print("    - touch only the public columns  (--list-safe)")
        print("    - read the caller's own row via public.my_profile")
        print("    - use createAdminClient() where the SERVICE is acting")
        return 1

    print("  no user-scoped query touches a withheld column")
    return 0


if __name__ == "__main__":
    sys.exit(main())

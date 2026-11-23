import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { grantConsoleAccessForm, revokeConsoleAccessForm } from "./actions"

export const metadata = {
  title: "Admin console access | MAJH Events",
  description: "Who can approve payouts, issue refunds and read the audit log",
}

export const dynamic = "force-dynamic"

/**
 * Who can reach the admin console.
 *
 * The console — payout approval, holds, refunds, disputes, the audit log,
 * financial KPIs, risk signals — is guarded by one predicate,
 * `has_admin_capability('admin_console')`. Until 2026-11-22 that guard
 * tested three staff_roles values that do not exist in the table, so it
 * refused every human being who clicked it while exempting the service key.
 * Thirty-two functions carried it.
 *
 * This screen is the toggle that replaced it. It exists because a rule
 * nobody can see or change is not a rule, it is a trap waiting for the next
 * person.
 */
export default async function ConsoleAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ history?: string }>
}) {
  const sp = await searchParams
  const showHistory = sp.history === "1"
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // The same rule that governs granting governs seeing this page.
  const { data: mayDelegate } = await supabase.rpc("can_delegate_admin_capability", {
    p_capability: "admin_console",
  })
  if (!mayDelegate) redirect("/dashboard")

  const [{ data: coverage }, { data: grants }, { data: candidates }] = await Promise.all([
    supabase.rpc("admin_console_coverage", { p_capability: "admin_console" }),
    supabase.rpc("list_admin_capability_grants", {
      p_capability: "admin_console",
      p_include_revoked: showHistory,
    }),
    supabase.rpc("admin_capability_candidates", { p_capability: "admin_console" }),
  ])

  const cov = (coverage ?? []) as {
    tenant_id: string
    tenant_name: string
    people: number
    by_role: number
    by_grant: number
    meets_minimum: boolean
  }[]
  const rows = (grants ?? []) as {
    grant_id: string
    user_id: string
    display_name: string | null
    username: string | null
    tenant_name: string | null
    can_delegate: boolean
    granted_at: string
    revoked_at: string | null
    revocation_reason: string | null
    note: string | null
  }[]
  const people = (candidates ?? []) as {
    user_id: string
    display_name: string | null
    username: string | null
    staff_role: string | null
    holds_it: boolean
    by_role: boolean
  }[]

  const thin = cov.filter((c) => !c.meets_minimum)
  const assignable = people.filter((p) => !p.by_role)

  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Admin console access</h1>
        <p className="text-sm text-muted-foreground">
          Who can approve payouts, place and release holds, issue refunds,
          handle disputes and read the audit log. Platform owners and admins
          always have it. A tenant&rsquo;s owner has it by default. Everyone
          else has it because you said so.
        </p>
      </header>

      {/* ───────── the minimum of two ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cover per business</CardTitle>
          <CardDescription>
            Each business should have at least two people who can reach the
            console — its owner and a designee — so that work never waits on
            one person being available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="divide-y">
            {cov.map((c) => (
              <div key={c.tenant_id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm">{c.tenant_name}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {c.people} {Number(c.people) === 1 ? "person" : "people"}
                  <span className="text-xs">
                    ({c.by_role} by role, {c.by_grant} granted)
                  </span>
                  {c.meets_minimum ? (
                    <Badge variant="secondary">covered</Badge>
                  ) : (
                    <Badge variant="destructive">needs a designee</Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
          {thin.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {thin.length === cov.length
                ? "No business has a designee yet, so every one of them depends on a single person."
                : `${thin.length} of ${cov.length} depend on a single person.`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ───────── grant it ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Give someone access</CardTitle>
          <CardDescription>
            They will be able to use the console. They will not be able to
            give it to anyone else unless you make the grant delegable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignable.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Everyone on the platform already holds it by role. A designee
              needs an account first.
            </p>
          ) : (
            <form action={grantConsoleAccessForm} className="flex flex-wrap items-center gap-2">
              <select name="user_id" className="h-9 rounded-md border bg-background px-3 text-sm" defaultValue="">
                <option value="">Choose a person…</option>
                {assignable.map((p) => (
                  <option key={p.user_id} value={p.user_id} disabled={p.holds_it}>
                    {p.display_name ?? p.username ?? p.user_id.slice(0, 8)}
                    {p.staff_role ? ` — ${p.staff_role}` : ""}
                    {p.holds_it ? " (already has it)" : ""}
                  </option>
                ))}
              </select>
              <Input name="note" placeholder="Why, for the record" className="w-64" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="can_delegate" className="h-4 w-4" />
                they may appoint others
              </label>
              <Button type="submit" variant="secondary">
                Give access
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ───────── who holds it ───────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Granted access {showHistory ? "(including withdrawn)" : ""}
          </CardTitle>
          <CardDescription>
            Holders by role are not listed here — they hold it by virtue of
            being a platform owner, a platform admin, or the owner of the
            business, and that cannot be withdrawn from this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody has been granted access. Only the people who hold it by
              role can reach the console.
            </p>
          ) : (
            <div className="divide-y">
              {rows.map((g) => (
                <div key={g.grant_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm">
                      {g.display_name ?? g.username ?? g.user_id.slice(0, 8)}
                      {g.can_delegate && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          may appoint others
                        </Badge>
                      )}
                      {g.revoked_at && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          withdrawn
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.tenant_name ?? "platform-wide"} · granted{" "}
                      {new Date(g.granted_at).toLocaleDateString()}
                      {g.note ? ` · ${g.note}` : ""}
                      {g.revocation_reason ? ` · withdrawn: ${g.revocation_reason}` : ""}
                    </p>
                  </div>
                  {!g.revoked_at && (
                    <form action={revokeConsoleAccessForm} className="flex items-center gap-2">
                      <input type="hidden" name="user_id" value={g.user_id} />
                      <Input name="reason" placeholder="Reason" className="w-44" required />
                      <Button type="submit" variant="ghost" size="sm">
                        Withdraw
                      </Button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            <a href={`?history=${showHistory ? "0" : "1"}`} className="underline">
              {showHistory ? "Hide withdrawn grants" : "Show withdrawn grants"}
            </a>{" "}
            — a withdrawn grant is kept rather than deleted, because who could
            approve a payout last quarter is exactly what an audit asks.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

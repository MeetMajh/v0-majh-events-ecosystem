import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * What this business sold on someone else's behalf.
 *
 * This is the other half of attribution, and it exists because of a
 * structural fact rather than a preference: MAJH EVENTS is a row in the
 * COMMERCIAL registry (public.tenants) and has no row in the OPERATING
 * registry (core.tenants). It sells CarBarDMV's services; CarBarDMV does
 * the work and records it. So the sale lives in a schema this business has
 * no identity in, and no row-level policy could ever admit it.
 *
 * `public.sales_on_my_behalf` resolves that. It is a thin wrapper over a
 * SECURITY DEFINER function whose authorization lives in its own body: the
 * caller must own, or hold an accepted membership of, the selling business,
 * and the FULFILLING tenant must have opened the read by activating
 * `commercial_attribution`. The party whose data it is controls the
 * disclosure, which is also the right answer commercially.
 *
 * What is deliberately NOT here: anything about the fulfiller's operations
 * beyond the sales this business is party to. No stock, no shifts, no other
 * sellers' figures.
 */

function money(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "—"
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100)
}

export const dynamic = "force-dynamic"

export default async function MySalesPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Which businesses may this person act for? Answered by the commercial
  // registry — ownership, or an ACCEPTED membership. An unaccepted
  // invitation is not a membership.
  const { data: businesses, error: bizError } = await supabase.rpc("my_selling_tenants")
  const list = (businesses ?? []) as { tenant_id: string; name: string; slug: string; via: string }[]

  if (bizError) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-semibold">Sales on our behalf</h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This could not be loaded: {bizError.message}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-xl font-semibold">Sales on our behalf</h1>
        <Card>
          <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>You are not an owner or accepted member of any business here.</p>
            <p>
              This page shows what another business sold on behalf of one of
              yours. It appears once you own or belong to one.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selected = list.find((b) => b.tenant_id === sp.business) ?? list[0]

  const [{ data: summary }, { data: sales }] = await Promise.all([
    supabase.rpc("my_sales_summary", { p_selling_tenant: selected.tenant_id }),
    supabase.rpc("sales_on_my_behalf", { p_selling_tenant: selected.tenant_id }),
  ])

  const rows = (sales ?? []) as {
    attribution_id: string
    fulfilled_by: string
    subject_type: string
    basis: string
    channel: string | null
    amount_cents: number | null
    currency: string | null
    occurred_on: string | null
    external_ref: string | null
  }[]
  const totals = (summary ?? []) as {
    fulfilled_by: string
    currency: string
    sales: number
    gross_cents: number
  }[]

  const basisLabel: Record<string, string> = {
    group_service: "contracted service, in the group",
    contracted_partner: "under contract",
    referral: "referred",
  }

  return (
    <div className="space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Sales on our behalf</h1>
        <p className="text-sm text-muted-foreground">
          What another business sold for {selected.name}, as that business
          recorded it. These are their figures, not a second set of books —
          which is why they agree.
        </p>
      </header>

      {list.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {list.map((b) => (
            <Link
              key={b.tenant_id}
              href={`/dashboard/my-sales?business=${b.tenant_id}`}
              className={
                b.tenant_id === selected.tenant_id
                  ? "rounded-md border border-primary px-3 py-1.5 text-sm"
                  : "rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
              }
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}

      {/* ───────────── totals, computed once, server-side ───────────── */}
      {totals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {totals.map((t, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Fulfilled by {t.fulfilled_by}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {money(t.gross_cents, t.currency ?? "USD")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.sales} {Number(t.sales) === 1 ? "sale" : "sales"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ───────────── the sales themselves ───────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Every sale</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Nothing has been attributed to {selected.name} yet.</p>
              <p>
                A sale appears here when the business that fulfilled it records
                that {selected.name} sold it — and only if that business has
                opened this read. Their work, their disclosure.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((s) => (
                <div key={s.attribution_id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm">
                      {s.subject_type.replace("_", " ")} · fulfilled by {s.fulfilled_by}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.occurred_on ?? "no date recorded"}
                      {s.channel ? ` · ${s.channel}` : ""}
                      {s.external_ref ? ` · ref ${s.external_ref}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <p className="text-sm font-medium">
                      {money(s.amount_cents, s.currency ?? "USD")}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {basisLabel[s.basis] ?? s.basis}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-6 text-xs text-muted-foreground">
          <p>
            <strong>What this does not show.</strong> Only sales fulfilled by a
            business that keeps its operations on this platform. If{" "}
            {selected.name} fulfils something itself, that is not recorded here
            — there is nothing to read, and inventing it would be worse than
            the gap.
          </p>
          <p>
            Commission, where a rate is agreed, is recorded by the fulfilling
            business as an obligation and posted when they approve it. It is
            not deducted from these figures: this is what was sold, not what is
            owed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

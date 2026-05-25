import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Target, TrendingUp, Filter } from "lucide-react"
import { NewSegmentForm } from "@/components/carbardmv/new-segment-form"

export const metadata = { title: "Customer Segments | CARBARDMV" }

export default async function SegmentsPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  // Fetch segments with member counts
  const { data: segments } = await supabase
    .from("crm_segments")
    .select("*, crm_segment_members(count)")
    .order("created_at", { ascending: false })

  // Get total client count for percentage calculations
  const { count: totalClients } = await supabase
    .from("cb_clients")
    .select("*", { count: "exact", head: true })

  // Fetch quick stats
  const { data: vipClients } = await supabase
    .from("cb_clients")
    .select("id", { count: "exact", head: true })
    .eq("status", "vip")

  const { data: activeClients } = await supabase
    .from("cb_clients")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")

  const { data: highValueClients } = await supabase
    .from("cb_clients")
    .select("id", { count: "exact", head: true })
    .gte("total_revenue_cents", 100000) // $1000+

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Segments</h1>
          <p className="text-sm text-muted-foreground">Group clients for targeted marketing and analysis</p>
        </div>
        <NewSegmentForm />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Clients</p>
              <p className="text-lg font-semibold">{totalClients || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Target className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">VIP Clients</p>
              <p className="text-lg font-semibold">{vipClients?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Clients</p>
              <p className="text-lg font-semibold">{activeClients?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Filter className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">High Value ($1k+)</p>
              <p className="text-lg font-semibold">{highValueClients?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segments List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Your Segments</h2>
        {segments && segments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {segments.map((segment: any) => {
              const memberCount = segment.crm_segment_members?.[0]?.count || segment.member_count || 0
              const percentage = totalClients ? Math.round((memberCount / totalClients) * 100) : 0
              
              return (
                <Card key={segment.id} className="transition-colors hover:border-primary/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{segment.name}</CardTitle>
                      <Badge variant={segment.is_dynamic ? "outline" : "secondary"} className="text-[10px]">
                        {segment.is_dynamic ? "Dynamic" : "Static"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {segment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{segment.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{memberCount}</span>
                        <span className="text-muted-foreground">members</span>
                      </span>
                      <span className="text-muted-foreground">{percentage}% of total</span>
                    </div>
                    {/* Show criteria summary */}
                    {segment.criteria && Object.keys(segment.criteria).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {segment.criteria.min_lifetime_value && (
                          <Badge variant="secondary" className="text-[10px]">
                            LTV: ${(segment.criteria.min_lifetime_value / 100).toLocaleString()}+
                          </Badge>
                        )}
                        {segment.criteria.status && (
                          <Badge variant="secondary" className="text-[10px]">
                            Status: {Array.isArray(segment.criteria.status) ? segment.criteria.status.join(", ") : segment.criteria.status}
                          </Badge>
                        )}
                        {segment.criteria.city && (
                          <Badge variant="secondary" className="text-[10px]">
                            City: {segment.criteria.city}
                          </Badge>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Created {formatDate(segment.created_at)}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Filter className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-4 text-center text-muted-foreground">
                No segments created yet.<br />
                Create segments to group clients for targeted marketing.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

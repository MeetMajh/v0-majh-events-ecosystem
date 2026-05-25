import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getOrganizerRequests, approveOrganizerRequest, rejectOrganizerRequest } from "@/lib/admin-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle, XCircle, Clock, UserCheck, Users } from "lucide-react"
import { format } from "date-fns"

export const metadata = {
  title: "TO Requests | Admin",
  description: "Manage tournament organizer requests",
}

async function checkAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: role } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()

  if (!role || !["owner", "manager"].includes(role.role)) {
    redirect("/dashboard")
  }
  return user
}

export default async function OrganizersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; filter?: string }>
}) {
  await checkAccess()
  const params = await searchParams
  
  const filter = params.filter || "pending"
  const requests = await getOrganizerRequests(filter === "all" ? undefined : filter)
  
  // Get stats
  const allRequests = await getOrganizerRequests()
  const pendingCount = allRequests.filter(r => r.status === "pending").length
  const approvedCount = allRequests.filter(r => r.status === "approved").length
  const rejectedCount = allRequests.filter(r => r.status === "rejected").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">TO Requests</h1>
        <p className="text-sm text-muted-foreground">
          Review and manage tournament organizer applications
        </p>
      </div>

      {params.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {params.error}
        </div>
      )}

      {params.success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          {params.success}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{approvedCount}</p>
              <p className="text-xs text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{rejectedCount}</p>
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <a
          href="/dashboard/admin/organizers?filter=pending"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === "pending"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Pending ({pendingCount})
        </a>
        <a
          href="/dashboard/admin/organizers?filter=approved"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === "approved"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Approved
        </a>
        <a
          href="/dashboard/admin/organizers?filter=rejected"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === "rejected"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Rejected
        </a>
        <a
          href="/dashboard/admin/organizers?filter=all"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All
        </a>
      </div>

      {/* Requests List */}
      {requests.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">No {filter !== "all" ? filter : ""} requests found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id} className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={request.user?.avatar_url ?? undefined} />
                      <AvatarFallback>
                        {request.user?.display_name?.[0]?.toUpperCase() ?? "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">
                        {request.user?.display_name || `${request.user?.first_name} ${request.user?.last_name}`}
                      </CardTitle>
                      <CardDescription>
                        Applied {format(new Date(request.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={
                      request.status === "pending"
                        ? "outline"
                        : request.status === "approved"
                        ? "default"
                        : "destructive"
                    }
                    className={
                      request.status === "pending"
                        ? "border-amber-500 text-amber-500"
                        : request.status === "approved"
                        ? "bg-green-500/20 text-green-600 border-green-500/30"
                        : ""
                    }
                  >
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {request.reason && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Why they want to organize:</p>
                    <p className="text-sm text-foreground">{request.reason}</p>
                  </div>
                )}
                
                {request.experience && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Experience:</p>
                    <p className="text-sm text-foreground">{request.experience}</p>
                  </div>
                )}
                
                {request.games_of_interest && request.games_of_interest.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Games of interest:</p>
                    <div className="flex flex-wrap gap-1">
                      {request.games_of_interest.map((game: string) => (
                        <Badge key={game} variant="secondary" className="text-xs">
                          {game}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {request.status !== "pending" && request.reviewer && (
                  <div className="border-t border-border pt-3 mt-3">
                    <p className="text-xs text-muted-foreground">
                      {request.status === "approved" ? "Approved" : "Rejected"} by {request.reviewer.first_name} {request.reviewer.last_name}
                      {request.reviewed_at && ` on ${format(new Date(request.reviewed_at), "MMM d, yyyy")}`}
                    </p>
                    {request.review_notes && (
                      <p className="text-sm text-foreground mt-1">{request.review_notes}</p>
                    )}
                  </div>
                )}
                
                {request.status === "pending" && (
                  <div className="flex gap-2 pt-2">
                    <form action={approveOrganizerRequest} className="flex-1">
                      <input type="hidden" name="request_id" value={request.id} />
                      <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    </form>
                    <form action={rejectOrganizerRequest} className="flex-1">
                      <input type="hidden" name="request_id" value={request.id} />
                      <Button type="submit" variant="destructive" className="w-full">
                        <XCircle className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

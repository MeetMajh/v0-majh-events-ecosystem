import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { assignStaffRole, removeStaffRole, cancelInvitation, resendInvitation } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Trash2, ShieldCheck, Shield, User, Mail, Clock, RefreshCw, X, CheckCircle2, UserPlus } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

const ROLE_ICONS: Record<string, any> = {
  owner: ShieldCheck,
  manager: Shield,
  organizer: UserPlus,
  staff: User,
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  manager: "bg-blue-500/10 text-blue-500",
  organizer: "bg-green-500/10 text-green-500",
  staff: "bg-secondary text-secondary-foreground",
}

export default async function StaffAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  await requireRole(["owner", "manager"])
  const params = await searchParams
  const supabase = await createClient()

  const { data: staffRoles } = await supabase
    .from("staff_roles")
    .select("*, profiles(first_name, last_name)")
    .order("created_at")

  // Get emails from auth for each staff member
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(authUsers?.users?.map((u) => [u.id, u.email]) ?? [])
  
  // Get pending staff invitations
  const { data: pendingInvitations } = await supabase
    .from("invitations")
    .select("*")
    .eq("invitation_type", "staff")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
        <p className="text-sm text-muted-foreground">Assign roles to team members</p>
      </div>

      {params.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {params.error}
        </div>
      )}
      
      {params.success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-600 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {params.success}
        </div>
      )}

      {/* Add Staff Form */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold text-foreground">Add / Update Staff Role</h2>
        <form action={assignStaffRole} className="flex flex-wrap items-end gap-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="email">User Email</Label>
            <Input id="email" name="email" type="email" required placeholder="staff@example.com" />
          </div>
          <div className="w-40 space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="staff" className="bg-card">Staff</option>
              <option value="organizer" className="bg-card">Tournament Organizer</option>
              <option value="manager" className="bg-card">Manager</option>
              <option value="owner" className="bg-card">Owner</option>
            </select>
          </div>
          <Button type="submit">Assign Role</Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          <Mail className="inline h-3 w-3 mr-1" />
          If the user hasn&apos;t signed up yet, an invitation will be sent to their email.
        </p>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations && pendingInvitations.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Pending Invitations ({pendingInvitations.length})
          </h2>
          <div className="space-y-3">
            {pendingInvitations.map((inv: any) => {
              const Icon = ROLE_ICONS[inv.role] || User
              return (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={ROLE_COLORS[inv.role]} variant="secondary">
                      <Icon className="mr-1 h-3 w-3" />
                      {inv.role}
                    </Badge>
                    <div className="flex gap-1">
                      <form action={resendInvitation}>
                        <input type="hidden" name="invitation_id" value={inv.id} />
                        <Button variant="ghost" size="sm" title="Resend invitation">
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                      <form action={cancelInvitation}>
                        <input type="hidden" name="invitation_id" value={inv.id} />
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" title="Cancel invitation">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffRoles?.map((sr: any) => {
              const Icon = ROLE_ICONS[sr.role] || User
              return (
                <tr key={sr.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {sr.profiles?.first_name} {sr.profiles?.last_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emailMap.get(sr.user_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[sr.role]}`}>
                      <Icon className="h-3 w-3" />
                      {sr.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={removeStaffRole}>
                      <input type="hidden" name="user_id" value={sr.user_id} />
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

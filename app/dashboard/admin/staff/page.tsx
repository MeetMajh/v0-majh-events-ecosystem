import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { assignStaffRole, removeStaffRole } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, ShieldCheck, Shield, User } from "lucide-react"

const ROLE_ICONS: Record<string, any> = {
  owner: ShieldCheck,
  manager: Shield,
  staff: User,
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-primary/10 text-primary",
  manager: "bg-accent/10 text-accent",
  staff: "bg-secondary text-secondary-foreground",
}

export default async function StaffAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  await requireRole(["owner"])
  const params = await searchParams
  const supabase = await createClient()

  const { data: staffRoles } = await supabase
    .from("staff_roles")
    .select("*, profiles(first_name, last_name)")
    .order("created_at")

  // Get emails from auth for each staff member
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const emailMap = new Map(authUsers?.users?.map((u) => [u.id, u.email]) ?? [])

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
              <option value="manager" className="bg-card">Manager</option>
              <option value="owner" className="bg-card">Owner</option>
            </select>
          </div>
          <Button type="submit">Assign Role</Button>
        </form>
      </div>

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

import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { createUserManually, deleteUser, assignStaffRole } from "@/lib/admin-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  UserPlus, 
  Mail, 
  Calendar,
  ShieldCheck, 
  Shield, 
  User,
  Trash2,
  CheckCircle2,
  Clock,
  Search
} from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"

const ROLE_ICONS: Record<string, any> = {
  owner: ShieldCheck,
  manager: Shield,
  organizer: UserPlus,
  staff: User,
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-primary/10 text-primary border-primary/30",
  manager: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  organizer: "bg-green-500/10 text-green-500 border-green-500/30",
  staff: "bg-secondary text-secondary-foreground border-border",
}

export default async function UsersAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; search?: string }>
}) {
  await requireRole(["owner", "manager"])
  const params = await searchParams
  const supabase = await createClient()

  // Get all users from auth
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  
  // Get profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
  
  // Get staff roles
  const { data: staffRoles } = await supabase
    .from("staff_roles")
    .select("user_id, role")
  
  const staffMap = new Map(staffRoles?.map(sr => [sr.user_id, sr.role]) ?? [])
  const profileMap = new Map(profiles?.map(p => [p.id, p]) ?? [])

  // Combine data
  let users = authUsers?.users?.map(user => ({
    id: user.id,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    profile: profileMap.get(user.id),
    staff_role: staffMap.get(user.id),
  })) ?? []

  // Filter by search
  if (params.search) {
    const search = params.search.toLowerCase()
    users = users.filter(u => 
      u.email?.toLowerCase().includes(search) ||
      u.profile?.first_name?.toLowerCase().includes(search) ||
      u.profile?.last_name?.toLowerCase().includes(search) ||
      u.profile?.display_name?.toLowerCase().includes(search)
    )
  }

  // Sort by created_at descending
  users.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Stats
  const totalUsers = authUsers?.users?.length ?? 0
  const verifiedUsers = authUsers?.users?.filter(u => u.email_confirmed_at).length ?? 0
  const staffCount = staffRoles?.length ?? 0
  const recentUsers = authUsers?.users?.filter(u => {
    const created = new Date(u.created_at)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return created > weekAgo
  }).length ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <p className="text-sm text-muted-foreground">View and manage all platform users</p>
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
              <p className="text-xs text-muted-foreground">Total Users</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{verifiedUsers}</p>
              <p className="text-xs text-muted-foreground">Verified</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{staffCount}</p>
              <p className="text-xs text-muted-foreground">Staff Members</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{recentUsers}</p>
              <p className="text-xs text-muted-foreground">This Week</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create User Form */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            Add New User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createUserManually} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" name="email" type="email" required placeholder="user@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input id="first_name" name="first_name" placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input id="last_name" name="last_name" placeholder="Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Staff Role (Optional)</Label>
                <select
                  id="role"
                  name="role"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" className="bg-card">No role (regular user)</option>
                  <option value="staff" className="bg-card">Staff</option>
                  <option value="organizer" className="bg-card">Tournament Organizer</option>
                  <option value="manager" className="bg-card">Manager</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="send_invite" defaultChecked className="rounded border-input" />
                Send invitation email (user will set their own password)
              </label>
            </div>
            <Button type="submit">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Search */}
      <form className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            name="search" 
            placeholder="Search by email or name..." 
            defaultValue={params.search}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
      </form>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Email</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden sm:table-cell">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Joined</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Last Active</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const RoleIcon = user.staff_role ? ROLE_ICONS[user.staff_role] : null
              const name = user.profile?.display_name || 
                (user.profile?.first_name && user.profile?.last_name 
                  ? `${user.profile.first_name} ${user.profile.last_name}` 
                  : null)
              
              return (
                <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {name || "No name"}
                        </p>
                        <p className="text-xs text-muted-foreground md:hidden">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.email}</td>
                  <td className="px-4 py-3 text-center">
                    {user.email_confirmed_at ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        <Clock className="mr-1 h-3 w-3" />
                        Pending
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {user.staff_role ? (
                      <Badge className={ROLE_COLORS[user.staff_role]} variant="outline">
                        {RoleIcon && <RoleIcon className="mr-1 h-3 w-3" />}
                        {user.staff_role}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(user.created_at), "MMM d, yyyy")}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {user.last_sign_in_at ? (
                      <span className="text-xs">
                        {formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">Never</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteUser}>
                      <input type="hidden" name="user_id" value={user.id} />
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive"
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  {params.search ? "No users found matching your search." : "No users yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

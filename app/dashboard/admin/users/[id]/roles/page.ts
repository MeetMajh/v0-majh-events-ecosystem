import { redirect } from "next/navigation"
import Link from "next/link"
import { requireStaff } from "@/lib/auth/require-staff"
import { createClient, createAdminClient } from "@/lib/supabase/server"
import {
  grantRole,
  getRoleAuditLog,
  getUserRoleState,
  PLATFORM_ROLES,
  TENANT_ROLES,
} from "@/lib/auth/role-grant"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Calendar,
  Mail,
  Shield,
  AlertTriangle,
  CheckCircle2,
  History,
  Trash2,
  Building2,
  Globe,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"

// The single MAJH tenant ID — for tonight, this is hardcoded.
// In multi-tenant, this becomes a dropdown.
const DEFAULT_TENANT_ID = "8dd63bc0-1742-478e-8743-dc55ce2b7127"

// Server action: grant a platform-scoped role
async function handleGrantPlatformRole(formData: FormData) {
  "use server"
  const targetUserId = formData.get("target_user_id") as string
  const role = formData.get("role") as string
  const reason = formData.get("reason") as string

  const result = await grantRole({
    targetUserId,
    role: role === "" ? null : (role as any),
    reason,
  })

  if (result.error) {
    redirect(`/dashboard/admin/users/${targetUserId}/roles?error=${encodeURIComponent(result.error)}`)
  }

  redirect(
    `/dashboard/admin/users/${targetUserId}/roles?success=${encodeURIComponent(
      role === "" ? "Platform role removed." : `Granted platform role: ${role}`
    )}`
  )
}

// Server action: grant a tenant-scoped role
async function handleGrantTenantRole(formData: FormData) {
  "use server"
  const targetUserId = formData.get("target_user_id") as string
  const role = formData.get("role") as string
  const tenantId = formData.get("tenant_id") as string
  const reason = formData.get("reason") as string

  const result = await grantRole({
    targetUserId,
    role: role === "" ? null : (role as any),
    tenantId,
    reason,
  })

  if (result.error) {
    redirect(`/dashboard/admin/users/${targetUserId}/roles?error=${encodeURIComponent(result.error)}`)
  }

  redirect(
    `/dashboard/admin/users/${targetUserId}/roles?success=${encodeURIComponent(
      role === "" ? "Tenant role removed." : `Granted tenant role: ${role}`
    )}`
  )
}

export default async function UserRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  await requireStaff("manager")
  const { id: targetUserId } = await params
  const { error: errorParam, success: successParam } = await searchParams

  // Fetch the user's full role state
  const roleState = await getUserRoleState(targetUserId)

  if (!roleState.user) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/admin/users">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Button>
        </Link>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            User not found.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get auth user info (email, last sign in)
  let authUser: any = null
  try {
    const adminClient = createAdminClient()
    const { data } = await adminClient.auth.admin.getUserById(targetUserId)
    authUser = data?.user ?? null
  } catch {
    // ignore
  }

  // Get audit history for this user
  const { entries: auditEntries } = await getRoleAuditLog({
    targetUserId,
    limit: 20,
  })

  // Get tenant info for display
  const supabase = await createClient()
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", DEFAULT_TENANT_ID)
    .single()

  const currentTenantMembership = roleState.tenant_memberships.find(
    (m: any) => m.tenant_id === DEFAULT_TENANT_ID
  )

  // Detect drift between staff_roles and profile
  const hasDrift =
    roleState.staff_roles_role &&
    roleState.profile_role &&
    roleState.staff_roles_role.toLowerCase() !== roleState.profile_role.toLowerCase() &&
    !(roleState.staff_roles_role === "PLATFORM_OWNER" && roleState.profile_role === "PLATFORM_OWNER")

  const displayName =
    roleState.user.first_name && roleState.user.last_name
      ? `${roleState.user.first_name} ${roleState.user.last_name}`
      : authUser?.email ?? "Unnamed User"

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <Link href="/dashboard/admin/users">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Button>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
        <p className="text-sm text-muted-foreground">Manage roles and permissions</p>
      </div>

      {/* Status messages */}
      {errorParam && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorParam}</span>
        </div>
      )}
      {successParam && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-sm text-green-600 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{successParam}</span>
        </div>
      )}

      {/* Drift warning */}
      {hasDrift && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="text-amber-700 dark:text-amber-400">
            <strong>Role drift detected.</strong> This user's <code>staff_roles.role</code> ({roleState.staff_roles_role})
            and <code>profiles.role</code> ({roleState.profile_role}) disagree. Granting any role below will
            re-sync all tables.
          </div>
        </div>
      )}

      {/* User identity card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{authUser?.email ?? "No email"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Joined {format(new Date(roleState.user.created_at), "MMM d, yyyy")}
              {authUser?.last_sign_in_at && (
                <> · Last active {formatDistanceToNow(new Date(authUser.last_sign_in_at), { addSuffix: true })}</>
              )}
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-mono">{targetUserId}</div>
        </CardContent>
      </Card>

      {/* Current role state — transparent across all tables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Current Role State
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">profiles.role</p>
              <Badge variant="secondary">{roleState.profile_role ?? "—"}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">staff_roles.role</p>
              <Badge variant="secondary">{roleState.staff_roles_role ?? "—"}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">tenant_memberships ({tenant?.name ?? "MAJH"})</p>
              <Badge variant="secondary">{currentTenantMembership?.role ?? "—"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grant platform role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Platform Role
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Platform-wide authority. Grants access across all tenants.
            Use sparingly — these are operator-level roles.
          </p>
        </CardHeader>
        <CardContent>
          <form action={handleGrantPlatformRole} className="space-y-4">
            <input type="hidden" name="target_user_id" value={targetUserId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform-role">New Platform Role</Label>
                <select
                  id="platform-role"
                  name="role"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground"
                  defaultValue=""
                >
                  <option value="">— Remove platform role —</option>
                  {PLATFORM_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="platform-reason">Reason (required)</Label>
                <Input
                  id="platform-reason"
                  name="reason"
                  required
                  minLength={3}
                  placeholder="e.g., New deputy onboarded"
                />
              </div>
            </div>
            <Button type="submit" variant="default" className="gap-2">
              <Shield className="h-4 w-4" />
              Apply Platform Role
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Grant tenant role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Tenant Role
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Tenant-scoped authority. Applies only within the selected tenant.
            Currently only MAJH Events is configured — multi-tenant support is in progress.
          </p>
        </CardHeader>
        <CardContent>
          <form action={handleGrantTenantRole} className="space-y-4">
            <input type="hidden" name="target_user_id" value={targetUserId} />
            <input type="hidden" name="tenant_id" value={DEFAULT_TENANT_ID} />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="tenant-display">Tenant</Label>
                <Input
                  id="tenant-display"
                  value={tenant?.name ?? "MAJH Events"}
                  disabled
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-role">New Tenant Role</Label>
                <select
                  id="tenant-role"
                  name="role"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground"
                  defaultValue=""
                >
                  <option value="">— Remove tenant role —</option>
                  {TENANT_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-reason">Reason (required)</Label>
                <Input
                  id="tenant-reason"
                  name="reason"
                  required
                  minLength={3}
                  placeholder="e.g., Approved as organizer"
                />
              </div>
            </div>
            <Button type="submit" className="gap-2">
              <Shield className="h-4 w-4" />
              Apply Tenant Role
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Audit history for this user */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Role Change History
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            All role changes affecting this user. Most recent first.
          </p>
        </CardHeader>
        <CardContent>
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No role changes recorded for this user yet.
            </p>
          ) : (
            <div className="space-y-3">
              {auditEntries.map((entry: any) => (
                <div key={entry.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{entry.scope}</Badge>
                        <span className="text-muted-foreground">
                          {entry.old_role ?? "—"} → <strong className="text-foreground">{entry.new_role ?? "removed"}</strong>
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{entry.reason}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

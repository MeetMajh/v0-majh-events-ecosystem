"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Shield, UserCheck, Users, Crown, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { updateUserRole } from "./actions"

interface User {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  profileRole: string | null
  staffRole: string | null
  isOrganizer: boolean | null
  createdAt: string
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  "PLATFORM_OWNER": "Platform Owner",
  "PLATFORM_ADMIN": "Platform Admin",
  "TENANT_OWNER": "Organization Owner",
  "TENANT_SUPER_ADMIN": "Super Admin",
  "TENANT_ADMIN": "Admin",
  "TENANT_MANAGER": "Manager",
  "TENANT_STAFF": "Staff",
  "organizer": "Tournament Organizer",
  "user": "Regular User",
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  "PLATFORM_ADMIN": "Full platform administration access",
  "TENANT_OWNER": "Full control over organization resources",
  "TENANT_SUPER_ADMIN": "Advanced administration capabilities",
  "TENANT_ADMIN": "Standard administration access",
  "TENANT_MANAGER": "Team management and oversight",
  "TENANT_STAFF": "Basic staff access to tools",
  "organizer": "Can create and manage tournaments",
  "user": "Standard user with no special permissions",
}

const ROLE_BADGE_COLORS: Record<string, string> = {
  "PLATFORM_OWNER": "bg-gradient-to-r from-amber-500 to-orange-500 text-white",
  "PLATFORM_ADMIN": "bg-gradient-to-r from-amber-500/80 to-orange-500/80 text-white",
  "TENANT_OWNER": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "TENANT_SUPER_ADMIN": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "TENANT_ADMIN": "bg-blue-500/15 text-blue-300 border-blue-500/20",
  "TENANT_MANAGER": "bg-green-500/20 text-green-400 border-green-500/30",
  "TENANT_STAFF": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "organizer": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  "user": "bg-muted text-muted-foreground",
}

function getRoleBadge(role: string | null) {
  if (!role) return <Badge variant="outline" className="bg-muted text-muted-foreground">No Role</Badge>
  
  const colorClass = ROLE_BADGE_COLORS[role] || "bg-muted text-muted-foreground"
  const displayName = ROLE_DISPLAY_NAMES[role] || role
  
  return (
    <Badge variant="outline" className={cn("border", colorClass)}>
      {displayName}
    </Badge>
  )
}

function getEffectiveRole(user: User): string | null {
  // Staff role takes precedence
  if (user.staffRole) return user.staffRole
  // Then profile role
  if (user.profileRole) return user.profileRole
  // Check organizer flag
  if (user.isOrganizer) return "organizer"
  return "user"
}

export function PermissionManagerClient({
  users,
  assignableRoles,
  currentUserRole,
  currentUserId,
}: {
  users: User[]
  assignableRoles: string[]
  currentUserRole: string | null
  currentUserId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Filter users based on search
  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase()
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase()
    const email = (user.email || "").toLowerCase()
    return fullName.includes(searchLower) || email.includes(searchLower)
  })

  // Stats
  const stats = {
    total: users.length,
    admins: users.filter(u => 
      u.staffRole?.includes("ADMIN") || 
      u.staffRole?.includes("OWNER") ||
      u.profileRole === "admin"
    ).length,
    organizers: users.filter(u => u.isOrganizer || u.profileRole === "organizer").length,
    staff: users.filter(u => u.staffRole?.includes("STAFF") || u.profileRole === "staff").length,
  }

  const handleOpenRoleDialog = (user: User) => {
    setSelectedUser(user)
    setSelectedRole(getEffectiveRole(user) || "user")
    setIsDialogOpen(true)
  }

  const handleUpdateRole = async () => {
    if (!selectedUser || !selectedRole) return

    startTransition(async () => {
      try {
        const result = await updateUserRole(selectedUser.id, selectedRole)
        
        if (result.success) {
          toast.success("Role updated successfully")
          setIsDialogOpen(false)
          router.refresh()
        } else {
          toast.error(result.error || "Failed to update role")
        }
      } catch (error) {
        toast.error("An error occurred while updating the role")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizers</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.organizers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.staff}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and User Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
          <CardDescription>
            Search and manage user roles. You can assign roles up to your own permission level.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const effectiveRole = getEffectiveRole(user)
                    const isCurrentUser = user.id === currentUserId
                    
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                              {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">
                                {user.firstName || user.lastName 
                                  ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                  : "Unknown User"
                                }
                              </p>
                              {isCurrentUser && (
                                <span className="text-xs text-muted-foreground">(You)</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email || "No email"}
                        </TableCell>
                        <TableCell>
                          {getRoleBadge(effectiveRole)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenRoleDialog(user)}
                            disabled={isCurrentUser}
                          >
                            {isCurrentUser ? "Your Account" : "Change Role"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.firstName || selectedUser?.email || "this user"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Role</label>
              <div>{getRoleBadge(getEffectiveRole(selectedUser!))}</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">New Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {assignableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex flex-col">
                        <span>{ROLE_DISPLAY_NAMES[role] || role}</span>
                        {ROLE_DESCRIPTIONS[role] && (
                          <span className="text-xs text-muted-foreground">
                            {ROLE_DESCRIPTIONS[role]}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRole && selectedRole.includes("OWNER") && (
              <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 p-3 text-yellow-600">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">
                  This is a high-privilege role. The user will have significant administrative access.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole} disabled={isPending}>
              {isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState } from "react"
import useSWR from "swr"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, 
  UserPlus, 
  Clock, 
  Shield, 
  Crown, 
  Building,
  Megaphone,
  Store,
  Eye,
  MoreHorizontal,
  Check,
  X,
  Mail
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  manager: Users,
  staff: Users,
  member: Users,
  sponsor: Megaphone,
  venue: Building,
  vendor: Store,
  observer: Eye,
}

interface TeamManagementProps {
  tenantId: string
  tenantName: string
  currentUserId: string
  currentUserRole: string
}

export function TeamManagement({ tenantId, tenantName, currentUserId, currentUserRole }: TeamManagementProps) {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviteMessage, setInviteMessage] = useState("")
  const [isInviting, setIsInviting] = useState(false)
  
  const { data: membersData, error: membersError, mutate: mutateMembers } = useSWR(
    "/api/v1/organization/members",
    fetcher
  )
  
  const { data: requestsData, error: requestsError, mutate: mutateRequests } = useSWR(
    "/api/v1/organization/requests",
    fetcher
  )
  
  const { data: rolesData } = useSWR("/api/v1/organization/roles", fetcher)
  
  const canManageTeam = ["owner", "admin"].includes(currentUserRole)
  const canInvite = ["owner", "admin", "manager"].includes(currentUserRole)
  
  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole) return
    
    setIsInviting(true)
    try {
      const res = await fetch("/api/v1/organization/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          message: inviteMessage || undefined,
        }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        setInviteOpen(false)
        setInviteEmail("")
        setInviteRole("member")
        setInviteMessage("")
        mutateMembers()
      } else {
        alert(data.error || "Failed to send invitation")
      }
    } catch (error) {
      console.error("Invite error:", error)
      alert("Failed to send invitation")
    } finally {
      setIsInviting(false)
    }
  }
  
  const handleRequestAction = async (requestId: string, action: "approve" | "deny") => {
    try {
      const res = await fetch(`/api/v1/organization/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        mutateRequests()
        if (action === "approve") {
          mutateMembers()
        }
      } else {
        alert(data.error || `Failed to ${action} request`)
      }
    } catch (error) {
      console.error("Request action error:", error)
    }
  }
  
  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/v1/organization/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        mutateMembers()
      } else {
        alert(data.error || "Failed to update role")
      }
    } catch (error) {
      console.error("Role change error:", error)
    }
  }
  
  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return
    
    try {
      const res = await fetch(`/api/v1/organization/members/${memberId}`, {
        method: "DELETE",
      })
      
      const data = await res.json()
      
      if (data.success) {
        mutateMembers()
      } else {
        alert(data.error || "Failed to remove member")
      }
    } catch (error) {
      console.error("Remove member error:", error)
    }
  }
  
  const members = membersData?.members || []
  const requests = requestsData?.requests || []
  const roles = rolesData?.roles || []
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tenantName} Team</h1>
          <p className="text-muted-foreground">Manage team members, roles, and access requests</p>
        </div>
        
        {canInvite && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your organization
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter((r: { key: string; is_system: boolean }) => 
                          !r.is_system || currentUserRole === "owner"
                        )
                        .map((role: { key: string; name: string; description: string }) => (
                          <SelectItem key={role.key} value={role.key}>
                            <div className="flex flex-col">
                              <span>{role.name}</span>
                              <span className="text-xs text-muted-foreground">{role.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="message">Personal Message (Optional)</Label>
                  <Textarea
                    id="message"
                    placeholder="Add a personal note to your invitation..."
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInvite} disabled={isInviting || !inviteEmail}>
                  {isInviting ? "Sending..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          {canManageTeam && (
            <TabsTrigger value="requests" className="gap-2">
              <Clock className="h-4 w-4" />
              Requests ({requests.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="members" className="space-y-4">
          {membersError ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Failed to load team members
              </CardContent>
            </Card>
          ) : members.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No team members found
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {members.map((member: {
                id: string
                user_id: string
                email: string
                name: string
                avatar_url: string | null
                role_key: string
                role_name: string
                role_color: string
                title: string | null
                is_active: boolean
                accepted_at: string | null
              }) => {
                const RoleIcon = roleIcons[member.role_key] || Users
                const isCurrentUser = member.user_id === currentUserId
                
                return (
                  <Card key={member.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback>
                            {member.name?.substring(0, 2).toUpperCase() || member.email.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{member.name || member.email}</span>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{member.email}</span>
                            {member.title && (
                              <>
                                <span>-</span>
                                <span>{member.title}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant="secondary"
                          style={{ 
                            backgroundColor: member.role_color ? `${member.role_color}20` : undefined,
                            color: member.role_color || undefined,
                            borderColor: member.role_color || undefined,
                          }}
                          className="gap-1"
                        >
                          <RoleIcon className="h-3 w-3" />
                          {member.role_name}
                        </Badge>
                        
                        {canManageTeam && !isCurrentUser && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {roles.map((role: { key: string; name: string }) => (
                                <DropdownMenuItem
                                  key={role.key}
                                  onClick={() => handleRoleChange(member.id, role.key)}
                                  disabled={role.key === member.role_key}
                                >
                                  Change to {role.name}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleRemoveMember(member.id)}
                              >
                                Remove from team
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="requests" className="space-y-4">
          {requestsError ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Failed to load access requests
              </CardContent>
            </Card>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending access requests
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {requests.map((request: {
                id: string
                requester_email: string
                requester_name: string
                requested_role: string
                role_name: string
                entity_type: string
                entity_name: string | null
                message: string | null
                created_at: string
                expires_at: string
              }) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{request.requester_name}</span>
                          <Badge variant="outline">{request.entity_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{request.requester_email}</p>
                        {request.entity_name && (
                          <p className="text-sm">Organization: {request.entity_name}</p>
                        )}
                        <p className="text-sm">
                          Requesting: <Badge variant="secondary">{request.role_name}</Badge>
                        </p>
                        {request.message && (
                          <p className="mt-2 text-sm italic text-muted-foreground">
                            &quot;{request.message}&quot;
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Requested {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestAction(request.id, "deny")}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleRequestAction(request.id, "approve")}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="roles" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role: {
              key: string
              name: string
              description: string
              color: string
              is_internal: boolean
              is_system: boolean
            }) => {
              const RoleIcon = roleIcons[role.key] || Users
              const permissions = rolesData?.permissions_by_role?.[role.key] || []
              
              return (
                <Card key={role.key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${role.color}20` }}
                      >
                        <RoleIcon className="h-4 w-4" style={{ color: role.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{role.name}</CardTitle>
                        <div className="flex gap-1">
                          {role.is_internal && (
                            <Badge variant="outline" className="text-xs">Internal</Badge>
                          )}
                          {role.is_system && (
                            <Badge variant="outline" className="text-xs">System</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-3">{role.description}</CardDescription>
                    <div className="text-xs text-muted-foreground">
                      {permissions.length} permissions
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

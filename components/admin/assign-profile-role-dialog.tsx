'use client'

import { useState } from 'react'
import { assignProfileRole } from '@/lib/role-actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Shield, Loader2 } from 'lucide-react'

interface AssignProfileRoleDialogProps {
  userId: string
  userName: string
  currentRole: string | null
}

const AVAILABLE_ROLES = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'player', label: 'Player' },
  { value: 'creator', label: 'Creator' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
]

export function AssignProfileRoleDialog({
  userId,
  userName,
  currentRole,
}: AssignProfileRoleDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleAssign = async () => {
    if (!selectedRole) {
      setError('Please select a role')
      return
    }

    if (selectedRole === currentRole) {
      setError('User already has this role')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    const result = await assignProfileRole(userId, selectedRole)

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(result.message || 'Role assigned successfully')
      setTimeout(() => {
        setOpen(false)
        setSelectedRole('')
        window.location.reload()
      }, 1500)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          title="Assign profile role directly (admin only)"
        >
          <Shield className="h-4 w-4" />
          Assign Role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Profile Role</DialogTitle>
          <DialogDescription>
            Directly assign a profile role to {userName}. This bypasses the role request process.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-muted-foreground">
              <strong>Current Role:</strong> {currentRole || 'None'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-select">New Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger id="role-select">
                <SelectValue placeholder="Select a role..." />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ROLES.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
              {success}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssign}
              disabled={loading || !selectedRole}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Assigning...' : 'Assign Role'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

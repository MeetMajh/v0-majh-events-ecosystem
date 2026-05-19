'use client'

import { useState } from 'react'
import { submitRoleRequest } from '@/lib/role-actions'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const AVAILABLE_ROLES = ['player', 'creator', 'organizer', 'moderator']
const ROLE_DESCRIPTIONS: Record<string, string> = {
  player: 'Participate in tournaments and track your performance',
  creator: 'Upload content, streams, and clips to the platform',
  organizer: 'Create and manage tournaments and events',
  moderator: 'Help moderate community content and interactions',
}

interface RoleRequestDialogProps {
  currentRole: string | null
  onSuccess?: () => void
}

export function RoleRequestDialog({ currentRole, onSuccess }: RoleRequestDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedRole) {
      setError('Please select a role')
      setLoading(false)
      return
    }

    if (!reason.trim()) {
      setError('Please provide a reason for your request')
      setLoading(false)
      return
    }

    const result = await submitRoleRequest(selectedRole, reason)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
      setSelectedRole('')
      setReason('')
      onSuccess?.()
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
      }, 2000)
    }

    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Request Role Change</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Request a Role Change</DialogTitle>
          <DialogDescription>
            Request to change your account role. An admin will review your request and respond within 24-48 hours.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Request Submitted!</h3>
            <p className="text-sm text-muted-foreground text-center">
              Your role change request has been submitted. You'll be notified once an admin reviews it.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Current Role</label>
              <div className="flex gap-2">
                {currentRole ? (
                  <Badge variant="secondary" className="text-base">
                    {currentRole}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-base">
                    No role assigned
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium text-foreground">
                Requested Role *
              </label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.filter((r) => r !== currentRole).map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole && (
                <p className="text-xs text-muted-foreground mt-1">
                  {ROLE_DESCRIPTIONS[selectedRole]}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-medium text-foreground">
                Why do you want this role? *
              </label>
              <Textarea
                id="reason"
                placeholder="Tell us why you'd like this role and what you plan to do with it..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-24 resize-none"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

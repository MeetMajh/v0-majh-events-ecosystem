'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { approveRoleRequest, denyRoleRequest } from '@/lib/role-actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'

interface RoleRequest {
  id: string
  user_id: string
  current_role: string | null
  requested_role: string
  reason: string | null
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  userEmail?: string
  userName?: string
}

export function RoleRequestsList() {
  const [requests, setRequests] = useState<RoleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedRequest, setSelectedRequest] = useState<RoleRequest | null>(null)
  const [showDenyDialog, setShowDenyDialog] = useState(false)
  const [denyReason, setDenyReason] = useState('')

  const supabase = createClient()

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('role_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch user emails for each request
      const requestsWithUsers = await Promise.all(
        (data || []).map(async (req) => {
          const {
            data: { users },
          } = await supabase.auth.admin.listUsers()
          const user = users?.find((u) => u.id === req.user_id)
          return {
            ...req,
            userEmail: user?.email,
            userName: user?.user_metadata?.display_name || user?.email?.split('@')[0],
          }
        })
      )

      setRequests(requestsWithUsers)
    } catch (error) {
      console.error('Error loading requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (request: RoleRequest) => {
    setActionLoading(request.id)
    const result = await approveRoleRequest(request.id, request.requested_role)

    if (!result.error) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id
            ? { ...r, status: 'approved' as const }
            : r
        )
      )
    } else {
      alert('Error approving request: ' + result.error)
    }
    setActionLoading(null)
  }

  const handleDeny = async () => {
    if (!selectedRequest) return

    setActionLoading(selectedRequest.id)
    const result = await denyRoleRequest(selectedRequest.id, denyReason)

    if (!result.error) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? { ...r, status: 'denied' as const }
            : r
        )
      )
      setShowDenyDialog(false)
      setDenyReason('')
      setSelectedRequest(null)
    } else {
      alert('Error denying request: ' + result.error)
    }
    setActionLoading(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const reviewedRequests = requests.filter((r) => r.status !== 'pending')

  return (
    <div className="space-y-8">
      {/* Pending Requests */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Pending Requests ({pendingRequests.length})</h3>

        {pendingRequests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No pending role requests</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{request.userName}</p>
                    <p className="text-xs text-muted-foreground">{request.userEmail}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {request.status}
                  </Badge>
                </div>

                <div className="mb-3 space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Current Role: </span>
                    <span className="font-medium">
                      {request.current_role ? (
                        <span className="capitalize">{request.current_role}</span>
                      ) : (
                        <span className="text-muted-foreground italic">None</span>
                      )}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Requested Role: </span>
                    <span className="font-medium capitalize">{request.requested_role}</span>
                  </div>
                </div>

                {request.reason && (
                  <div className="mb-4 rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Reason:</p>
                    <p className="text-sm text-foreground">{request.reason}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleApprove(request)}
                    disabled={actionLoading === request.id}
                  >
                    {actionLoading === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(request)
                      setShowDenyDialog(true)
                    }}
                    disabled={actionLoading === request.id}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Deny
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed Requests */}
      {reviewedRequests.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Reviewed Requests</h3>
          <div className="space-y-2">
            {reviewedRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{request.userName}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.current_role ? (
                      <>
                        {request.current_role} → {request.requested_role}
                      </>
                    ) : (
                      <>→ {request.requested_role}</>
                    )}
                  </p>
                </div>
                <Badge
                  variant={request.status === 'approved' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {request.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deny Dialog */}
      <AlertDialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deny Role Request</AlertDialogTitle>
            <AlertDialogDescription>
              Provide a reason for denying this request. The user will see this reason.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Reason for denial..."
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              className="min-h-20"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeny}
              disabled={!denyReason.trim() || actionLoading !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Denying...' : 'Deny Request'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

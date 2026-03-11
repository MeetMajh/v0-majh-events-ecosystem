"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { joinTeam, leaveTeam, inviteTeamMember, removeTeamMember } from "@/lib/esports-actions"
import { UserPlus, UserMinus, LogOut, LogIn, Loader2 } from "lucide-react"

interface TeamActionsProps {
  teamId: string
  memberId?: string
  memberName?: string
  isMember: boolean
  isCaptain: boolean
  isLoggedIn: boolean
  showRemoveOnly?: boolean
  showInviteForm?: boolean
}

export function TeamActions({
  teamId,
  memberId,
  memberName,
  isMember,
  isCaptain,
  isLoggedIn,
  showRemoveOnly,
  showInviteForm,
}: TeamActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")

  const handleJoin = () => {
    setError(null)
    startTransition(async () => {
      const result = await joinTeam(teamId)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleLeave = () => {
    setError(null)
    startTransition(async () => {
      const result = await leaveTeam(teamId)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleRemove = () => {
    if (!memberId) return
    setError(null)
    startTransition(async () => {
      const result = await removeTeamMember(teamId, memberId)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await inviteTeamMember(teamId, inviteEmail.trim())
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess("Member invited successfully!")
        setInviteEmail("")
        router.refresh()
      }
    })
  }

  // Show remove button only (for captain viewing member list)
  if (showRemoveOnly && isCaptain && memberId) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemove}
        disabled={isPending}
        className="text-destructive hover:text-destructive"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
        <span className="sr-only">Remove {memberName}</span>
      </Button>
    )
  }

  // Show invite form (for captain section)
  if (showInviteForm && isCaptain) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <form onSubmit={handleInvite} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Invite by Email</Label>
            <div className="flex gap-2">
              <Input
                id="invite-email"
                type="email"
                placeholder="player@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                <span className="ml-2">Invite</span>
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-500">{success}</p>}
        </form>
      </div>
    )
  }

  // Not logged in - prompt to sign in
  if (!isLoggedIn) {
    return (
      <Button variant="outline" asChild>
        <a href="/auth/login">
          <LogIn className="mr-2 h-4 w-4" />
          Sign in to Join
        </a>
      </Button>
    )
  }

  // Already a member (not captain) - show leave button
  if (isMember && !isCaptain) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button variant="outline" onClick={handleLeave} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          Leave Team
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Not a member - show join button
  if (!isMember) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={handleJoin} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          Join Team
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // Captain - no action button needed here (handled by showInviteForm)
  return null
}

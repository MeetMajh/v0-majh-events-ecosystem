"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { registerForTournament, withdrawFromTournament } from "@/lib/esports-actions"
import { Loader2 } from "lucide-react"

export function RegistrationButton({
  tournamentId,
  isRegistered,
  isOpen,
  isFull,
}: {
  tournamentId: string
  isRegistered: boolean
  isOpen: boolean
  isFull: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(isRegistered)

  if (!isOpen) {
    return <Button disabled variant="outline">Registration Closed</Button>
  }

  const handleAction = () => {
    setError(null)
    startTransition(async () => {
      const result = registered
        ? await withdrawFromTournament(tournamentId)
        : await registerForTournament(tournamentId)

      if (result.error) {
        setError(result.error)
      } else {
        setRegistered(!registered)
      }
    })
  }

  return (
    <div>
      <Button
        onClick={handleAction}
        disabled={pending || (isFull && !registered)}
        variant={registered ? "outline" : "default"}
        className={registered ? "" : ""}
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {registered ? "Withdraw" : isFull ? "Tournament Full" : "Register Now"}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}

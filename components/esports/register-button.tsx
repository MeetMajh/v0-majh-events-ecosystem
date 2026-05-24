"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { registerForTournament, withdrawFromTournament } from "@/lib/esports-actions"

type RegisterButtonProps = {
  tournamentId: string
  isRegistered: boolean
  isOpen: boolean
  isFull: boolean
}

export function RegisterButton({ tournamentId, isRegistered, isOpen, isFull }: RegisterButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRegister() {
    setError(null)
    startTransition(async () => {
      const result = await registerForTournament(tournamentId)
      if (result.error) setError(result.error)
    })
  }

  function handleWithdraw() {
    setError(null)
    startTransition(async () => {
      const result = await withdrawFromTournament(tournamentId)
      if (result.error) setError(result.error)
    })
  }

  if (isRegistered) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Registered
          </span>
          {isOpen && (
            <Button variant="ghost" size="sm" onClick={handleWithdraw} disabled={isPending}>
              {isPending ? "Withdrawing..." : "Withdraw"}
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  if (!isOpen) {
    return (
      <Button disabled className="opacity-50">
        Registration Closed
      </Button>
    )
  }

  if (isFull) {
    return (
      <Button disabled className="opacity-50">
        Tournament Full
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleRegister} disabled={isPending}>
        {isPending ? "Registering..." : "Register Now"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

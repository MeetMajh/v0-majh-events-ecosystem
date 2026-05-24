"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { joinTournament, leaveTournament } from "@/lib/wallet-tournament-actions"
import { Loader2, Wallet } from "lucide-react"
import { toast } from "sonner"

export function RegistrationButton({
  tournamentId,
  isRegistered,
  isOpen,
  isFull,
  entryFeeCents = 0,
}: {
  tournamentId: string
  isRegistered: boolean
  isOpen: boolean
  isFull: boolean
  entryFeeCents?: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(isRegistered)

  if (!isOpen) {
    return <Button disabled variant="outline">Registration Closed</Button>
  }

  const handleAction = () => {
    setError(null)
    startTransition(async () => {
      if (registered) {
        // Leave tournament
        const result = await leaveTournament(tournamentId)
        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          setRegistered(false)
          if (result.refunded) {
            toast.success("Withdrawn and refunded to wallet")
          } else {
            toast.success("Successfully withdrawn from tournament")
          }
          router.refresh()
        }
      } else {
        // Join tournament using wallet
        const result = await joinTournament(tournamentId)
        
        if (result.error) {
          setError(result.error)
          toast.error(result.error)
          
          // If insufficient funds, suggest adding funds
          if (result.insufficientFunds) {
            toast.info("Add funds to your wallet to register", {
              action: {
                label: "Add Funds",
                onClick: () => router.push("/dashboard/wallet")
              }
            })
          }
        } else {
          setRegistered(true)
          toast.success("Successfully joined tournament!")
          router.refresh()
        }
      }
    })
  }

  const buttonText = registered 
    ? "Withdraw" 
    : isFull 
      ? "Tournament Full" 
      : entryFeeCents > 0 
        ? `Join ($${(entryFeeCents / 100).toFixed(2)})` 
        : "Join Free"

  return (
    <div>
      <Button
        onClick={handleAction}
        disabled={pending || (isFull && !registered)}
        variant={registered ? "outline" : "default"}
        className="gap-2"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : entryFeeCents > 0 && !registered ? (
          <Wallet className="h-4 w-4" />
        ) : null}
        {buttonText}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { registerForTournament, withdrawFromTournament } from "@/lib/esports-actions"
import { createTournamentCheckoutSession } from "@/lib/tournament-payment-actions"
import { Loader2 } from "lucide-react"
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
        // Withdraw
        const result = await withdrawFromTournament(tournamentId)
        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else {
          setRegistered(false)
          toast.success("Successfully withdrawn from tournament")
        }
      } else {
        // Register
        const result = await registerForTournament(tournamentId)
        
        if (result.error) {
          setError(result.error)
          toast.error(result.error)
        } else if (result.requiresPayment) {
          // Redirect to payment
          toast.loading("Redirecting to payment...")
          const paymentResult = await createTournamentCheckoutSession(tournamentId)
          
          if (paymentResult.error) {
            setError(paymentResult.error)
            toast.error(paymentResult.error)
          } else if (paymentResult.checkoutUrl) {
            window.location.href = paymentResult.checkoutUrl
          }
        } else {
          setRegistered(true)
          toast.success("Successfully registered for tournament!")
        }
      }
    })
  }

  const buttonText = registered 
    ? "Withdraw" 
    : isFull 
      ? "Tournament Full" 
      : entryFeeCents > 0 
        ? `Register ($${(entryFeeCents / 100).toFixed(2)})` 
        : "Register Now"

  return (
    <div>
      <Button
        onClick={handleAction}
        disabled={pending || (isFull && !registered)}
        variant={registered ? "outline" : "default"}
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {buttonText}
      </Button>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}

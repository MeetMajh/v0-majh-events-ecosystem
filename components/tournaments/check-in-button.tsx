"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"
import { checkInPlayer } from "@/lib/tournament-controller-actions"

export function CheckInButton({
  tournamentId,
  isCheckedIn,
  checkInOpen,
}: {
  tournamentId: string
  isCheckedIn: boolean
  checkInOpen: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [checkedIn, setCheckedIn] = useState(isCheckedIn)

  if (checkedIn) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Checked In
      </Button>
    )
  }

  if (!checkInOpen) {
    return (
      <Button variant="outline" disabled>
        Check-in Not Open
      </Button>
    )
  }

  const handleCheckIn = () => {
    startTransition(async () => {
      const result = await checkInPlayer(tournamentId)
      if ("error" in result) {
        toast.error(result.error)
      } else {
        toast.success("Successfully checked in!")
        setCheckedIn(true)
        router.refresh()
      }
    })
  }

  return (
    <Button onClick={handleCheckIn} disabled={isPending}>
      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Check In
    </Button>
  )
}

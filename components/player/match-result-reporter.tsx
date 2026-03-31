"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Swords, XCircle, Loader2, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface MatchResultReporterProps {
  matchId: string
  userId: string
}

export function MatchResultReporter({ matchId, userId }: MatchResultReporterProps) {
  const [match, setMatch] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  // Fetch match info
  useEffect(() => {
    async function loadMatch() {
      setLoading(true)
      const { data, error } = await supabase
        .from("tournament_matches")
        .select(`
          *,
          player1:profiles!tournament_matches_player1_id_fkey(id, first_name, last_name),
          player2:profiles!tournament_matches_player2_id_fkey(id, first_name, last_name)
        `)
        .eq("id", matchId)
        .single()

      if (error) {
        console.error("Error fetching match:", error)
        toast.error("Failed to load match")
      } else {
        setMatch(data)
      }
      setLoading(false)
    }
    loadMatch()
  }, [matchId, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!match) {
    return (
      <div className="p-3 text-center text-sm text-muted-foreground">
        Match not found
      </div>
    )
  }

  // Determine if user is player1 or player2
  const isPlayer1 = match.player1_id === userId
  const isPlayer2 = match.player2_id === userId
  const isParticipant = isPlayer1 || isPlayer2

  // Get opponent info
  const opponent = isPlayer1 ? match.player2 : match.player1
  const opponentName = opponent 
    ? `${opponent.first_name || ""} ${opponent.last_name || ""}`.trim() || "Opponent"
    : "BYE"

  // Check current status - handle both old and new schema
  const hasResult = match.winner_id || match.loser_id || (match.draws && match.draws > 0) || match.status === "completed" || match.status === "confirmed"
  const isWinner = match.winner_id === userId
  const isLoser = match.loser_id === userId || (match.winner_id && match.winner_id !== userId && isParticipant)
  const isDraw = (match.draws && match.draws > 0 && !match.winner_id) || match.result === "draw"

  const handleResult = async (result: "win" | "lose" | "draw") => {
    if (!isParticipant) {
      toast.error("You are not a participant in this match")
      return
    }

    setSubmitting(true)

    let updates: Record<string, any> = {}
    const opponentId = isPlayer1 ? match.player2_id : match.player1_id

    // Use "completed" status for broader compatibility
    if (result === "win") {
      updates = {
        winner_id: userId,
        status: "completed",
        completed_at: new Date().toISOString(),
      }
    } else if (result === "lose") {
      updates = {
        winner_id: opponentId,
        status: "completed",
        completed_at: new Date().toISOString(),
      }
    } else if (result === "draw") {
      updates = {
        winner_id: null,
        status: "completed",
        completed_at: new Date().toISOString(),
        // These columns may not exist yet, but Supabase will ignore unknown columns
      }
    }

    const { error } = await supabase
      .from("tournament_matches")
      .update(updates)
      .eq("id", matchId)

    if (error) {
      console.error("Error updating match result:", error)
      toast.error("Failed to submit result")
    } else {
      setMatch((prev: any) => ({ ...prev, ...updates }))
      toast.success("Result submitted successfully!")
    }

    setSubmitting(false)
  }

  // Show result status if already submitted
  if (hasResult) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">vs {opponentName}</span>
            </div>
            <Badge 
              variant="outline" 
              className={
                isDraw 
                  ? "border-yellow-500/50 text-yellow-500" 
                  : isWinner 
                    ? "border-green-500/50 text-green-500" 
                    : "border-red-500/50 text-red-500"
              }
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {isDraw ? "Draw" : isWinner ? "You Won" : "You Lost"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show reporting buttons
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">vs {opponentName}</span>
          <Badge variant="outline" className="text-muted-foreground">
            Pending
          </Badge>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          Report your match result
        </p>

        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-green-500/50 hover:bg-green-500/10 hover:border-green-500 text-green-500"
            onClick={() => handleResult("win")}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Trophy className="h-4 w-4 mr-1" />
                I Won
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-yellow-500/50 hover:bg-yellow-500/10 hover:border-yellow-500 text-yellow-500"
            onClick={() => handleResult("draw")}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Swords className="h-4 w-4 mr-1" />
                Draw
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-red-500/50 hover:bg-red-500/10 hover:border-red-500 text-red-500"
            onClick={() => handleResult("lose")}
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                I Lost
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

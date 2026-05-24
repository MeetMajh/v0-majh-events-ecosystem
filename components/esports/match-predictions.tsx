"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { makeMatchPrediction, getUserPrediction, getMatchPredictions } from "@/lib/tournament-controller-actions"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Trophy, Users, TrendingUp, Check, Lock } from "lucide-react"

interface Player {
  id: string
  first_name?: string
  last_name?: string
  avatar_url?: string
}

interface PredictionData {
  id: string
  predicted_winner_id: string
  confidence: number
  is_correct?: boolean
  points_earned?: number
  user?: Player
  predicted_winner?: Player
}

export function MatchPredictions({
  matchId,
  player1,
  player2,
  matchStatus,
  className,
}: {
  matchId: string
  player1: Player | null
  player2: Player | null
  matchStatus: string
  className?: string
}) {
  const [userPrediction, setUserPrediction] = useState<PredictionData | null>(null)
  const [allPredictions, setAllPredictions] = useState<PredictionData[]>([])
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null)
  const [confidence, setConfidence] = useState(50)
  const [loading, setLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const canPredict = matchStatus === "pending"
  const hasEnded = ["confirmed", "completed"].includes(matchStatus)

  useEffect(() => {
    const supabase = createClient()
    
    // Check auth
    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user)
    })

    // Fetch user's prediction
    getUserPrediction(matchId).then(setUserPrediction)
    
    // Fetch all predictions
    getMatchPredictions(matchId).then(setAllPredictions)

    // Subscribe to new predictions
    const channel = supabase
      .channel(`predictions:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_predictions",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          getMatchPredictions(matchId).then(setAllPredictions)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId])

  const getPlayerName = (player: Player | null) => {
    if (!player) return "TBD"
    return `${player.first_name || ""} ${player.last_name || ""}`.trim() || "Unknown"
  }

  const getInitials = (player: Player | null) => {
    if (!player) return "?"
    return `${player.first_name?.[0] || ""}${player.last_name?.[0] || ""}`.toUpperCase() || "?"
  }

  // Calculate prediction stats
  const player1Predictions = allPredictions.filter((p) => p.predicted_winner_id === player1?.id)
  const player2Predictions = allPredictions.filter((p) => p.predicted_winner_id === player2?.id)
  const totalPredictions = allPredictions.length
  const player1Percentage = totalPredictions > 0 ? (player1Predictions.length / totalPredictions) * 100 : 50
  const player2Percentage = totalPredictions > 0 ? (player2Predictions.length / totalPredictions) * 100 : 50

  const handleSubmitPrediction = async () => {
    if (!selectedWinner || !isLoggedIn) return

    setLoading(true)
    const result = await makeMatchPrediction(matchId, selectedWinner, undefined, confidence)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Prediction submitted!")
      getUserPrediction(matchId).then(setUserPrediction)
      setSelectedWinner(null)
    }
  }

  // User already predicted
  if (userPrediction) {
    const predictedPlayer = userPrediction.predicted_winner_id === player1?.id ? player1 : player2
    const isCorrect = userPrediction.is_correct

    return (
      <div className={cn("rounded-xl border border-border bg-card/50 p-4", className)}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">Your Prediction</span>
          </div>
          {hasEnded && isCorrect !== undefined && (
            <Badge variant={isCorrect ? "default" : "secondary"} className={cn(isCorrect && "bg-green-500")}>
              {isCorrect ? `+${userPrediction.points_earned} pts` : "Incorrect"}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-lg bg-primary/5 p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={predictedPlayer?.avatar_url || undefined} />
            <AvatarFallback>{getInitials(predictedPlayer)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{getPlayerName(predictedPlayer)}</p>
            <p className="text-xs text-muted-foreground">{userPrediction.confidence}% confidence</p>
          </div>
          <Check className="h-5 w-5 text-green-500" />
        </div>

        {/* Prediction Stats */}
        {totalPredictions > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{getPlayerName(player1)}</span>
              <span>{getPlayerName(player2)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full">
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${player1Percentage}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${player2Percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-blue-500">{Math.round(player1Percentage)}%</span>
              <span className="text-muted-foreground">{totalPredictions} predictions</span>
              <span className="font-medium text-red-500">{Math.round(player2Percentage)}%</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Can't predict anymore
  if (!canPredict) {
    return (
      <div className={cn("rounded-xl border border-border bg-card/50 p-4", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span className="text-sm">Predictions locked</span>
        </div>

        {totalPredictions > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{getPlayerName(player1)}</span>
              <span>{getPlayerName(player2)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full">
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${player1Percentage}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${player2Percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-blue-500">{Math.round(player1Percentage)}%</span>
              <span className="text-muted-foreground">{totalPredictions} predictions</span>
              <span className="font-medium text-red-500">{Math.round(player2Percentage)}%</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Prediction form
  return (
    <div className={cn("rounded-xl border border-border bg-card/50 p-4", className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Make a Prediction</span>
        </div>
        {totalPredictions > 0 && (
          <Badge variant="secondary" className="text-xs">
            <Users className="mr-1 h-3 w-3" />
            {totalPredictions}
          </Badge>
        )}
      </div>

      {!isLoggedIn ? (
        <p className="text-center text-sm text-muted-foreground">
          Sign in to make predictions and earn points
        </p>
      ) : (
        <>
          {/* Player selection */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                selectedWinner === player1?.id
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-border hover:border-blue-500/50"
              )}
              onClick={() => setSelectedWinner(player1?.id || null)}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={player1?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(player1)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{getPlayerName(player1)}</span>
            </button>

            <button
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                selectedWinner === player2?.id
                  ? "border-red-500 bg-red-500/10"
                  : "border-border hover:border-red-500/50"
              )}
              onClick={() => setSelectedWinner(player2?.id || null)}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={player2?.avatar_url || undefined} />
                <AvatarFallback>{getInitials(player2)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{getPlayerName(player2)}</span>
            </button>
          </div>

          {/* Confidence slider */}
          {selectedWinner && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium">{confidence}%</span>
              </div>
              <Slider
                value={[confidence]}
                onValueChange={([v]) => setConfidence(v)}
                min={10}
                max={100}
                step={10}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Higher confidence = more points if correct
              </p>
            </div>
          )}

          {/* Submit button */}
          <Button
            className="w-full"
            disabled={!selectedWinner || loading}
            onClick={handleSubmitPrediction}
          >
            {loading ? "Submitting..." : "Lock In Prediction"}
          </Button>
        </>
      )}

      {/* Current prediction stats */}
      {totalPredictions > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{getPlayerName(player1)}</span>
            <span>{getPlayerName(player2)}</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full">
            <div
              className="bg-blue-500 transition-all"
              style={{ width: `${player1Percentage}%` }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{ width: `${player2Percentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-blue-500">{Math.round(player1Percentage)}%</span>
            <span className="text-muted-foreground">{totalPredictions} predictions</span>
            <span className="font-medium text-red-500">{Math.round(player2Percentage)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

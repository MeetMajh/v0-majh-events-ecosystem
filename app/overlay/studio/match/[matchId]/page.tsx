"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { cn } from "@/lib/utils"
import useSWR from "swr"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE MATCH OVERLAY - Tournament-Integrated for MAJH Studio Pro
// Auto-updates with match data, momentum badges, match point alerts
// ═══════════════════════════════════════════════════════════════════════════════

export default function LiveMatchOverlay() {
  const params = useParams()
  const matchId = params.matchId as string
  
  // Fetch match data with polling
  const { data, error } = useSWR(
    matchId ? `/api/studio/overlay/match/${matchId}` : null,
    fetcher,
    { refreshInterval: 2000 } // Poll every 2 seconds for live updates
  )
  
  const [showMatchPoint, setShowMatchPoint] = useState(false)
  const [prevScore, setPrevScore] = useState({ p1: 0, p2: 0 })
  
  // Detect score changes for animations
  useEffect(() => {
    if (data?.match) {
      const newP1 = data.match.player1_score || 0
      const newP2 = data.match.player2_score || 0
      
      if (newP1 !== prevScore.p1 || newP2 !== prevScore.p2) {
        setPrevScore({ p1: newP1, p2: newP2 })
        
        // Check for match point
        if (data.isMatchPoint) {
          setShowMatchPoint(true)
          setTimeout(() => setShowMatchPoint(false), 3000)
        }
      }
    }
  }, [data, prevScore])
  
  if (error || !data?.match) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "transparent" }}>
        <div className="text-white/50 text-sm">Loading match data...</div>
      </div>
    )
  }
  
  const { match, isMatchPoint, momentum } = data
  const player1 = match.player1 || { display_name: "Player 1" }
  const player2 = match.player2 || { display_name: "Player 2" }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "transparent" }}>
      {/* Match Point Alert */}
      {showMatchPoint && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-in zoom-in-50 duration-300">
          <div className="bg-gradient-to-r from-red-600 to-orange-500 px-8 py-4 rounded-lg shadow-2xl">
            <div className="text-white text-4xl font-black tracking-wider animate-pulse">
              MATCH POINT
            </div>
          </div>
        </div>
      )}
      
      {/* Score Bar - Bottom of Screen */}
      <div className="fixed bottom-4 left-4 right-4 flex items-center justify-center">
        <div className="flex items-center bg-black/90 rounded-lg overflow-hidden shadow-2xl border border-white/10">
          {/* Player 1 */}
          <div className={cn(
            "flex items-center gap-3 px-6 py-3 transition-all",
            momentum === "player1" && "bg-primary/20"
          )}>
            {player1.avatar_url && (
              <img 
                src={player1.avatar_url} 
                alt={player1.display_name}
                className="h-10 w-10 rounded-full border-2 border-white/20"
              />
            )}
            <div className="text-right">
              <div className="text-white font-bold text-lg">{player1.display_name}</div>
              {momentum === "player1" && (
                <div className="text-xs text-primary animate-pulse">MOMENTUM</div>
              )}
            </div>
          </div>
          
          {/* Score */}
          <div className="flex items-center gap-1 px-6 py-3 bg-primary/10">
            <div className={cn(
              "text-4xl font-black text-white transition-transform",
              match.player1_score > prevScore.p1 && "animate-bounce"
            )}>
              {match.player1_score || 0}
            </div>
            <div className="text-2xl font-bold text-white/50 mx-2">-</div>
            <div className={cn(
              "text-4xl font-black text-white transition-transform",
              match.player2_score > prevScore.p2 && "animate-bounce"
            )}>
              {match.player2_score || 0}
            </div>
          </div>
          
          {/* Player 2 */}
          <div className={cn(
            "flex items-center gap-3 px-6 py-3 transition-all",
            momentum === "player2" && "bg-primary/20"
          )}>
            <div className="text-left">
              <div className="text-white font-bold text-lg">{player2.display_name}</div>
              {momentum === "player2" && (
                <div className="text-xs text-primary animate-pulse">MOMENTUM</div>
              )}
            </div>
            {player2.avatar_url && (
              <img 
                src={player2.avatar_url} 
                alt={player2.display_name}
                className="h-10 w-10 rounded-full border-2 border-white/20"
              />
            )}
          </div>
          
          {/* Round Info */}
          <div className="px-4 py-3 bg-white/5 border-l border-white/10">
            <div className="text-xs text-white/50">ROUND</div>
            <div className="text-white font-bold">{match.round || 1}</div>
          </div>
        </div>
      </div>
      
      {/* Tournament Badge - Top Left */}
      {match.tournament && (
        <div className="fixed top-4 left-4">
          <div className="bg-black/80 px-4 py-2 rounded-lg border border-primary/30">
            <div className="text-primary font-bold text-sm">{match.tournament.name}</div>
            {match.table_number && (
              <div className="text-white/50 text-xs">Table {match.table_number}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

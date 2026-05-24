"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"

interface Standing {
  rank: number
  player: {
    id: string
    name: string
    avatar: string | null
  }
  points: number
  matchWins: number
  matchLosses: number
  gameWins: number
  gameLosses: number
  opponentWinPercentage: number
}

interface OverlayData {
  tournament: {
    name: string
    currentRound: number
    totalPlayers: number
  }
  standings: Standing[]
  settings: {
    primaryColor: string
    accentColor: string
    backgroundOpacity: number
    showTop: number
  }
}

export default function StandingsOverlayPage() {
  const params = useParams()
  const slug = params.slug as string
  const [data, setData] = useState<OverlayData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/overlay/tournament/${slug}/standings`, {
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError("Failed to load standings")
    }
  }, [slug])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [fetchData])

  if (error || !data) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        {error ? (
          <p className="text-white/50">{error}</p>
        ) : (
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        )}
      </div>
    )
  }

  const { tournament, standings, settings } = data

  return (
    <div className="min-h-screen bg-transparent p-4 font-sans">
      <div
        className="mx-auto w-96 overflow-hidden rounded-2xl shadow-2xl"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${settings.backgroundOpacity})`,
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Header */}
        <div
          className="px-4 py-3"
          style={{ backgroundColor: settings.primaryColor }}
        >
          <p className="text-center text-sm font-bold uppercase tracking-wider text-white">
            {tournament.name}
          </p>
          <p className="text-center text-xs text-white/80">
            Round {tournament.currentRound} • {tournament.totalPlayers} Players
          </p>
        </div>

        {/* Standings List */}
        <div className="divide-y divide-white/10">
          <AnimatePresence mode="popLayout">
            {standings.slice(0, settings.showTop).map((standing, index) => (
              <motion.div
                key={standing.player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Rank */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-white ${
                    standing.rank <= 3 ? "" : "bg-white/10"
                  }`}
                  style={{
                    backgroundColor:
                      standing.rank === 1
                        ? "#fbbf24"
                        : standing.rank === 2
                        ? "#9ca3af"
                        : standing.rank === 3
                        ? "#d97706"
                        : undefined,
                  }}
                >
                  {standing.rank}
                </div>

                {/* Avatar */}
                <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white/20">
                  {standing.player.avatar ? (
                    <Image
                      src={standing.player.avatar}
                      alt={standing.player.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center font-bold text-white"
                      style={{ backgroundColor: settings.primaryColor }}
                    >
                      {standing.player.name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Name & Record */}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold text-white">
                    {standing.player.name}
                  </p>
                  <p className="text-xs text-white/60">
                    {standing.matchWins}-{standing.matchLosses} ({standing.points} pts)
                  </p>
                </div>

                {/* Win Rate */}
                <div className="text-right">
                  <p
                    className="text-sm font-bold"
                    style={{ color: settings.accentColor }}
                  >
                    {standing.matchWins + standing.matchLosses > 0
                      ? Math.round(
                          (standing.matchWins /
                            (standing.matchWins + standing.matchLosses)) *
                            100
                        )
                      : 0}
                    %
                  </p>
                  <p className="text-xs text-white/40">Win Rate</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 text-center" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
          <p className="text-xs text-white/40">Powered by MAJH Events</p>
        </div>
      </div>
    </div>
  )
}

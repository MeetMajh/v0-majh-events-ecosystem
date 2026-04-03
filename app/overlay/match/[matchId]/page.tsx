"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"

interface OverlayData {
  match: {
    id: string
    status: string
    tableNumber: number | null
    isLive: boolean
    isBye: boolean
  }
  round: {
    number: number
    status: string
  }
  tournament: {
    id: string
    name: string
    slug: string
  }
  players: {
    id: string
    name: string
    avatar: string | null
    gameWins: number
    record: { wins: number; losses: number; draws: number }
  }[]
  timer: {
    remaining: number
    total: number
    isRunning: boolean
    startedAt: string | null
  }
  overlay: {
    theme: string
    layout: string
    showTimer: boolean
    showRound: boolean
    showRecords: boolean
    showAvatars: boolean
    showTournamentName: boolean
    primaryColor: string
    accentColor: string
    backgroundOpacity: number
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function MatchOverlayPage() {
  const params = useParams()
  const matchId = params.matchId as string
  const [data, setData] = useState<OverlayData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [localTimer, setLocalTimer] = useState<number>(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/overlay/match/${matchId}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch")
      const json = await res.json()
      setData(json)
      setLocalTimer(json.timer.remaining)
      setError(null)
    } catch (e) {
      setError("Failed to load match data")
    }
  }, [matchId])

  // Initial fetch and polling every 3 seconds
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Local timer countdown
  useEffect(() => {
    if (!data?.timer.isRunning) return
    const interval = setInterval(() => {
      setLocalTimer((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [data?.timer.isRunning])

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <p className="text-white/50">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-transparent">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    )
  }

  const { match, round, tournament, players, timer, overlay } = data
  const [p1, p2] = players

  // Theme-based styling
  const bgOpacity = overlay.backgroundOpacity
  const primaryColor = overlay.primaryColor
  const accentColor = overlay.accentColor

  // Standard layout (horizontal bar)
  if (overlay.layout === "standard" || overlay.layout === "compact") {
    return (
      <div className="min-h-screen bg-transparent p-4 font-sans">
        <div
          className="mx-auto max-w-4xl overflow-hidden rounded-2xl shadow-2xl"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Tournament Header */}
          {overlay.showTournamentName && (
            <div
              className="px-6 py-3 text-center"
              style={{ backgroundColor: primaryColor }}
            >
              <p className="text-sm font-bold uppercase tracking-wider text-white">
                {tournament.name}
                {overlay.showRound && ` — Round ${round.number}`}
                {match.tableNumber && ` — Table ${match.tableNumber}`}
              </p>
            </div>
          )}

          {/* Players + Score */}
          <div className="flex items-center justify-between px-8 py-6">
            {/* Player 1 */}
            <div className="flex items-center gap-4">
              {overlay.showAvatars && (
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-4 border-white/20">
                  {p1.avatar ? (
                    <Image
                      src={p1.avatar}
                      alt={p1.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {p1.name.charAt(0)}
                    </div>
                  )}
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-white">{p1.name}</p>
                {overlay.showRecords && (
                  <p className="text-sm text-white/60">
                    {p1.record.wins}-{p1.record.draws > 0 ? `${p1.record.draws}-` : ""}{p1.record.losses}
                  </p>
                )}
              </div>
            </div>

            {/* Score */}
            <div className="flex items-center gap-4">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl font-black text-white"
                style={{ backgroundColor: p1.gameWins > p2.gameWins ? accentColor : "rgba(255,255,255,0.1)" }}
              >
                {p1.gameWins}
              </span>
              <span className="text-2xl font-bold text-white/40">-</span>
              <span
                className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl font-black text-white"
                style={{ backgroundColor: p2.gameWins > p1.gameWins ? accentColor : "rgba(255,255,255,0.1)" }}
              >
                {p2.gameWins}
              </span>
            </div>

            {/* Player 2 */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xl font-bold text-white">{p2.name}</p>
                {overlay.showRecords && (
                  <p className="text-sm text-white/60">
                    {p2.record.wins}-{p2.record.draws > 0 ? `${p2.record.draws}-` : ""}{p2.record.losses}
                  </p>
                )}
              </div>
              {overlay.showAvatars && (
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-4 border-white/20">
                  {p2.avatar ? (
                    <Image
                      src={p2.avatar}
                      alt={p2.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {p2.name.charAt(0)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Timer */}
          {overlay.showTimer && (
            <div
              className="flex items-center justify-center gap-2 py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              <svg
                className="h-5 w-5 text-white/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span
                className={`font-mono text-xl font-bold ${
                  localTimer < 300 ? "text-red-400" : "text-white/80"
                }`}
              >
                {formatTime(localTimer)}
              </span>
            </div>
          )}
        </div>

        {/* MAJH Events Branding */}
        <div className="mt-4 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">
            Powered by MAJH Events
          </p>
        </div>
      </div>
    )
  }

  // Vertical layout (for side panels)
  if (overlay.layout === "vertical") {
    return (
      <div className="min-h-screen bg-transparent p-4 font-sans">
        <div
          className="mx-auto w-80 overflow-hidden rounded-2xl shadow-2xl"
          style={{
            backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Tournament Header */}
          {overlay.showTournamentName && (
            <div
              className="px-4 py-3 text-center"
              style={{ backgroundColor: primaryColor }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                {tournament.name}
              </p>
              {overlay.showRound && (
                <p className="text-xs text-white/80">Round {round.number}</p>
              )}
            </div>
          )}

          {/* Player 1 */}
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-3">
              {overlay.showAvatars && (
                <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/20">
                  {p1.avatar ? (
                    <Image src={p1.avatar} alt={p1.name} fill className="object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {p1.name.charAt(0)}
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-white">{p1.name}</p>
                {overlay.showRecords && (
                  <p className="text-xs text-white/60">
                    {p1.record.wins}-{p1.record.draws > 0 ? `${p1.record.draws}-` : ""}{p1.record.losses}
                  </p>
                )}
              </div>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl font-black text-white"
                style={{ backgroundColor: p1.gameWins > p2.gameWins ? accentColor : "rgba(255,255,255,0.1)" }}
              >
                {p1.gameWins}
              </span>
            </div>
          </div>

          {/* Player 2 */}
          <div className="p-4">
            <div className="flex items-center gap-3">
              {overlay.showAvatars && (
                <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white/20">
                  {p2.avatar ? (
                    <Image src={p2.avatar} alt={p2.name} fill className="object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {p2.name.charAt(0)}
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-white">{p2.name}</p>
                {overlay.showRecords && (
                  <p className="text-xs text-white/60">
                    {p2.record.wins}-{p2.record.draws > 0 ? `${p2.record.draws}-` : ""}{p2.record.losses}
                  </p>
                )}
              </div>
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl font-black text-white"
                style={{ backgroundColor: p2.gameWins > p1.gameWins ? accentColor : "rgba(255,255,255,0.1)" }}
              >
                {p2.gameWins}
              </span>
            </div>
          </div>

          {/* Timer */}
          {overlay.showTimer && (
            <div
              className="flex items-center justify-center gap-2 py-3"
              style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              <span
                className={`font-mono text-lg font-bold ${
                  localTimer < 300 ? "text-red-400" : "text-white/80"
                }`}
              >
                {formatTime(localTimer)}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Minimal layout (just score)
  return (
    <div className="min-h-screen bg-transparent p-4 font-sans">
      <div
        className="inline-flex items-center gap-4 rounded-full px-6 py-3 shadow-xl"
        style={{
          backgroundColor: `rgba(0, 0, 0, ${bgOpacity})`,
          backdropFilter: "blur(12px)",
        }}
      >
        <span className="font-bold text-white">{p1.name}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-black text-white"
          style={{ backgroundColor: p1.gameWins > p2.gameWins ? accentColor : "rgba(255,255,255,0.2)" }}
        >
          {p1.gameWins}
        </span>
        <span className="text-white/40">-</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-black text-white"
          style={{ backgroundColor: p2.gameWins > p1.gameWins ? accentColor : "rgba(255,255,255,0.2)" }}
        >
          {p2.gameWins}
        </span>
        <span className="font-bold text-white">{p2.name}</span>
      </div>
    </div>
  )
}

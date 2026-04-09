"use client"

import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "next/navigation"

export default function TimerOverlayPage() {
  const searchParams = useSearchParams()
  
  // Get theme colors from URL params
  const primaryColor = `#${searchParams.get("primary") || "D4AF37"}`
  const accentColor = `#${searchParams.get("accent") || "1a1a2e"}`
  const initialMinutes = parseInt(searchParams.get("minutes") || "50")
  
  const [timeLeft, setTimeLeft] = useState(initialMinutes * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(Math.abs(seconds) / 60)
    const secs = Math.abs(seconds) % 60
    const sign = seconds < 0 ? "-" : ""
    return `${sign}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }, [])

  // Listen for control messages (could be from parent window or WebSocket)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {}
      
      switch (type) {
        case "TIMER_START":
          setIsRunning(true)
          break
        case "TIMER_PAUSE":
          setIsRunning(false)
          break
        case "TIMER_RESET":
          setTimeLeft((payload?.minutes || initialMinutes) * 60)
          setIsRunning(false)
          setIsExpired(false)
          break
        case "TIMER_SET":
          setTimeLeft(payload?.seconds || initialMinutes * 60)
          break
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [initialMinutes])

  // Auto-start if autostart param is present
  useEffect(() => {
    if (searchParams.get("autostart") === "true") {
      setIsRunning(true)
    }
  }, [searchParams])

  // Timer countdown
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0 && !isExpired) {
          setIsExpired(true)
        }
        // Continue counting into negative for overtime display
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRunning, isExpired])

  const isWarning = timeLeft <= 300 && timeLeft > 0 // Last 5 minutes
  const isDanger = timeLeft <= 60 && timeLeft > 0 // Last minute
  const isOvertime = timeLeft < 0

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "transparent" }}
    >
      <div 
        className="relative px-8 py-4 rounded-lg"
        style={{ 
          backgroundColor: isOvertime ? "#7f1d1d" : isDanger ? "#991b1b" : isWarning ? "#92400e" : accentColor,
          boxShadow: `0 0 20px ${primaryColor}40`,
          border: `2px solid ${primaryColor}`,
        }}
      >
        {/* Timer Display */}
        <div 
          className="font-mono font-bold text-center"
          style={{ 
            color: primaryColor,
            fontSize: "clamp(3rem, 10vw, 6rem)",
            textShadow: `0 0 10px ${primaryColor}60`,
            letterSpacing: "0.05em",
          }}
        >
          {formatTime(timeLeft)}
        </div>

        {/* Status Indicator */}
        {isOvertime && (
          <div 
            className="absolute -top-2 -right-2 px-2 py-0.5 rounded text-xs font-bold animate-pulse"
            style={{ backgroundColor: "#dc2626", color: "white" }}
          >
            OVERTIME
          </div>
        )}

        {isRunning && !isOvertime && (
          <div 
            className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: primaryColor, color: accentColor }}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: accentColor }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: accentColor }} />
            </span>
            LIVE
          </div>
        )}

        {/* Paused indicator */}
        {!isRunning && timeLeft > 0 && timeLeft !== initialMinutes * 60 && (
          <div 
            className="absolute -top-2 -right-2 px-2 py-0.5 rounded text-xs font-bold"
            style={{ backgroundColor: "#6b7280", color: "white" }}
          >
            PAUSED
          </div>
        )}
      </div>

      {/* Keyboard controls hint (only shown in non-OBS browser) */}
      {typeof window !== "undefined" && !window.location.search.includes("obs=true") && (
        <div className="fixed bottom-4 left-4 text-white/50 text-xs">
          <p>Controls: Space = Start/Pause | R = Reset</p>
        </div>
      )}

      {/* Keyboard controls for testing */}
      <KeyboardControls 
        onStart={() => setIsRunning(true)}
        onPause={() => setIsRunning(false)}
        onReset={() => {
          setTimeLeft(initialMinutes * 60)
          setIsRunning(false)
          setIsExpired(false)
        }}
        isRunning={isRunning}
      />
    </div>
  )
}

function KeyboardControls({ 
  onStart, 
  onPause, 
  onReset,
  isRunning,
}: { 
  onStart: () => void
  onPause: () => void
  onReset: () => void
  isRunning: boolean
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault()
        if (isRunning) {
          onPause()
        } else {
          onStart()
        }
      } else if (e.code === "KeyR") {
        onReset()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onStart, onPause, onReset, isRunning])

  return null
}

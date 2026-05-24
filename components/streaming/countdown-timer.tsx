"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface CountdownTimerProps {
  targetDate: string | Date
  onComplete?: () => void
  className?: string
  showLabels?: boolean
  size?: "sm" | "md" | "lg"
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function calculateTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date().getTime()
  const target = targetDate.getTime()
  const difference = target - now

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
    total: difference,
  }
}

export function CountdownTimer({
  targetDate,
  onComplete,
  className,
  showLabels = true,
  size = "md",
}: CountdownTimerProps) {
  const target = typeof targetDate === "string" ? new Date(targetDate) : targetDate
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(target))

  useEffect(() => {
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(target)
      setTimeLeft(newTimeLeft)

      if (newTimeLeft.total <= 0) {
        clearInterval(timer)
        onComplete?.()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [target, onComplete])

  const sizeClasses = {
    sm: {
      container: "gap-1",
      number: "text-lg font-bold min-w-[28px]",
      label: "text-[10px]",
      separator: "text-lg",
    },
    md: {
      container: "gap-2",
      number: "text-2xl font-bold min-w-[40px]",
      label: "text-xs",
      separator: "text-2xl",
    },
    lg: {
      container: "gap-3",
      number: "text-4xl font-bold min-w-[60px]",
      label: "text-sm",
      separator: "text-4xl",
    },
  }

  const styles = sizeClasses[size]

  if (timeLeft.total <= 0) {
    return (
      <div className={cn("flex items-center gap-2 text-primary animate-pulse", className)}>
        <Clock className="h-4 w-4" />
        <span className="font-medium">Starting soon...</span>
      </div>
    )
  }

  const TimeUnit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <span className={cn(styles.number, "tabular-nums")}>{value.toString().padStart(2, "0")}</span>
      {showLabels && <span className={cn(styles.label, "text-muted-foreground uppercase")}>{label}</span>}
    </div>
  )

  return (
    <div className={cn("flex items-center", styles.container, className)}>
      {timeLeft.days > 0 && (
        <>
          <TimeUnit value={timeLeft.days} label="days" />
          <span className={cn(styles.separator, "text-muted-foreground")}>:</span>
        </>
      )}
      <TimeUnit value={timeLeft.hours} label="hrs" />
      <span className={cn(styles.separator, "text-muted-foreground")}>:</span>
      <TimeUnit value={timeLeft.minutes} label="min" />
      <span className={cn(styles.separator, "text-muted-foreground")}>:</span>
      <TimeUnit value={timeLeft.seconds} label="sec" />
    </div>
  )
}

export function ScheduledStreamCard({
  title,
  thumbnailUrl,
  scheduledAt,
  creatorName,
  creatorAvatar,
  game,
  platform,
  onGoLive,
}: {
  title: string
  thumbnailUrl?: string
  scheduledAt: string | Date
  creatorName: string
  creatorAvatar?: string
  game?: string
  platform?: string
  onGoLive?: () => void
}) {
  const target = typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt
  const isWithin24Hours = target.getTime() - Date.now() < 24 * 60 * 60 * 1000

  return (
    <div className="group relative bg-card rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <Clock className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Coming Soon Badge */}
        <div className="absolute top-2 left-2">
          <div className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            isWithin24Hours ? "bg-amber-500/90 text-black" : "bg-card/90 text-foreground"
          )}>
            {isWithin24Hours ? "Coming Soon" : "Scheduled"}
          </div>
        </div>

        {/* Platform Badge */}
        {platform && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium bg-card/90 capitalize">
            {platform}
          </div>
        )}

        {/* Countdown Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
          <CountdownTimer targetDate={scheduledAt} size="md" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium line-clamp-1">{title}</h3>
        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
          <span>{creatorName}</span>
          {game && (
            <>
              <span>·</span>
              <span>{game}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {target.toLocaleDateString(undefined, { 
              month: "short", 
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            })}
          </span>
        </div>
      </div>
    </div>
  )
}

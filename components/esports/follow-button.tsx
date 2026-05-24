"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { followPlayer, unfollowPlayer, isFollowingPlayer } from "@/lib/tournament-controller-actions"
import { UserPlus, UserCheck, Bell, BellRing } from "lucide-react"
import { toast } from "sonner"

interface FollowButtonProps {
  playerId: string
  playerName?: string
  initialFollowing?: boolean
  currentUserId?: string
  variant?: "default" | "icon" | "compact"
  className?: string
}

export function FollowButton({ 
  playerId, 
  playerName,
  initialFollowing = false,
  currentUserId,
  variant = "default",
  className 
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing)
  const [isLoading, setIsLoading] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Check follow status on mount
  useEffect(() => {
    if (currentUserId && currentUserId !== playerId) {
      isFollowingPlayer(playerId).then(setIsFollowing)
    }
  }, [playerId, currentUserId])

  const handleClick = async () => {
    if (!currentUserId) {
      toast.error("Please sign in to follow players")
      return
    }

    if (currentUserId === playerId) {
      toast.error("You cannot follow yourself")
      return
    }

    setIsLoading(true)
    
    if (isFollowing) {
      const result = await unfollowPlayer(playerId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setIsFollowing(false)
        toast.success(`Unfollowed ${playerName || "player"}`)
      }
    } else {
      const result = await followPlayer(playerId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setIsFollowing(true)
        toast.success(`Following ${playerName || "player"}! You'll be notified when they go live.`)
      }
    }

    setIsLoading(false)
  }

  if (variant === "icon") {
    return (
      <Button
        size="icon"
        variant={isFollowing ? "default" : "outline"}
        className={cn(
          "h-8 w-8",
          isFollowing && "bg-primary text-primary-foreground",
          className
        )}
        onClick={handleClick}
        disabled={isLoading || !currentUserId || currentUserId === playerId}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isFollowing ? (
          isHovered ? <Bell className="h-4 w-4" /> : <BellRing className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
      </Button>
    )
  }

  if (variant === "compact") {
    return (
      <Button
        size="sm"
        variant={isFollowing ? "secondary" : "outline"}
        className={cn("h-7 text-xs gap-1", className)}
        onClick={handleClick}
        disabled={isLoading || !currentUserId || currentUserId === playerId}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isFollowing ? (
          <>
            <UserCheck className="h-3 w-3" />
            {isHovered ? "Unfollow" : "Following"}
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" />
            Follow
          </>
        )}
      </Button>
    )
  }

  // Default variant
  return (
    <Button
      variant={isFollowing ? "secondary" : "default"}
      className={cn(
        "gap-2 transition-all",
        isFollowing && isHovered && "bg-destructive/10 text-destructive hover:bg-destructive/20",
        className
      )}
      onClick={handleClick}
      disabled={isLoading || !currentUserId || currentUserId === playerId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isLoading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {isFollowing ? "Unfollowing..." : "Following..."}
        </>
      ) : isFollowing ? (
        <>
          {isHovered ? (
            <>
              <UserPlus className="h-4 w-4" />
              Unfollow
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4" />
              Following
            </>
          )}
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Follow
        </>
      )}
    </Button>
  )
}

// Badge showing follower count
export function FollowerBadge({ count, className }: { count: number; className?: string }) {
  const formatCount = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  return (
    <span className={cn("text-sm text-muted-foreground", className)}>
      {formatCount(count)} followers
    </span>
  )
}

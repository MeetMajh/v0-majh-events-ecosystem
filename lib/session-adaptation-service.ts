"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION-BASED FEED ADAPTATION
// Real-time feed adjustments based on user behavior within session
// ═══════════════════════════════════════════════════════════════════════════════

interface SessionEvent {
  type: "view" | "skip" | "like" | "complete" | "share"
  contentId: string
  gameId?: string
  creatorId?: string
  watchDuration?: number
  totalDuration?: number
  timestamp: number
}

interface SessionState {
  events: SessionEvent[]
  skipStreak: number
  currentTopicSkips: Record<string, number>
  topicAffinities: Record<string, number>
  avgWatchPercentage: number
  sessionStart: number
  lastInteraction: number
}

interface FeedAdjustment {
  type: "shift_topic" | "boost_engagement" | "diversify" | "slow_down"
  reason: string
  parameters: Record<string, any>
}

// ══════════════════════════════════════════
// SESSION TRACKER
// ══════════════════════════════════════════

class SessionTracker {
  private state: SessionState
  private callbacks: Array<(adjustment: FeedAdjustment) => void> = []
  
  constructor() {
    this.state = this.createInitialState()
  }
  
  private createInitialState(): SessionState {
    return {
      events: [],
      skipStreak: 0,
      currentTopicSkips: {},
      topicAffinities: {},
      avgWatchPercentage: 100,
      sessionStart: Date.now(),
      lastInteraction: Date.now(),
    }
  }
  
  /**
   * Register callback for feed adjustments
   */
  onAdjustment(callback: (adjustment: FeedAdjustment) => void) {
    this.callbacks.push(callback)
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback)
    }
  }
  
  private emitAdjustment(adjustment: FeedAdjustment) {
    this.callbacks.forEach(cb => cb(adjustment))
  }
  
  /**
   * Track content view
   */
  trackView(contentId: string, gameId?: string, creatorId?: string) {
    this.state.events.push({
      type: "view",
      contentId,
      gameId,
      creatorId,
      timestamp: Date.now(),
    })
    this.state.lastInteraction = Date.now()
    this.state.skipStreak = 0 // Reset skip streak on view
  }
  
  /**
   * Track skip (user swiped away quickly)
   */
  trackSkip(contentId: string, watchDuration: number, totalDuration: number, gameId?: string) {
    const watchPercentage = totalDuration > 0 ? (watchDuration / totalDuration) * 100 : 0
    
    this.state.events.push({
      type: "skip",
      contentId,
      gameId,
      watchDuration,
      totalDuration,
      timestamp: Date.now(),
    })
    
    this.state.lastInteraction = Date.now()
    
    // Update skip streak
    if (watchPercentage < 20) {
      this.state.skipStreak++
      
      // Track topic-specific skips
      if (gameId) {
        this.state.currentTopicSkips[gameId] = (this.state.currentTopicSkips[gameId] || 0) + 1
      }
      
      // Check for feed adjustment triggers
      this.checkAdjustmentTriggers(gameId)
    } else {
      this.state.skipStreak = 0
    }
    
    // Update average watch percentage
    this.updateAvgWatchPercentage(watchPercentage)
  }
  
  /**
   * Track like
   */
  trackLike(contentId: string, gameId?: string, creatorId?: string) {
    this.state.events.push({
      type: "like",
      contentId,
      gameId,
      creatorId,
      timestamp: Date.now(),
    })
    
    // Boost topic affinity
    if (gameId) {
      this.state.topicAffinities[gameId] = Math.min(
        (this.state.topicAffinities[gameId] || 0) + 0.2,
        1.0
      )
    }
    
    this.state.skipStreak = 0
  }
  
  /**
   * Track completion
   */
  trackCompletion(contentId: string, gameId?: string) {
    this.state.events.push({
      type: "complete",
      contentId,
      gameId,
      timestamp: Date.now(),
    })
    
    // Strong boost for completion
    if (gameId) {
      this.state.topicAffinities[gameId] = Math.min(
        (this.state.topicAffinities[gameId] || 0) + 0.15,
        1.0
      )
    }
    
    this.state.skipStreak = 0
  }
  
  /**
   * Track share
   */
  trackShare(contentId: string, gameId?: string) {
    this.state.events.push({
      type: "share",
      contentId,
      gameId,
      timestamp: Date.now(),
    })
    
    // Strongest boost for share
    if (gameId) {
      this.state.topicAffinities[gameId] = Math.min(
        (this.state.topicAffinities[gameId] || 0) + 0.3,
        1.0
      )
    }
    
    this.state.skipStreak = 0
  }
  
  /**
   * Check if feed adjustment is needed
   */
  private checkAdjustmentTriggers(currentGameId?: string) {
    // Trigger 1: 3+ consecutive quick skips
    if (this.state.skipStreak >= 3) {
      this.emitAdjustment({
        type: "shift_topic",
        reason: "User skipped 3+ clips quickly",
        parameters: {
          avoidGame: currentGameId,
          preferGames: this.getTopAffinities(),
        },
      })
      return
    }
    
    // Trigger 2: 5+ skips on same topic
    if (currentGameId && this.state.currentTopicSkips[currentGameId] >= 5) {
      this.emitAdjustment({
        type: "shift_topic",
        reason: `User skipped ${this.state.currentTopicSkips[currentGameId]} clips from ${currentGameId}`,
        parameters: {
          avoidGame: currentGameId,
          preferGames: this.getTopAffinities(),
        },
      })
      // Reset topic skip count
      this.state.currentTopicSkips[currentGameId] = 0
      return
    }
    
    // Trigger 3: Overall low engagement
    if (this.state.avgWatchPercentage < 30 && this.state.events.length > 10) {
      this.emitAdjustment({
        type: "boost_engagement",
        reason: "Low average watch time detected",
        parameters: {
          boostTrending: true,
          boostHighQuality: true,
        },
      })
      return
    }
    
    // Trigger 4: Same content type fatigue
    const recentTypes = this.state.events
      .slice(-10)
      .map(e => e.gameId)
      .filter(Boolean)
    
    const uniqueTypes = new Set(recentTypes).size
    if (recentTypes.length >= 10 && uniqueTypes <= 2) {
      this.emitAdjustment({
        type: "diversify",
        reason: "Feed too homogeneous",
        parameters: {
          diversityBoost: 0.5,
          currentTypes: Array.from(new Set(recentTypes)),
        },
      })
    }
  }
  
  /**
   * Update rolling average watch percentage
   */
  private updateAvgWatchPercentage(newPercentage: number) {
    const recentSkips = this.state.events
      .filter(e => e.type === "skip")
      .slice(-10)
    
    if (recentSkips.length === 0) {
      this.state.avgWatchPercentage = 100
      return
    }
    
    const percentages = recentSkips.map(e => {
      if (e.watchDuration && e.totalDuration && e.totalDuration > 0) {
        return (e.watchDuration / e.totalDuration) * 100
      }
      return 50
    })
    
    this.state.avgWatchPercentage = 
      percentages.reduce((sum, p) => sum + p, 0) / percentages.length
  }
  
  /**
   * Get top affinity topics
   */
  private getTopAffinities(): string[] {
    return Object.entries(this.state.topicAffinities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([topic]) => topic)
  }
  
  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state }
  }
  
  /**
   * Get feed parameters based on session
   */
  getFeedParameters(): {
    boostGames: string[]
    avoidGames: string[]
    explorationRate: number
    qualityThreshold: number
  } {
    const boostGames = this.getTopAffinities()
    
    const avoidGames = Object.entries(this.state.currentTopicSkips)
      .filter(([, count]) => count >= 3)
      .map(([game]) => game)
    
    // Increase exploration if user is getting bored
    const explorationRate = this.state.avgWatchPercentage < 50 ? 0.4 : 0.2
    
    // Increase quality threshold if lots of skips
    const qualityThreshold = this.state.skipStreak >= 2 ? 7 : 5
    
    return {
      boostGames,
      avoidGames,
      explorationRate,
      qualityThreshold,
    }
  }
  
  /**
   * Reset session (call on new session)
   */
  reset() {
    this.state = this.createInitialState()
  }
}

// ══════════════════════════════════════════
// SINGLETON INSTANCE
// ══════════════════════════════════════════

export const sessionTracker = new SessionTracker()

// ══════════════════════════════════════════
// REACT HOOK
// ══════════════════════════════════════════

import { useState, useEffect, useCallback } from "react"

export function useSessionAdaptation() {
  const [feedParams, setFeedParams] = useState(sessionTracker.getFeedParameters())
  const [adjustment, setAdjustment] = useState<FeedAdjustment | null>(null)
  
  useEffect(() => {
    // Subscribe to adjustments
    const unsubscribe = sessionTracker.onAdjustment((adj) => {
      setAdjustment(adj)
      setFeedParams(sessionTracker.getFeedParameters())
      
      // Clear adjustment after 3 seconds
      setTimeout(() => setAdjustment(null), 3000)
    })
    
    return unsubscribe
  }, [])
  
  const trackView = useCallback((contentId: string, gameId?: string, creatorId?: string) => {
    sessionTracker.trackView(contentId, gameId, creatorId)
  }, [])
  
  const trackSkip = useCallback((
    contentId: string, 
    watchDuration: number, 
    totalDuration: number,
    gameId?: string
  ) => {
    sessionTracker.trackSkip(contentId, watchDuration, totalDuration, gameId)
    setFeedParams(sessionTracker.getFeedParameters())
  }, [])
  
  const trackLike = useCallback((contentId: string, gameId?: string, creatorId?: string) => {
    sessionTracker.trackLike(contentId, gameId, creatorId)
    setFeedParams(sessionTracker.getFeedParameters())
  }, [])
  
  const trackCompletion = useCallback((contentId: string, gameId?: string) => {
    sessionTracker.trackCompletion(contentId, gameId)
    setFeedParams(sessionTracker.getFeedParameters())
  }, [])
  
  const trackShare = useCallback((contentId: string, gameId?: string) => {
    sessionTracker.trackShare(contentId, gameId)
    setFeedParams(sessionTracker.getFeedParameters())
  }, [])
  
  return {
    feedParams,
    adjustment,
    trackView,
    trackSkip,
    trackLike,
    trackCompletion,
    trackShare,
    getState: () => sessionTracker.getState(),
    reset: () => sessionTracker.reset(),
  }
}

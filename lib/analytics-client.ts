"use client"

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT-SIDE ANALYTICS TRACKER
// Browser-based event collection with batching
// ═══════════════════════════════════════════════════════════════════════════════

interface AnalyticsEvent {
  event_type: string
  event_name: string
  user_id?: string
  session_id?: string
  device_id?: string
  target_type?: string
  target_id?: string
  properties?: Record<string, any>
  platform?: string
  device_type?: string
  country?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

class AnalyticsTracker {
  private queue: AnalyticsEvent[] = []
  private sessionId: string
  private deviceId: string
  private userId: string | null = null
  private flushInterval: NodeJS.Timeout | null = null
  private isInitialized = false
  
  constructor() {
    this.sessionId = this.generateId()
    this.deviceId = this.getOrCreateDeviceId()
  }
  
  /**
   * Initialize the tracker
   */
  init(options: { userId?: string } = {}) {
    if (this.isInitialized) return
    
    this.userId = options.userId || null
    this.isInitialized = true
    
    // Start flush interval (every 5 seconds)
    this.flushInterval = setInterval(() => {
      this.flush()
    }, 5000)
    
    // Flush on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        this.flush()
      })
      
      // Track page views automatically
      this.trackPageView()
      
      // Listen for route changes (Next.js)
      window.addEventListener("popstate", () => {
        this.trackPageView()
      })
    }
  }
  
  /**
   * Set user ID (call after auth)
   */
  setUserId(userId: string | null) {
    this.userId = userId
  }
  
  /**
   * Track a custom event
   */
  track(eventName: string, properties: Record<string, any> = {}, target?: { type: string; id: string }) {
    const event: AnalyticsEvent = {
      event_type: "custom",
      event_name: eventName,
      user_id: this.userId || undefined,
      session_id: this.sessionId,
      device_id: this.deviceId,
      target_type: target?.type,
      target_id: target?.id,
      properties: {
        ...properties,
        client_timestamp: new Date().toISOString(),
      },
      platform: this.getPlatform(),
      device_type: this.getDeviceType(),
      ...this.getUtmParams(),
    }
    
    this.queue.push(event)
    
    // Flush immediately for important events
    if (["purchase", "signup", "conversion"].includes(eventName)) {
      this.flush()
    }
  }
  
  /**
   * Track page view
   */
  trackPageView(path?: string) {
    const currentPath = path || (typeof window !== "undefined" ? window.location.pathname : "/")
    
    this.track("page_view", {
      path: currentPath,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      title: typeof document !== "undefined" ? document.title : undefined,
    })
  }
  
  /**
   * Track content view
   */
  trackContentView(contentId: string, contentType: string, properties: Record<string, any> = {}) {
    this.track("view", {
      content_type: contentType,
      ...properties,
    }, { type: "content", id: contentId })
  }
  
  /**
   * Track watch time
   */
  trackWatchTime(contentId: string, seconds: number, percentage: number, completed: boolean = false) {
    this.track("watch_time", {
      seconds,
      percentage,
      completed,
    }, { type: "content", id: contentId })
  }
  
  /**
   * Track engagement (like, comment, share)
   */
  trackEngagement(contentId: string, action: "like" | "unlike" | "comment" | "share" | "save") {
    this.track(action, {}, { type: "content", id: contentId })
  }
  
  /**
   * Track ad impression
   */
  trackAdImpression(adId: string, placement: string, position?: number) {
    this.track("ad_impression", {
      placement,
      position,
    }, { type: "ad", id: adId })
  }
  
  /**
   * Track ad click
   */
  trackAdClick(adId: string, placement: string) {
    this.track("ad_click", {
      placement,
    }, { type: "ad", id: adId })
  }
  
  /**
   * Track search
   */
  trackSearch(query: string, resultsCount: number) {
    this.track("search", {
      query,
      results_count: resultsCount,
    })
  }
  
  /**
   * Track error
   */
  trackError(error: Error, context?: Record<string, any>) {
    this.track("error", {
      message: error.message,
      stack: error.stack,
      ...context,
    })
  }
  
  /**
   * Flush events to server
   */
  async flush() {
    if (this.queue.length === 0) return
    
    const events = [...this.queue]
    this.queue = []
    
    try {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(events),
      })
    } catch (error) {
      // Re-add events to queue on failure
      this.queue.unshift(...events)
      console.error("Failed to flush analytics:", error)
    }
  }
  
  /**
   * Clean up
   */
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }
    this.flush()
  }
  
  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
  
  private getOrCreateDeviceId(): string {
    if (typeof localStorage === "undefined") return this.generateId()
    
    let deviceId = localStorage.getItem("analytics_device_id")
    if (!deviceId) {
      deviceId = this.generateId()
      localStorage.setItem("analytics_device_id", deviceId)
    }
    return deviceId
  }
  
  private getPlatform(): string {
    if (typeof window === "undefined") return "server"
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return "ios"
    if (/Android/.test(navigator.userAgent)) return "android"
    return "web"
  }
  
  private getDeviceType(): string {
    if (typeof window === "undefined") return "unknown"
    const width = window.innerWidth
    if (width < 768) return "mobile"
    if (width < 1024) return "tablet"
    return "desktop"
  }
  
  private getUtmParams(): Record<string, string | undefined> {
    if (typeof window === "undefined") return {}
    
    const params = new URLSearchParams(window.location.search)
    return {
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
    }
  }
}

// Singleton instance
export const analytics = new AnalyticsTracker()

// React hook for analytics
export function useAnalytics() {
  return {
    track: analytics.track.bind(analytics),
    trackPageView: analytics.trackPageView.bind(analytics),
    trackContentView: analytics.trackContentView.bind(analytics),
    trackWatchTime: analytics.trackWatchTime.bind(analytics),
    trackEngagement: analytics.trackEngagement.bind(analytics),
    trackAdImpression: analytics.trackAdImpression.bind(analytics),
    trackAdClick: analytics.trackAdClick.bind(analytics),
    trackSearch: analytics.trackSearch.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
  }
}

// Media utility functions (client-safe, no "use server")

export type MediaType = "clip" | "vod" | "highlight" | "full_match" | "tutorial"
export type SourceType = "upload" | "youtube" | "twitch" | "kick" | "external"

// Video URL parsing
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
const TWITCH_REGEX = /(?:twitch\.tv\/videos\/|clips\.twitch\.tv\/|twitch\.tv\/\w+\/clip\/)([a-zA-Z0-9_-]+)/
const KICK_REGEX = /kick\.com\/(?:video\/)?([a-zA-Z0-9_-]+)/

export function extractVideoId(url: string): { platform: SourceType; videoId: string } | null {
  const youtubeMatch = url.match(YOUTUBE_REGEX)
  if (youtubeMatch) return { platform: "youtube", videoId: youtubeMatch[1] }
  
  const twitchMatch = url.match(TWITCH_REGEX)
  if (twitchMatch) return { platform: "twitch", videoId: twitchMatch[1] }
  
  const kickMatch = url.match(KICK_REGEX)
  if (kickMatch) return { platform: "kick", videoId: kickMatch[1] }
  
  return null
}

export function generateEmbedUrl(url: string): string | null {
  const extracted = extractVideoId(url)
  if (!extracted) return null
  
  switch (extracted.platform) {
    case "youtube":
      return `https://www.youtube.com/embed/${extracted.videoId}`
    case "twitch":
      return `https://player.twitch.tv/?video=${extracted.videoId}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`
    default:
      return null
  }
}

export function generateThumbnailUrl(url: string): string | null {
  const extracted = extractVideoId(url)
  if (!extracted) return null
  
  switch (extracted.platform) {
    case "youtube":
      return `https://img.youtube.com/vi/${extracted.videoId}/maxresdefault.jpg`
    case "twitch":
      // Twitch thumbnails require API call, return placeholder
      return null
    default:
      return null
  }
}

// Content moderation
const PROHIBITED_TERMS = [
  "hack", "cheat", "exploit", "aimbot", "wallhack",
  "account selling", "boosting service",
]

export function checkContentViolations(title: string, description?: string): string[] {
  const violations: string[] = []
  const content = `${title} ${description || ""}`.toLowerCase()
  
  for (const term of PROHIBITED_TERMS) {
    if (content.includes(term)) {
      violations.push(`Content contains prohibited term: "${term}"`)
    }
  }
  
  return violations
}

export function isAllowedUrl(url: string): boolean {
  const allowedDomains = [
    "youtube.com", "youtu.be",
    "twitch.tv", "clips.twitch.tv",
    "kick.com",
  ]
  
  try {
    const urlObj = new URL(url)
    return allowedDomains.some(domain => urlObj.hostname.endsWith(domain))
  } catch {
    return false
  }
}

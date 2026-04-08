"use server"

/**
 * Streaming Platform API Integrations
 * Supports Twitch, Kick, and YouTube Live
 */

// ══════════════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════════════

export interface StreamInfo {
  id: string
  platform: "twitch" | "kick" | "youtube"
  channelId: string
  channelName: string
  title: string
  isLive: boolean
  viewerCount: number
  thumbnailUrl?: string
  gameId?: string
  gameName?: string
  startedAt?: string
  embedUrl: string
  chatEmbedUrl?: string
}

export interface StreamerInfo {
  id: string
  platform: "twitch" | "kick" | "youtube"
  displayName: string
  username: string
  profileImageUrl?: string
  description?: string
  followerCount?: number
  isPartner?: boolean
  isAffiliate?: boolean
}

// ══════════════════════════════════════════════════════════════════════════════
// Twitch API
// ══════════════════════════════════════════════════════════════════════════════

let twitchAccessToken: string | null = null
let twitchTokenExpiry: number = 0

async function getTwitchAccessToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.log("[Streaming API] Twitch credentials not configured")
    return null
  }

  // Return cached token if still valid
  if (twitchAccessToken && Date.now() < twitchTokenExpiry - 60000) {
    return twitchAccessToken
  }

  try {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    })

    if (!response.ok) {
      console.error("[Twitch API] Failed to get access token:", response.status)
      return null
    }

    const data = await response.json()
    twitchAccessToken = data.access_token
    twitchTokenExpiry = Date.now() + data.expires_in * 1000

    return twitchAccessToken
  } catch (error) {
    console.error("[Twitch API] Token error:", error)
    return null
  }
}

export async function getTwitchStreamInfo(channelNames: string[]): Promise<StreamInfo[]> {
  const accessToken = await getTwitchAccessToken()
  const clientId = process.env.TWITCH_CLIENT_ID

  if (!accessToken || !clientId || channelNames.length === 0) {
    return []
  }

  try {
    const params = new URLSearchParams()
    channelNames.forEach((name) => params.append("user_login", name.toLowerCase()))

    const response = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
      next: { revalidate: 30 }, // Cache for 30 seconds
    })

    if (!response.ok) {
      console.error("[Twitch API] Stream info error:", response.status)
      return []
    }

    const data = await response.json()
    const parent = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split("/")[0] || "localhost"

    return data.data.map((stream: any) => ({
      id: stream.id,
      platform: "twitch" as const,
      channelId: stream.user_id,
      channelName: stream.user_login,
      title: stream.title,
      isLive: true,
      viewerCount: stream.viewer_count,
      thumbnailUrl: stream.thumbnail_url.replace("{width}", "440").replace("{height}", "248"),
      gameId: stream.game_id,
      gameName: stream.game_name,
      startedAt: stream.started_at,
      embedUrl: `https://player.twitch.tv/?channel=${stream.user_login}&parent=${parent}&muted=false`,
      chatEmbedUrl: `https://www.twitch.tv/embed/${stream.user_login}/chat?parent=${parent}&darkpopout`,
    }))
  } catch (error) {
    console.error("[Twitch API] Error fetching streams:", error)
    return []
  }
}

export async function getTwitchUserInfo(channelNames: string[]): Promise<StreamerInfo[]> {
  const accessToken = await getTwitchAccessToken()
  const clientId = process.env.TWITCH_CLIENT_ID

  if (!accessToken || !clientId || channelNames.length === 0) {
    return []
  }

  try {
    const params = new URLSearchParams()
    channelNames.forEach((name) => params.append("login", name.toLowerCase()))

    const response = await fetch(`https://api.twitch.tv/helix/users?${params}`, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) return []

    const data = await response.json()

    return data.data.map((user: any) => ({
      id: user.id,
      platform: "twitch" as const,
      displayName: user.display_name,
      username: user.login,
      profileImageUrl: user.profile_image_url,
      description: user.description,
      isPartner: user.broadcaster_type === "partner",
      isAffiliate: user.broadcaster_type === "affiliate",
    }))
  } catch (error) {
    console.error("[Twitch API] Error fetching user info:", error)
    return []
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Kick API (unofficial - limited functionality)
// ══════════════════════════════════════════════════════════════════════════════

export async function getKickStreamInfo(channelNames: string[]): Promise<StreamInfo[]> {
  const streams: StreamInfo[] = []

  for (const channelName of channelNames) {
    try {
      // Kick doesn't have an official API, so we use their public endpoint
      const response = await fetch(`https://kick.com/api/v2/channels/${channelName.toLowerCase()}`, {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 30 },
      })

      if (!response.ok) continue

      const data = await response.json()

      if (data.livestream) {
        streams.push({
          id: data.livestream.id.toString(),
          platform: "kick",
          channelId: data.id.toString(),
          channelName: data.slug,
          title: data.livestream.session_title,
          isLive: data.livestream.is_live,
          viewerCount: data.livestream.viewer_count || 0,
          thumbnailUrl: data.livestream.thumbnail?.url,
          gameName: data.livestream.categories?.[0]?.name,
          startedAt: data.livestream.created_at,
          embedUrl: `https://player.kick.com/${data.slug}`,
          chatEmbedUrl: `https://kick.com/${data.slug}/chatroom`,
        })
      }
    } catch (error) {
      console.error(`[Kick API] Error fetching ${channelName}:`, error)
    }
  }

  return streams
}

export async function getKickUserInfo(channelNames: string[]): Promise<StreamerInfo[]> {
  const users: StreamerInfo[] = []

  for (const channelName of channelNames) {
    try {
      const response = await fetch(`https://kick.com/api/v2/channels/${channelName.toLowerCase()}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 300 },
      })

      if (!response.ok) continue

      const data = await response.json()

      users.push({
        id: data.id.toString(),
        platform: "kick",
        displayName: data.user?.username || data.slug,
        username: data.slug,
        profileImageUrl: data.user?.profile_pic,
        description: data.user?.bio,
        followerCount: data.followers_count,
        isPartner: data.verified?.channel === true,
      })
    } catch (error) {
      console.error(`[Kick API] Error fetching user ${channelName}:`, error)
    }
  }

  return users
}

// ══════════════════════════════════════════════════════════════════════════════
// YouTube Live API
// ══════════════════════════════════════════════════════════════════════════════

export async function getYouTubeLiveInfo(channelIds: string[]): Promise<StreamInfo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY

  if (!apiKey || channelIds.length === 0) {
    return []
  }

  const streams: StreamInfo[] = []

  for (const channelId of channelIds) {
    try {
      // Search for live broadcasts from the channel
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`,
        { next: { revalidate: 60 } }
      )

      if (!searchResponse.ok) continue

      const searchData = await searchResponse.json()

      if (!searchData.items?.[0]) continue

      const videoId = searchData.items[0].id.videoId
      const snippet = searchData.items[0].snippet

      // Get live stream details
      const videoResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,statistics&id=${videoId}&key=${apiKey}`,
        { next: { revalidate: 30 } }
      )

      if (!videoResponse.ok) continue

      const videoData = await videoResponse.json()
      const video = videoData.items?.[0]

      streams.push({
        id: videoId,
        platform: "youtube",
        channelId: channelId,
        channelName: snippet.channelTitle,
        title: snippet.title,
        isLive: true,
        viewerCount: parseInt(video?.liveStreamingDetails?.concurrentViewers || "0"),
        thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
        startedAt: video?.liveStreamingDetails?.actualStartTime,
        embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1`,
        chatEmbedUrl: `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split("/")[0] || "localhost"}`,
      })
    } catch (error) {
      console.error(`[YouTube API] Error fetching channel ${channelId}:`, error)
    }
  }

  return streams
}

// ══════════════════════════════════════════════════════════════════════════════
// Combined Stream Fetcher
// ══════════════════════════════════════════════════════════════════════════════

export async function getMultiPlatformStreams(config: {
  twitch?: string[]
  kick?: string[]
  youtube?: string[]
}): Promise<StreamInfo[]> {
  const results = await Promise.all([
    config.twitch?.length ? getTwitchStreamInfo(config.twitch) : [],
    config.kick?.length ? getKickStreamInfo(config.kick) : [],
    config.youtube?.length ? getYouTubeLiveInfo(config.youtube) : [],
  ])

  return results.flat().sort((a, b) => b.viewerCount - a.viewerCount)
}

// ══════════════════════════════════════════════════════════════════════════════
// Stream URL Parser
// ══════════════════════════════════════════════════════════════════════════════

export function parseStreamUrl(url: string): { platform: "twitch" | "kick" | "youtube" | "unknown"; channel: string } | null {
  if (!url) return null

  // Twitch
  const twitchMatch = url.match(/(?:twitch\.tv|player\.twitch\.tv)\/(?:(?:\?channel=)?([a-zA-Z0-9_]+))/)
  if (twitchMatch) {
    return { platform: "twitch", channel: twitchMatch[1] }
  }

  // Kick
  const kickMatch = url.match(/kick\.com\/([a-zA-Z0-9_-]+)/)
  if (kickMatch) {
    return { platform: "kick", channel: kickMatch[1] }
  }

  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|live\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/
  )
  if (youtubeMatch) {
    return { platform: "youtube", channel: youtubeMatch[1] }
  }

  return { platform: "unknown", channel: url }
}

// ══════════════════════════════════════════════════════════════════════════════
// Generate Embed URLs
// ══════════════════════════════════════════════════════════════════════════════

export function generateEmbedUrl(platform: string, channel: string, options?: { muted?: boolean; autoplay?: boolean }): string {
  const parent = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split("/")[0] || "localhost"
  const muted = options?.muted ?? true
  const autoplay = options?.autoplay ?? true

  switch (platform) {
    case "twitch":
      return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&muted=${muted}&autoplay=${autoplay}`
    case "kick":
      return `https://player.kick.com/${channel}`
    case "youtube":
      return `https://www.youtube.com/embed/${channel}?autoplay=${autoplay ? 1 : 0}&mute=${muted ? 1 : 0}`
    default:
      return channel
  }
}

export function generateChatEmbedUrl(platform: string, channel: string): string | null {
  const parent = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "").split("/")[0] || "localhost"

  switch (platform) {
    case "twitch":
      return `https://www.twitch.tv/embed/${channel}/chat?parent=${parent}&darkpopout`
    case "kick":
      return `https://kick.com/${channel}/chatroom`
    case "youtube":
      return `https://www.youtube.com/live_chat?v=${channel}&embed_domain=${parent}`
    default:
      return null
  }
}

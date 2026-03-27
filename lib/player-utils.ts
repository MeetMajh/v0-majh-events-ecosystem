/**
 * Utility functions for displaying player information
 */

export type PlayerProfile = {
  display_name?: string | null
  username?: string | null
  first_name?: string | null
  last_name?: string | null
}

/**
 * Get the display name for a player, preferring username if available
 * Priority: username > display_name > first_name + last_name > "Unknown"
 */
export function getPlayerDisplayName(profile: PlayerProfile | null | undefined): string {
  if (!profile) return "Unknown"
  if (profile.username) return profile.username
  if (profile.display_name) return profile.display_name
  if (profile.first_name || profile.last_name) {
    return `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
  }
  return "Unknown"
}

/**
 * Get the initials for a player's avatar
 */
export function getPlayerInitials(profile: PlayerProfile | null | undefined): string {
  const name = getPlayerDisplayName(profile)
  if (name === "Unknown") return "?"
  
  const parts = name.split(" ").filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/**
 * Check if a username is valid
 * - 3-30 characters
 * - Only letters, numbers, underscores, hyphens
 */
export function isValidUsername(username: string): boolean {
  if (!username || username.length < 3 || username.length > 30) return false
  return /^[a-zA-Z0-9_-]+$/.test(username)
}

/**
 * Sanitize a username to be valid
 */
export function sanitizeUsername(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30)
}

/**
 * TopDeck.gg API Integration
 * 
 * API Documentation: https://topdeck.gg/api/docs
 * 
 * This module handles fetching tournament data from TopDeck.gg
 * and syncing it to our external_tournaments table.
 */

const TOPDECK_API_BASE = "https://topdeck.gg/api/v2"

export type TopDeckTournament = {
  _id: string
  name: string
  game: string
  format?: string
  startDate: string
  endDate?: string
  location?: {
    city?: string
    state?: string
    country?: string
    venue?: string
  }
  isOnline: boolean
  entryFee?: number
  maxPlayers?: number
  registeredPlayers?: number
  status: string
  organizer?: {
    name: string
    id?: string
  }
  url?: string
}

export type TopDeckSearchParams = {
  game?: string
  format?: string
  startDate?: string
  endDate?: string
  location?: string
  isOnline?: boolean
  limit?: number
  offset?: number
}

/**
 * Fetch tournaments from TopDeck.gg API
 */
export async function fetchTopDeckTournaments(
  params: TopDeckSearchParams = {}
): Promise<{ tournaments: TopDeckTournament[]; total: number }> {
  const apiKey = process.env.TOPDECK_API_KEY
  
  if (!apiKey) {
    console.warn("TOPDECK_API_KEY not set, returning empty results")
    return { tournaments: [], total: 0 }
  }

  const searchParams = new URLSearchParams()
  
  if (params.game) searchParams.set("game", params.game)
  if (params.format) searchParams.set("format", params.format)
  if (params.startDate) searchParams.set("startDate", params.startDate)
  if (params.endDate) searchParams.set("endDate", params.endDate)
  if (params.location) searchParams.set("location", params.location)
  if (params.isOnline !== undefined) searchParams.set("isOnline", String(params.isOnline))
  if (params.limit) searchParams.set("limit", String(params.limit))
  if (params.offset) searchParams.set("offset", String(params.offset))

  try {
    const response = await fetch(
      `${TOPDECK_API_BASE}/tournaments?${searchParams.toString()}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      }
    )

    if (!response.ok) {
      console.error("TopDeck API error:", response.status, await response.text())
      return { tournaments: [], total: 0 }
    }

    const data = await response.json()
    return {
      tournaments: data.tournaments || data.data || [],
      total: data.total || data.tournaments?.length || 0,
    }
  } catch (error) {
    console.error("Failed to fetch TopDeck tournaments:", error)
    return { tournaments: [], total: 0 }
  }
}

/**
 * Fetch a single tournament by ID
 */
export async function fetchTopDeckTournament(
  tournamentId: string
): Promise<TopDeckTournament | null> {
  const apiKey = process.env.TOPDECK_API_KEY
  
  if (!apiKey) {
    console.warn("TOPDECK_API_KEY not set")
    return null
  }

  try {
    const response = await fetch(
      `${TOPDECK_API_BASE}/tournaments/${tournamentId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      console.error("TopDeck API error:", response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("Failed to fetch TopDeck tournament:", error)
    return null
  }
}

/**
 * Convert TopDeck tournament to our database format
 */
export function mapTopDeckToExternal(tournament: TopDeckTournament) {
  const location = tournament.location
    ? [
        tournament.location.venue,
        tournament.location.city,
        tournament.location.state,
        tournament.location.country,
      ]
        .filter(Boolean)
        .join(", ")
    : null

  return {
    source: "topdeck" as const,
    external_id: tournament._id,
    name: tournament.name,
    game: tournament.game,
    format: tournament.format || null,
    start_date: tournament.startDate,
    end_date: tournament.endDate || null,
    location,
    is_online: tournament.isOnline,
    entry_fee_cents: tournament.entryFee 
      ? Math.round(tournament.entryFee * 100) 
      : null,
    max_players: tournament.maxPlayers || null,
    registered_players: tournament.registeredPlayers || null,
    tournament_status: tournament.status || "upcoming",
    organizer_name: tournament.organizer?.name || null,
    external_url: tournament.url || `https://topdeck.gg/event/${tournament._id}`,
    raw_data: tournament,
    last_synced_at: new Date().toISOString(),
  }
}

/**
 * Supported games on TopDeck.gg
 */
export const TOPDECK_GAMES = [
  { value: "magic", label: "Magic: The Gathering" },
  { value: "pokemon", label: "Pokemon TCG" },
  { value: "yugioh", label: "Yu-Gi-Oh!" },
  { value: "lorcana", label: "Disney Lorcana" },
  { value: "fab", label: "Flesh and Blood" },
  { value: "onepiece", label: "One Piece TCG" },
  { value: "starwars", label: "Star Wars: Unlimited" },
  { value: "weiss", label: "Weiss Schwarz" },
  { value: "digimon", label: "Digimon TCG" },
  { value: "dragonball", label: "Dragon Ball Super" },
]

/**
 * Common formats by game
 */
export const TOPDECK_FORMATS: Record<string, string[]> = {
  magic: ["Standard", "Modern", "Pioneer", "Legacy", "Vintage", "Commander", "Limited", "Pauper"],
  pokemon: ["Standard", "Expanded", "GLC"],
  yugioh: ["Advanced", "Traditional", "Speed Duel"],
  lorcana: ["Standard", "Limited"],
  fab: ["Blitz", "Classic Constructed", "Draft", "Sealed"],
}

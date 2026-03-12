// Scryfall API Integration for Card Validation
// API Docs: https://scryfall.com/docs/api

const SCRYFALL_API = "https://api.scryfall.com"

// Rate limiting: Scryfall asks for 50-100ms between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export interface ScryfallCard {
  id: string
  oracle_id: string
  name: string
  lang: string
  released_at: string
  uri: string
  scryfall_uri: string
  layout: string
  image_uris?: {
    small: string
    normal: string
    large: string
    png: string
    art_crop: string
    border_crop: string
  }
  mana_cost?: string
  cmc: number
  type_line: string
  oracle_text?: string
  colors?: string[]
  color_identity: string[]
  keywords: string[]
  legalities: Record<string, "legal" | "not_legal" | "restricted" | "banned">
  games: string[]
  set: string
  set_name: string
  set_type: string
  collector_number: string
  rarity: string
  prices: {
    usd?: string
    usd_foil?: string
    eur?: string
    eur_foil?: string
  }
}

export interface ScryfallList {
  object: "list"
  total_cards: number
  has_more: boolean
  next_page?: string
  data: ScryfallCard[]
}

export interface ScryfallError {
  object: "error"
  code: string
  status: number
  details: string
}

export type ScryfallResponse<T> = T | ScryfallError

function isError(response: unknown): response is ScryfallError {
  return (response as ScryfallError)?.object === "error"
}

// ── Search Cards ──
export async function searchCards(query: string): Promise<ScryfallCard[]> {
  try {
    const response = await fetch(
      `${SCRYFALL_API}/cards/search?q=${encodeURIComponent(query)}`,
      { next: { revalidate: 3600 } } // Cache for 1 hour
    )
    
    const data: ScryfallResponse<ScryfallList> = await response.json()
    
    if (isError(data)) {
      console.error("Scryfall search error:", data.details)
      return []
    }
    
    return data.data
  } catch (error) {
    console.error("Scryfall API error:", error)
    return []
  }
}

// ── Get Card by Name (Exact or Fuzzy) ──
export async function getCardByName(
  name: string,
  options?: { exact?: boolean; set?: string }
): Promise<ScryfallCard | null> {
  try {
    const params = new URLSearchParams()
    
    if (options?.exact) {
      params.set("exact", name)
    } else {
      params.set("fuzzy", name)
    }
    
    if (options?.set) {
      params.set("set", options.set)
    }
    
    const response = await fetch(
      `${SCRYFALL_API}/cards/named?${params.toString()}`,
      { next: { revalidate: 3600 } }
    )
    
    const data: ScryfallResponse<ScryfallCard> = await response.json()
    
    if (isError(data)) {
      return null
    }
    
    return data
  } catch (error) {
    console.error("Scryfall API error:", error)
    return null
  }
}

// ── Get Card by ID ──
export async function getCardById(id: string): Promise<ScryfallCard | null> {
  try {
    const response = await fetch(
      `${SCRYFALL_API}/cards/${id}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    )
    
    const data: ScryfallResponse<ScryfallCard> = await response.json()
    
    if (isError(data)) {
      return null
    }
    
    return data
  } catch (error) {
    console.error("Scryfall API error:", error)
    return null
  }
}

// ── Autocomplete Card Names ──
export async function autocompleteCardName(query: string): Promise<string[]> {
  if (query.length < 2) return []
  
  try {
    const response = await fetch(
      `${SCRYFALL_API}/cards/autocomplete?q=${encodeURIComponent(query)}`,
      { next: { revalidate: 3600 } }
    )
    
    const data = await response.json()
    
    if (isError(data)) {
      return []
    }
    
    return data.data ?? []
  } catch (error) {
    console.error("Scryfall API error:", error)
    return []
  }
}

// ── Validate a Collection of Cards ──
export interface CardIdentifier {
  name?: string
  set?: string
  collector_number?: string
  id?: string
}

export async function validateCards(
  identifiers: CardIdentifier[]
): Promise<{ found: ScryfallCard[]; notFound: CardIdentifier[] }> {
  // Scryfall collection endpoint accepts up to 75 cards at a time
  const BATCH_SIZE = 75
  const found: ScryfallCard[] = []
  const notFound: CardIdentifier[] = []
  
  for (let i = 0; i < identifiers.length; i += BATCH_SIZE) {
    const batch = identifiers.slice(i, i + BATCH_SIZE)
    
    try {
      const response = await fetch(`${SCRYFALL_API}/cards/collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifiers: batch }),
      })
      
      const data = await response.json()
      
      if (!isError(data)) {
        found.push(...(data.data ?? []))
        notFound.push(...(data.not_found ?? []))
      }
    } catch (error) {
      console.error("Scryfall collection error:", error)
      notFound.push(...batch)
    }
    
    // Rate limiting
    if (i + BATCH_SIZE < identifiers.length) {
      await delay(100)
    }
  }
  
  return { found, notFound }
}

// ── Decklist Validation ──
export interface DecklistEntry {
  quantity: number
  cardName: string
  set?: string
  isCommander?: boolean
  isSideboard?: boolean
}

export interface DeckValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  cards: {
    entry: DecklistEntry
    card: ScryfallCard | null
    issues: string[]
  }[]
  stats: {
    totalCards: number
    mainboardCount: number
    sideboardCount: number
    uniqueCards: number
  }
}

export type Format = "standard" | "modern" | "legacy" | "vintage" | "pioneer" | "pauper" | "commander" | "brawl" | "historic" | "alchemy"

export async function validateDecklist(
  entries: DecklistEntry[],
  format: Format,
  options?: {
    minMainboard?: number
    maxMainboard?: number
    minSideboard?: number
    maxSideboard?: number
    maxCopies?: number
    allowedSets?: string[]
  }
): Promise<DeckValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const cardResults: DeckValidationResult["cards"] = []
  
  // Default rules
  const minMainboard = options?.minMainboard ?? 60
  const maxMainboard = options?.maxMainboard ?? Infinity
  const minSideboard = options?.minSideboard ?? 0
  const maxSideboard = options?.maxSideboard ?? 15
  const maxCopies = options?.maxCopies ?? (format === "commander" ? 1 : 4)
  
  // Count cards
  const mainboardEntries = entries.filter(e => !e.isSideboard)
  const sideboardEntries = entries.filter(e => e.isSideboard)
  const mainboardCount = mainboardEntries.reduce((sum, e) => sum + e.quantity, 0)
  const sideboardCount = sideboardEntries.reduce((sum, e) => sum + e.quantity, 0)
  
  // Validate card counts
  if (mainboardCount < minMainboard) {
    errors.push(`Mainboard has ${mainboardCount} cards, minimum is ${minMainboard}`)
  }
  if (mainboardCount > maxMainboard) {
    errors.push(`Mainboard has ${mainboardCount} cards, maximum is ${maxMainboard}`)
  }
  if (sideboardCount > maxSideboard) {
    errors.push(`Sideboard has ${sideboardCount} cards, maximum is ${maxSideboard}`)
  }
  
  // Validate individual cards
  const cardNameCounts: Record<string, number> = {}
  const identifiers: CardIdentifier[] = entries.map(e => ({
    name: e.cardName,
    set: e.set,
  }))
  
  const { found, notFound } = await validateCards(identifiers)
  
  // Map found cards by name for lookup
  const foundCardMap = new Map<string, ScryfallCard>()
  for (const card of found) {
    foundCardMap.set(card.name.toLowerCase(), card)
  }
  
  // Process each entry
  for (const entry of entries) {
    const issues: string[] = []
    const card = foundCardMap.get(entry.cardName.toLowerCase()) ?? null
    
    if (!card) {
      issues.push(`Card "${entry.cardName}" not found`)
    } else {
      // Check legality
      const legality = card.legalities[format]
      if (legality === "not_legal") {
        issues.push(`"${card.name}" is not legal in ${format}`)
      } else if (legality === "banned") {
        issues.push(`"${card.name}" is banned in ${format}`)
      } else if (legality === "restricted" && entry.quantity > 1) {
        issues.push(`"${card.name}" is restricted to 1 copy in ${format}`)
      }
      
      // Check copies (skip basic lands)
      const isBasicLand = card.type_line?.includes("Basic Land")
      if (!isBasicLand && !entry.isCommander) {
        const currentCount = cardNameCounts[card.name.toLowerCase()] ?? 0
        cardNameCounts[card.name.toLowerCase()] = currentCount + entry.quantity
        
        if (cardNameCounts[card.name.toLowerCase()] > maxCopies) {
          issues.push(`Too many copies of "${card.name}" (max ${maxCopies}, found ${cardNameCounts[card.name.toLowerCase()]})`)
        }
      }
      
      // Check set restrictions
      if (options?.allowedSets && !options.allowedSets.includes(card.set)) {
        warnings.push(`"${card.name}" from set "${card.set_name}" may not be allowed`)
      }
    }
    
    cardResults.push({ entry, card, issues })
    
    if (issues.length > 0) {
      errors.push(...issues)
    }
  }
  
  // Add not found cards to errors
  for (const nf of notFound) {
    if (nf.name && !errors.some(e => e.includes(nf.name!))) {
      errors.push(`Card "${nf.name}" not found in Scryfall database`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    cards: cardResults,
    stats: {
      totalCards: mainboardCount + sideboardCount,
      mainboardCount,
      sideboardCount,
      uniqueCards: entries.length,
    },
  }
}

// ── Parse Decklist Text ──
// Supports common formats like:
// 4 Lightning Bolt
// 4x Lightning Bolt
// 4 Lightning Bolt (M10)
// Sideboard:
// 2 Tormod's Crypt
export function parseDecklistText(text: string): DecklistEntry[] {
  const entries: DecklistEntry[] = []
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0)
  
  let isSideboard = false
  
  for (const line of lines) {
    // Check for sideboard marker
    if (line.toLowerCase().startsWith("sideboard") || line.toLowerCase() === "sb:") {
      isSideboard = true
      continue
    }
    
    // Skip comments
    if (line.startsWith("//") || line.startsWith("#")) {
      continue
    }
    
    // Parse card line: "4 Lightning Bolt" or "4x Lightning Bolt" or "4 Lightning Bolt (M10)"
    const match = line.match(/^(\d+)x?\s+(.+?)(?:\s+\(([A-Z0-9]+)\))?$/i)
    
    if (match) {
      const quantity = parseInt(match[1])
      const cardName = match[2].trim()
      const set = match[3]?.toLowerCase()
      
      entries.push({
        quantity,
        cardName,
        set,
        isSideboard,
      })
    }
  }
  
  return entries
}

/**
 * Pairing algorithms for tournament management.
 * Swiss pairing, elimination bracket seeding, and round robin scheduling.
 */

export interface PairingPlayer {
  id: string
  points: number
  opponents: string[]
  hasHadBye: boolean
  seed?: number
}

export interface Pairing {
  player1Id: string
  player2Id: string | null // null = bye
  tableNumber: number
}

// ══════════════════════════════════════════════════════════════════════════════
// Swiss Pairing Algorithm
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate Swiss pairings using the Dutch system.
 * - Players paired by similar points
 * - Avoid rematches
 * - Give byes to lowest-pointed players who haven't had one
 */
export function generateSwissPairings(players: PairingPlayer[]): Pairing[] {
  if (players.length === 0) return []
  if (players.length === 1) {
    return [{ player1Id: players[0].id, player2Id: null, tableNumber: 1 }]
  }

  // Sort by points (descending), with random tiebreak
  const sorted = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return Math.random() - 0.5
  })

  const pairings: Pairing[] = []
  const paired = new Set<string>()
  let tableNumber = 1

  // Try to pair from top to bottom
  for (const player of sorted) {
    if (paired.has(player.id)) continue

    // Find best available opponent
    let bestOpponent: PairingPlayer | null = null
    let bestScore = -Infinity

    for (const candidate of sorted) {
      if (candidate.id === player.id) continue
      if (paired.has(candidate.id)) continue
      if (player.opponents.includes(candidate.id)) continue // No rematches

      // Score: prefer similar points, slight randomness
      const pointDiff = Math.abs(player.points - candidate.points)
      const score = 1000 - pointDiff * 10 + Math.random() * 5

      if (score > bestScore) {
        bestScore = score
        bestOpponent = candidate
      }
    }

    if (bestOpponent) {
      pairings.push({
        player1Id: player.id,
        player2Id: bestOpponent.id,
        tableNumber: tableNumber++,
      })
      paired.add(player.id)
      paired.add(bestOpponent.id)
    }
  }

  // Handle odd player (bye)
  const unpaired = sorted.filter(p => !paired.has(p.id))
  if (unpaired.length > 0) {
    // Prefer giving bye to player who hasn't had one, lowest points
    const byeCandidate = unpaired
      .sort((a, b) => {
        if (a.hasHadBye !== b.hasHadBye) return a.hasHadBye ? 1 : -1
        return a.points - b.points
      })[0]

    pairings.push({
      player1Id: byeCandidate.id,
      player2Id: null,
      tableNumber: tableNumber++,
    })
  }

  return pairings
}

/**
 * Calculate recommended number of Swiss rounds based on player count.
 * Formula: ceil(log2(players)) for full tournament, typically 3-9 rounds.
 */
export function calculateSwissRounds(playerCount: number): number {
  if (playerCount <= 1) return 0
  if (playerCount <= 4) return 2
  if (playerCount <= 8) return 3
  if (playerCount <= 16) return 4
  if (playerCount <= 32) return 5
  if (playerCount <= 64) return 6
  if (playerCount <= 128) return 7
  if (playerCount <= 256) return 8
  if (playerCount <= 512) return 9
  return 10
}

// ══════════════════════════════════════════════════════════════════════════════
// Single Elimination Seeding
// ══════════════════════════════════════════════════════════════════════════════

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

/**
 * Generate standard bracket seeding for single elimination.
 * Seeds 1 and 2 are on opposite sides, etc.
 */
export function generateBracketSeeding(playerCount: number): number[] {
  const size = nextPowerOf2(playerCount)
  
  // Standard bracket positioning
  // For 8 players: [1,8,4,5,2,7,3,6]
  const positions: number[] = [1]
  
  for (let round = 1; round < Math.log2(size); round++) {
    const newPositions: number[] = []
    const sum = Math.pow(2, round) + 1
    
    for (const pos of positions) {
      newPositions.push(pos)
      newPositions.push(sum - pos)
    }
    
    positions.length = 0
    positions.push(...newPositions)
  }
  
  return positions
}

/**
 * Create first round pairings for single elimination from seeded players.
 */
export function generateEliminationPairings(
  players: PairingPlayer[],
  seedBy: "seed" | "points" | "random" = "seed"
): Pairing[] {
  const size = nextPowerOf2(players.length)
  const byeCount = size - players.length

  // Sort players by seed method
  let sorted: PairingPlayer[]
  switch (seedBy) {
    case "seed":
      sorted = [...players].sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
      break
    case "points":
      sorted = [...players].sort((a, b) => b.points - a.points)
      break
    case "random":
      sorted = [...players].sort(() => Math.random() - 0.5)
      break
  }

  // Get bracket positions
  const positions = generateBracketSeeding(size)
  
  // Map positions to players (with byes for missing seeds)
  const bracketSlots: (string | null)[] = new Array(size).fill(null)
  
  for (let i = 0; i < sorted.length; i++) {
    const position = positions[i] - 1 // 0-indexed
    bracketSlots[position] = sorted[i].id
  }

  // Create pairings
  const pairings: Pairing[] = []
  for (let i = 0; i < size; i += 2) {
    pairings.push({
      player1Id: bracketSlots[i] ?? bracketSlots[i + 1]!,
      player2Id: bracketSlots[i] && bracketSlots[i + 1] ? bracketSlots[i + 1] : null,
      tableNumber: Math.floor(i / 2) + 1,
    })
  }

  return pairings
}

// ══════════════════════════════════════════════════════════════════════════════
// Round Robin Scheduling
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate round robin schedule using the circle method.
 * Each player plays every other player once.
 */
export function generateRoundRobinSchedule(players: PairingPlayer[]): Pairing[][] {
  if (players.length < 2) return []

  const ids = players.map(p => p.id)
  const isOdd = ids.length % 2 !== 0
  if (isOdd) ids.push("BYE")

  const n = ids.length
  const rounds: Pairing[][] = []
  const totalRounds = n - 1

  // Create rotating schedule
  const fixed = ids[0]
  const rotating = ids.slice(1)

  for (let round = 0; round < totalRounds; round++) {
    const roundPairings: Pairing[] = []
    let tableNumber = 1

    // First pairing with fixed position
    const opponent = rotating[0]
    if (opponent !== "BYE") {
      roundPairings.push({
        player1Id: fixed,
        player2Id: opponent,
        tableNumber: tableNumber++,
      })
    } else {
      roundPairings.push({
        player1Id: fixed,
        player2Id: null,
        tableNumber: tableNumber++,
      })
    }

    // Remaining pairings
    for (let i = 1; i < n / 2; i++) {
      const p1 = rotating[i]
      const p2 = rotating[n - 1 - i - 1]
      
      if (p1 === "BYE" || p2 === "BYE") {
        roundPairings.push({
          player1Id: p1 === "BYE" ? p2 : p1,
          player2Id: null,
          tableNumber: tableNumber++,
        })
      } else {
        roundPairings.push({
          player1Id: p1,
          player2Id: p2,
          tableNumber: tableNumber++,
        })
      }
    }

    rounds.push(roundPairings)

    // Rotate (keep first element fixed)
    const last = rotating.pop()!
    rotating.unshift(last)
  }

  return rounds
}

// ══════════════════════════════════════════════════════════════════════════════
// Double Elimination Bracket Structure
// ══════════════════════════════════════════════════════════════════════════════

export interface BracketMatch {
  id: string
  roundNumber: number
  matchNumber: number
  bracketPool: "winners" | "losers" | "grand_final"
  player1Id: string | null
  player2Id: string | null
  winnerId: string | null
  loserId: string | null
  nextWinnerMatchId: string | null
  nextLoserMatchId: string | null
  isBye: boolean
}

/**
 * Generate double elimination bracket structure.
 * Returns match slots that can be filled as the tournament progresses.
 */
export function generateDoubleEliminationStructure(playerCount: number): {
  winnersRounds: number
  losersRounds: number
  totalMatches: number
  hasGrandFinalReset: boolean
} {
  const size = nextPowerOf2(playerCount)
  const winnersRounds = Math.log2(size)
  
  // Losers bracket has roughly 2x the rounds
  // Each winners round feeds losers from that round
  const losersRounds = (winnersRounds - 1) * 2

  // Total matches calculation:
  // Winners: size - 1 matches (including grand final)
  // Losers: approximately size - 2 matches
  const winnersMatches = size - 1
  const losersMatches = size - 2
  const grandFinal = 1 // + potential reset
  
  return {
    winnersRounds,
    losersRounds,
    totalMatches: winnersMatches + losersMatches + grandFinal,
    hasGrandFinalReset: true,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Shuffle array using Fisher-Yates algorithm.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Calculate cut line for advancement (e.g., Top 8).
 * Returns the minimum points/standing needed to advance.
 */
export function calculateCutLine(
  standings: Array<{ points: number; standing: number }>,
  advancementCount: number
): { minPoints: number; cutStanding: number } {
  if (standings.length === 0 || advancementCount <= 0) {
    return { minPoints: Infinity, cutStanding: 0 }
  }

  const sorted = [...standings].sort((a, b) => a.standing - b.standing)
  const cutIndex = Math.min(advancementCount - 1, sorted.length - 1)
  
  return {
    minPoints: sorted[cutIndex].points,
    cutStanding: advancementCount,
  }
}

/**
 * Get players who make the cut for advancement.
 */
export function getAdvancingPlayers<T extends { standing: number }>(
  standings: T[],
  advancementCount: number
): T[] {
  return standings
    .filter(s => s.standing <= advancementCount)
    .sort((a, b) => a.standing - b.standing)
}

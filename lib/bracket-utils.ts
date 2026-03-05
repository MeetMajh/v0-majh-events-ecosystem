/**
 * Bracket generation utilities for all 7 tournament formats.
 * Generates match structures that can be inserted into the `matches` table.
 */

export type BracketMatch = {
  round_number: number
  match_number: number
  bracket_pool: string | null
  pool_number: number | null
  participant_1_id: string | null
  participant_2_id: string | null
  status: "pending" | "in_progress" | "completed"
  // Populated after insert via IDs
  _temp_id?: number // local ref for wiring next_winner/loser
  _next_winner_temp?: number
  _next_loser_temp?: number
}

function nextPowerOf2(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Seed participants into bracket slots with BYEs for non-power-of-2 counts.
 * Returns array of [p1, p2] pairs for round 1.
 */
function seedBracket(participantIds: string[]): Array<[string | null, string | null]> {
  const size = nextPowerOf2(participantIds.length)
  const seeded = [...participantIds]
  // Fill remaining slots with null (BYE)
  while (seeded.length < size) seeded.push("")
  const pairs: Array<[string | null, string | null]> = []
  for (let i = 0; i < size; i += 2) {
    pairs.push([seeded[i] || null, seeded[i + 1] || null])
  }
  return pairs
}

// ──────────────────── Single Elimination ────────────────────

export function generateSingleElimination(participantIds: string[]): BracketMatch[] {
  const ids = shuffleArray(participantIds)
  const size = nextPowerOf2(ids.length)
  const totalRounds = Math.log2(size)
  const matches: BracketMatch[] = []
  let tempId = 1

  // Round 1
  const pairs = seedBracket(ids)
  const round1Ids: number[] = []

  for (let i = 0; i < pairs.length; i++) {
    const id = tempId++
    round1Ids.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "winners",
      pool_number: null,
      participant_1_id: pairs[i][0],
      participant_2_id: pairs[i][1],
      status: "pending",
      _temp_id: id,
    })
  }

  // Subsequent rounds
  let prevRoundIds = round1Ids
  for (let round = 2; round <= totalRounds; round++) {
    const roundIds: number[] = []
    const matchCount = prevRoundIds.length / 2
    for (let i = 0; i < matchCount; i++) {
      const id = tempId++
      roundIds.push(id)
      matches.push({
        round_number: round,
        match_number: i + 1,
        bracket_pool: "winners",
        pool_number: null,
        participant_1_id: null,
        participant_2_id: null,
        status: "pending",
        _temp_id: id,
      })
      // Wire previous round winners to this match
      const m1 = matches.find((m) => m._temp_id === prevRoundIds[i * 2])
      const m2 = matches.find((m) => m._temp_id === prevRoundIds[i * 2 + 1])
      if (m1) m1._next_winner_temp = id
      if (m2) m2._next_winner_temp = id
    }
    prevRoundIds = roundIds
  }

  return matches
}

// ──────────────────── Double Elimination ────────────────────

export function generateDoubleElimination(participantIds: string[]): BracketMatch[] {
  const ids = shuffleArray(participantIds)
  const size = nextPowerOf2(ids.length)
  const winnersRounds = Math.log2(size)
  const matches: BracketMatch[] = []
  let tempId = 1

  // Winners bracket round 1
  const pairs = seedBracket(ids)
  let prevWinnerIds: number[] = []

  for (let i = 0; i < pairs.length; i++) {
    const id = tempId++
    prevWinnerIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "winners",
      pool_number: null,
      participant_1_id: pairs[i][0],
      participant_2_id: pairs[i][1],
      status: "pending",
      _temp_id: id,
    })
  }

  // Winners bracket subsequent rounds
  for (let round = 2; round <= winnersRounds; round++) {
    const roundIds: number[] = []
    const matchCount = prevWinnerIds.length / 2
    for (let i = 0; i < matchCount; i++) {
      const id = tempId++
      roundIds.push(id)
      matches.push({
        round_number: round,
        match_number: i + 1,
        bracket_pool: "winners",
        pool_number: null,
        participant_1_id: null,
        participant_2_id: null,
        status: "pending",
        _temp_id: id,
      })
      const m1 = matches.find((m) => m._temp_id === prevWinnerIds[i * 2])
      const m2 = matches.find((m) => m._temp_id === prevWinnerIds[i * 2 + 1])
      if (m1) m1._next_winner_temp = id
      if (m2) m2._next_winner_temp = id
    }
    prevWinnerIds = roundIds
  }

  // Losers bracket: first round losers drop here
  const losersRound1Count = pairs.length / 2
  let prevLoserIds: number[] = []

  for (let i = 0; i < losersRound1Count; i++) {
    const id = tempId++
    prevLoserIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "losers",
      pool_number: null,
      participant_1_id: null,
      participant_2_id: null,
      status: "pending",
      _temp_id: id,
    })
  }

  // Wire R1 winners bracket losers to losers bracket R1
  const winnersR1 = matches.filter((m) => m.bracket_pool === "winners" && m.round_number === 1)
  for (let i = 0; i < winnersR1.length; i++) {
    const loserMatchIdx = Math.floor(i / 2)
    if (prevLoserIds[loserMatchIdx]) {
      winnersR1[i]._next_loser_temp = prevLoserIds[loserMatchIdx]
    }
  }

  // Continue losers bracket rounds
  let losersRound = 2
  while (prevLoserIds.length > 1) {
    const roundIds: number[] = []
    const matchCount = Math.ceil(prevLoserIds.length / 2)
    for (let i = 0; i < matchCount; i++) {
      const id = tempId++
      roundIds.push(id)
      matches.push({
        round_number: losersRound,
        match_number: i + 1,
        bracket_pool: "losers",
        pool_number: null,
        participant_1_id: null,
        participant_2_id: null,
        status: "pending",
        _temp_id: id,
      })
      const m1 = matches.find((m) => m._temp_id === prevLoserIds[i * 2])
      if (m1) m1._next_winner_temp = id
      if (prevLoserIds[i * 2 + 1]) {
        const m2 = matches.find((m) => m._temp_id === prevLoserIds[i * 2 + 1])
        if (m2) m2._next_winner_temp = id
      }
    }
    prevLoserIds = roundIds
    losersRound++
  }

  // Grand Final
  const grandFinalId = tempId++
  matches.push({
    round_number: winnersRounds + 1,
    match_number: 1,
    bracket_pool: "grand_final",
    pool_number: null,
    participant_1_id: null,
    participant_2_id: null,
    status: "pending",
    _temp_id: grandFinalId,
  })

  // Wire winners final and losers final to grand final
  const winnersFinal = matches.find((m) => m._temp_id === prevWinnerIds[0])
  if (winnersFinal) winnersFinal._next_winner_temp = grandFinalId
  const losersFinal = matches.find((m) => m._temp_id === prevLoserIds[0])
  if (losersFinal) losersFinal._next_winner_temp = grandFinalId

  return matches
}

// ──────────────────── Triple Elimination ────────────────────

export function generateTripleElimination(participantIds: string[]): BracketMatch[] {
  // Triple elim = double elim structure + third_chance bracket
  const baseMatches = generateDoubleElimination(participantIds)
  let tempId = Math.max(...baseMatches.map((m) => m._temp_id ?? 0)) + 1

  // Third chance bracket: losers from losers bracket R1 get one more chance
  const losersR1 = baseMatches.filter((m) => m.bracket_pool === "losers" && m.round_number === 1)
  const thirdChanceR1: BracketMatch[] = []
  const thirdIds: number[] = []

  const matchCount = Math.ceil(losersR1.length / 2)
  for (let i = 0; i < matchCount; i++) {
    const id = tempId++
    thirdIds.push(id)
    thirdChanceR1.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "third_chance",
      pool_number: null,
      participant_1_id: null,
      participant_2_id: null,
      status: "pending",
      _temp_id: id,
    })
  }

  // Wire losers R1 losers to third chance
  for (let i = 0; i < losersR1.length; i++) {
    const thirdIdx = Math.floor(i / 2)
    if (thirdIds[thirdIdx]) {
      losersR1[i]._next_loser_temp = thirdIds[thirdIdx]
    }
  }

  // Third chance subsequent rounds
  let prevThirdIds = thirdIds
  let round = 2
  while (prevThirdIds.length > 1) {
    const roundIds: number[] = []
    const mc = Math.ceil(prevThirdIds.length / 2)
    for (let i = 0; i < mc; i++) {
      const id = tempId++
      roundIds.push(id)
      thirdChanceR1.push({
        round_number: round,
        match_number: i + 1,
        bracket_pool: "third_chance",
        pool_number: null,
        participant_1_id: null,
        participant_2_id: null,
        status: "pending",
        _temp_id: id,
      })
      const m1 = [...baseMatches, ...thirdChanceR1].find((m) => m._temp_id === prevThirdIds[i * 2])
      if (m1) m1._next_winner_temp = id
      if (prevThirdIds[i * 2 + 1]) {
        const m2 = [...baseMatches, ...thirdChanceR1].find((m) => m._temp_id === prevThirdIds[i * 2 + 1])
        if (m2) m2._next_winner_temp = id
      }
    }
    prevThirdIds = roundIds
    round++
  }

  return [...baseMatches, ...thirdChanceR1]
}

// ──────────────────── Round Robin ────────────────────

export function generateRoundRobin(participantIds: string[]): BracketMatch[] {
  const ids = shuffleArray(participantIds)
  const matches: BracketMatch[] = []
  let tempId = 1

  // Generate all pairings using round-robin scheduling
  const n = ids.length
  const isOdd = n % 2 !== 0
  const players = [...ids]
  if (isOdd) players.push("") // BYE

  const totalRounds = players.length - 1
  const halfSize = players.length / 2

  for (let round = 0; round < totalRounds; round++) {
    let matchNum = 1
    for (let i = 0; i < halfSize; i++) {
      const p1 = players[i]
      const p2 = players[players.length - 1 - i]
      if (!p1 || !p2) continue // Skip BYE matches

      matches.push({
        round_number: round + 1,
        match_number: matchNum++,
        bracket_pool: "round_robin",
        pool_number: null,
        participant_1_id: p1,
        participant_2_id: p2,
        status: "pending",
        _temp_id: tempId++,
      })
    }

    // Rotate players (keep first player fixed)
    const last = players.pop()!
    players.splice(1, 0, last)
  }

  return matches
}

// ──────────────────── 3-Game Guarantee ────────────────────

export function generateThreeGameGuarantee(participantIds: string[], poolSize = 4): BracketMatch[] {
  const ids = shuffleArray(participantIds)
  const matches: BracketMatch[] = []
  let tempId = 1

  // Divide into pools
  const poolCount = Math.ceil(ids.length / poolSize)
  const pools: string[][] = []
  for (let i = 0; i < poolCount; i++) {
    pools.push(ids.slice(i * poolSize, (i + 1) * poolSize))
  }

  // Generate round-robin within each pool
  for (let poolIdx = 0; poolIdx < pools.length; poolIdx++) {
    const pool = pools[poolIdx]
    const n = pool.length
    if (n < 2) continue

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        matches.push({
          round_number: 1,
          match_number: matches.length + 1,
          bracket_pool: "pool_play",
          pool_number: poolIdx + 1,
          participant_1_id: pool[i],
          participant_2_id: pool[j],
          status: "pending",
          _temp_id: tempId++,
        })
      }
    }
  }

  // Playoff bracket slots (filled after pool play completes)
  const playoffSize = nextPowerOf2(poolCount * 2) // Top 2 from each pool
  const playoffRounds = Math.log2(playoffSize)
  let prevIds: number[] = []

  for (let i = 0; i < playoffSize / 2; i++) {
    const id = tempId++
    prevIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "playoff",
      pool_number: null,
      participant_1_id: null,
      participant_2_id: null,
      status: "pending",
      _temp_id: id,
    })
  }

  for (let round = 2; round <= playoffRounds; round++) {
    const roundIds: number[] = []
    const mc = prevIds.length / 2
    for (let i = 0; i < mc; i++) {
      const id = tempId++
      roundIds.push(id)
      matches.push({
        round_number: round,
        match_number: i + 1,
        bracket_pool: "playoff",
        pool_number: null,
        participant_1_id: null,
        participant_2_id: null,
        status: "pending",
        _temp_id: id,
      })
      const m1 = matches.find((m) => m._temp_id === prevIds[i * 2])
      const m2 = matches.find((m) => m._temp_id === prevIds[i * 2 + 1])
      if (m1) m1._next_winner_temp = id
      if (m2) m2._next_winner_temp = id
    }
    prevIds = roundIds
  }

  return matches
}

// ──────────────────── Consolation Bracket ────────────────────

export function generateConsolation(participantIds: string[]): BracketMatch[] {
  const ids = shuffleArray(participantIds)
  const size = nextPowerOf2(ids.length)
  const totalRounds = Math.log2(size)
  const matches: BracketMatch[] = []
  let tempId = 1

  // Winners bracket (standard single elim)
  const pairs = seedBracket(ids)
  let prevWinnerIds: number[] = []

  for (let i = 0; i < pairs.length; i++) {
    const id = tempId++
    prevWinnerIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "winners",
      pool_number: null,
      participant_1_id: pairs[i][0],
      participant_2_id: pairs[i][1],
      status: "pending",
      _temp_id: id,
    })
  }

  // Consolation bracket: R1 losers play here
  const consolationR1Count = Math.ceil(pairs.length / 2)
  const consolationR1Ids: number[] = []

  for (let i = 0; i < consolationR1Count; i++) {
    const id = tempId++
    consolationR1Ids.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "consolation",
      pool_number: null,
      participant_1_id: null,
      participant_2_id: null,
      status: "pending",
      _temp_id: id,
    })
  }

  // Wire R1 losers to consolation
  for (let i = 0; i < prevWinnerIds.length; i++) {
    const consolIdx = Math.floor(i / 2)
    if (consolationR1Ids[consolIdx]) {
      const m = matches.find((m) => m._temp_id === prevWinnerIds[i])
      if (m) m._next_loser_temp = consolationR1Ids[consolIdx]
    }
  }

  // Continue winners bracket
  for (let round = 2; round <= totalRounds; round++) {
    const roundIds: number[] = []
    const mc = prevWinnerIds.length / 2
    for (let i = 0; i < mc; i++) {
      const id = tempId++
      roundIds.push(id)
      matches.push({
        round_number: round,
        match_number: i + 1,
        bracket_pool: "winners",
        pool_number: null,
        participant_1_id: null,
        participant_2_id: null,
        status: "pending",
        _temp_id: id,
      })
      const m1 = matches.find((m) => m._temp_id === prevWinnerIds[i * 2])
      const m2 = matches.find((m) => m._temp_id === prevWinnerIds[i * 2 + 1])
      if (m1) m1._next_winner_temp = id
      if (m2) m2._next_winner_temp = id
    }
    prevWinnerIds = roundIds
  }

  // Continue consolation bracket rounds
  let prevConsolIds = consolationR1Ids
  let consolRound = 2
  while (prevConsolIds.length > 1) {
    const roundIds: number[] = []
    const mc = Math.ceil(prevConsolIds.length / 2)
    for (let i = 0; i < mc; i++) {
      const id = tempId++
      roundIds.push(id)
      matches.push({
        round_number: consolRound,
        match_number: i + 1,
        bracket_pool: "consolation",
        pool_number: null,
        participant_1_id: null,
        participant_2_id: null,
        status: "pending",
        _temp_id: id,
      })
      const m1 = matches.find((m) => m._temp_id === prevConsolIds[i * 2])
      if (m1) m1._next_winner_temp = id
      if (prevConsolIds[i * 2 + 1]) {
        const m2 = matches.find((m) => m._temp_id === prevConsolIds[i * 2 + 1])
        if (m2) m2._next_winner_temp = id
      }
    }
    prevConsolIds = roundIds
    consolRound++
  }

  return matches
}

// ──────────────────── Compass Draw ────────────────────

export function generateCompassDraw(participantIds: string[]): BracketMatch[] {
  // Compass draw: N/E/S/W quadrants
  // North = main bracket. Losers from North go to East.
  // Losers from East go to South. Losers from South go to West.
  // Each quadrant is single elim.
  const ids = shuffleArray(participantIds)
  const size = nextPowerOf2(ids.length)
  const rounds = Math.log2(size)
  const matches: BracketMatch[] = []
  let tempId = 1

  // North bracket (main)
  const pairs = seedBracket(ids)
  let prevNorthIds: number[] = []

  for (let i = 0; i < pairs.length; i++) {
    const id = tempId++
    prevNorthIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "north",
      pool_number: null,
      participant_1_id: pairs[i][0],
      participant_2_id: pairs[i][1],
      status: "pending",
      _temp_id: id,
    })
  }

  // East bracket R1: North R1 losers
  const eastR1Count = Math.ceil(pairs.length / 2)
  let prevEastIds: number[] = []
  for (let i = 0; i < eastR1Count; i++) {
    const id = tempId++
    prevEastIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "east",
      pool_number: null,
      participant_1_id: null,
      participant_2_id: null,
      status: "pending",
      _temp_id: id,
    })
  }

  // Wire North R1 losers -> East R1
  for (let i = 0; i < prevNorthIds.length; i++) {
    const eastIdx = Math.floor(i / 2)
    if (prevEastIds[eastIdx]) {
      const m = matches.find((m) => m._temp_id === prevNorthIds[i])
      if (m) m._next_loser_temp = prevEastIds[eastIdx]
    }
  }

  // South bracket R1: East R1 losers
  const southR1Count = Math.ceil(eastR1Count / 2)
  let prevSouthIds: number[] = []
  for (let i = 0; i < southR1Count; i++) {
    const id = tempId++
    prevSouthIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "south",
      pool_number: null,
      participant_1_id: null,
      participant_2_id: null,
      status: "pending",
      _temp_id: id,
    })
  }

  for (let i = 0; i < prevEastIds.length; i++) {
    const southIdx = Math.floor(i / 2)
    if (prevSouthIds[southIdx]) {
      const m = matches.find((m) => m._temp_id === prevEastIds[i])
      if (m) m._next_loser_temp = prevSouthIds[southIdx]
    }
  }

  // West bracket R1: South R1 losers
  const westR1Count = Math.max(1, Math.ceil(southR1Count / 2))
  let prevWestIds: number[] = []
  for (let i = 0; i < westR1Count; i++) {
    const id = tempId++
    prevWestIds.push(id)
    matches.push({
      round_number: 1,
      match_number: i + 1,
      bracket_pool: "west",
      pool_number: null,
      participant_1_id: null,
      participant_2_id: null,
      status: "pending",
      _temp_id: id,
    })
  }

  for (let i = 0; i < prevSouthIds.length; i++) {
    const westIdx = Math.floor(i / 2)
    if (prevWestIds[westIdx]) {
      const m = matches.find((m) => m._temp_id === prevSouthIds[i])
      if (m) m._next_loser_temp = prevWestIds[westIdx]
    }
  }

  // Continue each bracket until final
  const continueBracket = (prevIds: number[], pool: string) => {
    let currentIds = prevIds
    let round = 2
    while (currentIds.length > 1) {
      const roundIds: number[] = []
      const mc = Math.ceil(currentIds.length / 2)
      for (let i = 0; i < mc; i++) {
        const id = tempId++
        roundIds.push(id)
        matches.push({
          round_number: round,
          match_number: i + 1,
          bracket_pool: pool,
          pool_number: null,
          participant_1_id: null,
          participant_2_id: null,
          status: "pending",
          _temp_id: id,
        })
        const m1 = matches.find((m) => m._temp_id === currentIds[i * 2])
        if (m1) m1._next_winner_temp = id
        if (currentIds[i * 2 + 1]) {
          const m2 = matches.find((m) => m._temp_id === currentIds[i * 2 + 1])
          if (m2) m2._next_winner_temp = id
        }
      }
      currentIds = roundIds
      round++
    }
  }

  continueBracket(prevNorthIds, "north")
  continueBracket(prevEastIds, "east")
  continueBracket(prevSouthIds, "south")
  continueBracket(prevWestIds, "west")

  return matches
}

// ──────────────────── Format Dispatcher ────────────────────

export type TournamentFormat =
  | "single_elimination"
  | "double_elimination"
  | "triple_elimination"
  | "round_robin"
  | "three_game_guarantee"
  | "consolation"
  | "compass_draw"

export function generateBracket(format: TournamentFormat, participantIds: string[]): BracketMatch[] {
  switch (format) {
    case "single_elimination":
      return generateSingleElimination(participantIds)
    case "double_elimination":
      return generateDoubleElimination(participantIds)
    case "triple_elimination":
      return generateTripleElimination(participantIds)
    case "round_robin":
      return generateRoundRobin(participantIds)
    case "three_game_guarantee":
      return generateThreeGameGuarantee(participantIds)
    case "consolation":
      return generateConsolation(participantIds)
    case "compass_draw":
      return generateCompassDraw(participantIds)
    default:
      return generateSingleElimination(participantIds)
  }
}

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  single_elimination: "Single Elimination",
  double_elimination: "Double Elimination",
  triple_elimination: "Triple Elimination",
  round_robin: "Round Robin",
  three_game_guarantee: "3-Game Guarantee",
  consolation: "Consolation",
  compass_draw: "Compass Draw",
}

export const GAME_CATEGORIES: Record<string, string> = {
  console: "Console",
  tcg: "TCG",
  pc: "PC",
  tabletop: "Tabletop",
  sport: "Sports",
  other: "Other",
}

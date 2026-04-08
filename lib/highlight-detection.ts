"use server"

import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// Highlight candidate schema
const HighlightCandidateSchema = z.object({
  timestamp: z.number().describe("Timestamp in seconds where the highlight occurs"),
  duration: z.number().describe("Suggested clip duration in seconds (15-60)"),
  type: z.enum([
    "clutch_play",
    "comeback",
    "upset",
    "skill_display",
    "crowd_moment",
    "hype_moment",
    "close_finish",
  ]).describe("Type of highlight moment"),
  confidence: z.number().min(0).max(1).describe("Confidence score 0-1"),
  description: z.string().describe("Brief description of what happened"),
  title_suggestion: z.string().describe("Suggested title for the clip"),
})

const HighlightAnalysisSchema = z.object({
  has_highlights: z.boolean(),
  highlights: z.array(HighlightCandidateSchema),
  overall_match_excitement: z.number().min(0).max(10).describe("Match excitement score 0-10"),
  recommended_full_vod: z.boolean().describe("Whether the full match is worth watching"),
})

export type HighlightCandidate = z.infer<typeof HighlightCandidateSchema>
export type HighlightAnalysis = z.infer<typeof HighlightAnalysisSchema>

/**
 * Engagement event for tracking match moments
 */
export interface EngagementEvent {
  timestamp: number // seconds into match
  type: "chat_spike" | "reaction" | "viewer_peak" | "score_change" | "timeout" | "close_game"
  intensity: number // 0-1 scale
  context?: string
}

/**
 * Analyze match data to detect potential highlight moments
 * Uses engagement signals + AI to identify clip-worthy moments
 */
export async function analyzeMatchForHighlights(
  matchId: string,
  options?: {
    includeEngagement?: boolean
    minConfidence?: number
  }
): Promise<HighlightAnalysis> {
  const supabase = await createClient()
  const { minConfidence = 0.6 } = options || {}
  
  // Get match data
  const { data: match, error: matchError } = await supabase
    .from("tournament_matches")
    .select(`
      id,
      player1_id,
      player2_id,
      player1_wins,
      player2_wins,
      draws,
      status,
      is_feature_match,
      started_at,
      completed_at,
      tournament_rounds(
        round_number,
        tournament_phases(
          tournaments(
            name,
            games(name, category)
          )
        )
      )
    `)
    .eq("id", matchId)
    .single()
  
  if (matchError || !match) {
    console.error("[Highlight Detection] Match not found:", matchError)
    return {
      has_highlights: false,
      highlights: [],
      overall_match_excitement: 0,
      recommended_full_vod: false,
    }
  }
  
  // Get player names
  const playerIds = [match.player1_id, match.player2_id].filter(Boolean)
  const { data: players } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, username")
    .in("id", playerIds)
  
  const playerMap = new Map(
    (players || []).map(p => [
      p.id, 
      `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.username || "Unknown"
    ])
  )
  
  // Build match context
  const tournament = match.tournament_rounds?.[0]?.tournament_phases?.[0]?.tournaments
  const game = tournament?.games
  const matchContext = {
    tournament_name: tournament?.name || "Unknown Tournament",
    game_name: game?.name || "Unknown Game",
    game_category: game?.category || "gaming",
    player1: playerMap.get(match.player1_id) || "Player 1",
    player2: playerMap.get(match.player2_id) || "Player 2",
    score: `${match.player1_wins || 0}-${match.player2_wins || 0}`,
    draws: match.draws || 0,
    is_feature_match: match.is_feature_match,
    status: match.status,
    duration_minutes: match.started_at && match.completed_at
      ? Math.round((new Date(match.completed_at).getTime() - new Date(match.started_at).getTime()) / 60000)
      : null,
  }
  
  // Check for engagement events (if enabled and data exists)
  let engagementEvents: EngagementEvent[] = []
  if (options?.includeEngagement) {
    // This would pull from match_engagement_events table
    // For MVP, we'll generate basic events from match data
    engagementEvents = generateBasicEngagementEvents(matchContext)
  }
  
  // Use AI to analyze for highlights
  try {
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an esports highlight detection system for MAJH Events. 
Analyze match data and engagement signals to identify potential highlight-worthy moments.

Consider these factors:
- Close games (small score differences)
- Comeback scenarios
- Clutch plays in final rounds
- Upset victories (unexpected winners)
- High-intensity moments (chat spikes, reactions)
- Feature matches (higher importance)

For each potential highlight, estimate:
- The timestamp (in seconds) where the action likely occurs
- Recommended clip duration (15-60 seconds)
- Type of highlight
- Confidence level

Only suggest highlights you're confident about. Gaming moments should be exciting and shareable.`
        },
        {
          role: "user",
          content: `Analyze this match for highlight potential:

Match Details:
- Tournament: ${matchContext.tournament_name}
- Game: ${matchContext.game_name} (${matchContext.game_category})
- Players: ${matchContext.player1} vs ${matchContext.player2}
- Final Score: ${matchContext.score}${matchContext.draws > 0 ? ` (${matchContext.draws} draws)` : ""}
- Feature Match: ${matchContext.is_feature_match ? "Yes" : "No"}
- Duration: ${matchContext.duration_minutes ? `${matchContext.duration_minutes} minutes` : "Unknown"}

${engagementEvents.length > 0 ? `
Engagement Events:
${engagementEvents.map(e => `- ${Math.floor(e.timestamp / 60)}:${(e.timestamp % 60).toString().padStart(2, '0')} - ${e.type} (intensity: ${e.intensity.toFixed(2)})${e.context ? `: ${e.context}` : ""}`).join("\n")}
` : ""}

Identify highlight-worthy moments and rate overall match excitement.`
        }
      ],
      output: Output.object({
        schema: HighlightAnalysisSchema,
      }),
    })
    
    // Filter by confidence
    const analysis = result.object
    analysis.highlights = analysis.highlights.filter(h => h.confidence >= minConfidence)
    analysis.has_highlights = analysis.highlights.length > 0
    
    return analysis
  } catch (error) {
    console.error("[Highlight Detection] AI analysis failed:", error)
    
    // Fallback: basic rule-based detection
    return generateRuleBasedHighlights(matchContext)
  }
}

/**
 * Generate basic engagement events from match data
 */
function generateBasicEngagementEvents(matchContext: {
  score: string
  draws: number
  is_feature_match: boolean
  duration_minutes: number | null
}): EngagementEvent[] {
  const events: EngagementEvent[] = []
  const [p1Score, p2Score] = matchContext.score.split("-").map(Number)
  
  // Close game event
  if (Math.abs(p1Score - p2Score) <= 1) {
    events.push({
      timestamp: (matchContext.duration_minutes || 30) * 60 * 0.9, // Near end
      type: "close_game",
      intensity: 0.9,
      context: "Match went down to the wire",
    })
  }
  
  // Score changes (simulate based on final score)
  const totalGames = p1Score + p2Score + matchContext.draws
  let currentP1 = 0, currentP2 = 0
  for (let i = 0; i < totalGames; i++) {
    const timestamp = ((matchContext.duration_minutes || 30) * 60 / totalGames) * (i + 1)
    
    // Simulate who won this game
    if (currentP1 < p1Score && (currentP2 >= p2Score || Math.random() > 0.5)) {
      currentP1++
      events.push({
        timestamp,
        type: "score_change",
        intensity: 0.5 + (i / totalGames) * 0.4, // Intensity increases as match progresses
        context: `Score: ${currentP1}-${currentP2}`,
      })
    } else if (currentP2 < p2Score) {
      currentP2++
      events.push({
        timestamp,
        type: "score_change",
        intensity: 0.5 + (i / totalGames) * 0.4,
        context: `Score: ${currentP1}-${currentP2}`,
      })
    }
  }
  
  return events
}

/**
 * Fallback rule-based highlight detection
 */
function generateRuleBasedHighlights(matchContext: {
  score: string
  draws: number
  is_feature_match: boolean
  duration_minutes: number | null
  player1: string
  player2: string
}): HighlightAnalysis {
  const highlights: HighlightCandidate[] = []
  const [p1Score, p2Score] = matchContext.score.split("-").map(Number)
  const totalGames = p1Score + p2Score + matchContext.draws
  const duration = (matchContext.duration_minutes || 30) * 60
  
  // Close finish
  if (Math.abs(p1Score - p2Score) <= 1 && totalGames >= 3) {
    highlights.push({
      timestamp: duration * 0.85,
      duration: 45,
      type: "close_finish",
      confidence: 0.75,
      description: `Final game between ${matchContext.player1} and ${matchContext.player2}`,
      title_suggestion: `INTENSE Final Game - ${matchContext.player1} vs ${matchContext.player2}`,
    })
  }
  
  // Comeback potential
  if ((p1Score >= 2 && p2Score >= 2) || matchContext.draws >= 2) {
    highlights.push({
      timestamp: duration * 0.6,
      duration: 30,
      type: "comeback",
      confidence: 0.65,
      description: "Mid-match momentum shift",
      title_suggestion: `The Comeback Begins! ${matchContext.player1} vs ${matchContext.player2}`,
    })
  }
  
  // Feature match bonus
  const excitement = matchContext.is_feature_match 
    ? Math.min(10, 5 + (Math.abs(p1Score - p2Score) <= 1 ? 3 : 0) + (totalGames >= 5 ? 2 : 0))
    : 3 + (Math.abs(p1Score - p2Score) <= 1 ? 2 : 0) + (totalGames >= 5 ? 1 : 0)
  
  return {
    has_highlights: highlights.length > 0,
    highlights,
    overall_match_excitement: excitement,
    recommended_full_vod: excitement >= 7,
  }
}

/**
 * Save highlight candidates to database for review
 */
export async function saveHighlightCandidates(
  matchId: string,
  highlights: HighlightCandidate[]
): Promise<{ saved: number }> {
  const supabase = await createClient()
  
  // Try to insert into highlight_candidates table
  const candidates = highlights.map(h => ({
    match_id: matchId,
    timestamp_seconds: h.timestamp,
    duration_seconds: h.duration,
    highlight_type: h.type,
    confidence: h.confidence,
    description: h.description,
    title_suggestion: h.title_suggestion,
    status: "pending",
  }))
  
  const { data, error } = await supabase
    .from("highlight_candidates")
    .insert(candidates)
    .select("id")
  
  if (error) {
    // Table might not exist yet
    console.error("[Highlight Detection] Failed to save candidates:", error)
    return { saved: 0 }
  }
  
  return { saved: data?.length || 0 }
}

/**
 * Batch process completed matches for highlights
 */
export async function processMatchesForHighlights(
  limit: number = 10
): Promise<{ processed: number; highlights_found: number }> {
  const supabase = await createClient()
  
  // Get recent completed matches without highlights
  const { data: matches, error } = await supabase
    .from("tournament_matches")
    .select("id")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(limit)
  
  if (error || !matches) {
    return { processed: 0, highlights_found: 0 }
  }
  
  let totalHighlights = 0
  
  for (const match of matches) {
    const analysis = await analyzeMatchForHighlights(match.id, {
      includeEngagement: true,
      minConfidence: 0.6,
    })
    
    if (analysis.has_highlights) {
      await saveHighlightCandidates(match.id, analysis.highlights)
      totalHighlights += analysis.highlights.length
    }
  }
  
  return {
    processed: matches.length,
    highlights_found: totalHighlights,
  }
}

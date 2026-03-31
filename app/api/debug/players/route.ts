import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

function parseCsv(input: string | null) {
  if (!input) return null
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) return new NextResponse("Unauthorized", { status: 401 })

  const url = new URL(req.url)
  const participantStatus = parseCsv(url.searchParams.get("participantStatus")) // tournament_participants.status
  const startDateFrom = url.searchParams.get("startDateFrom") // YYYY-MM-DD
  const startDateTo = url.searchParams.get("startDateTo")
  const tournamentType = url.searchParams.get("tournamentType") // tournaments.type
  const gameId = url.searchParams.get("gameId")
  const tournamentStatus = url.searchParams.get("tournamentStatus") // tournaments.status
  const includePast = url.searchParams.get("includePast") // default true

  const includePastBool = includePast === null ? true : includePast === "true"

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // Current user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr || !user) return NextResponse.json({ error: "Invalid auth" }, { status: 401 })

  const userId = user.id

  // Access check (owner/manager)
  const { data: staff, error: staffErr } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["owner", "manager"])

  if (staffErr) return NextResponse.json({ error: staffErr.message }, { status: 500 })

  const isOwnerOrManager = (staff?.length ?? 0) > 0

  // Build allowed tournament_id list depending on organizer vs owner/manager
  // (Organizer-only => tournaments.created_by = auth.uid())
  // If owner/manager => allow all tournaments (subject to optional filters below)
  let allowedTournamentIds: string[] | null = null

  if (!isOwnerOrManager) {
    const { data: tData, error: tErr } = await supabase
      .from("tournaments")
      .select("id")
      .eq("created_by", userId)

    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })

    allowedTournamentIds = (tData ?? []).map((t) => t.id)
    if (allowedTournamentIds.length === 0) {
      return NextResponse.json({ participants: [], summary: { participantsCount: 0, tournamentsCount: 0 } })
    }
  }

  // Default participant statuses
  const participantStatusFilter = participantStatus ?? ["registered", "checked_in"]

  // 1) Fetch filtered tournament_participants
  //    We filter by tournament_id using allowedTournamentIds if organizer-only.
  let participantsQuery = supabase
    .from("tournament_participants")
    .select("id,tournament_id,user_id,seed_number,status,payment_status,registered_at")

  // Optional participant status filter
  participantsQuery = participantsQuery.in("status", participantStatusFilter)

  // Optional filters that require tournaments table:
  // We do these by filtering tournament_participants.tournament_id IN (subquery),
  // which is safe even if RLS differs between tables.
  let tournamentIdsQuery = supabase
    .from("tournaments")
    .select("id")

  if (allowedTournamentIds) {
    tournamentIdsQuery = tournamentIdsQuery.in("id", allowedTournamentIds)
  }

  if (tournamentType) tournamentIdsQuery = tournamentIdsQuery.eq("type", tournamentType)
  if (gameId) tournamentIdsQuery = tournamentIdsQuery.eq("game_id", gameId)
  if (tournamentStatus) tournamentIdsQuery = tournamentIdsQuery.eq("status", tournamentStatus)

  if (startDateFrom) tournamentIdsQuery = tournamentIdsQuery.gte("start_date", startDateFrom)
  if (startDateTo) tournamentIdsQuery = tournamentIdsQuery.lte("start_date", startDateTo)

  // If includePast=false, limit to current/upcoming tournaments by end_date
  if (!includePastBool) {
    tournamentIdsQuery = tournamentIdsQuery.or(
      `end_date.gte.${new Date().toISOString().slice(0, 10)},end_date.is.null`
    )
  }

  const { data: tournamentIdsRows, error: tournamentIdsErr } = await tournamentIdsQuery

  if (tournamentIdsErr) return NextResponse.json({ error: tournamentIdsErr.message }, { status: 500 })

  const tournamentIds = (tournamentIdsRows ?? []).map((t) => t.id)

  if (tournamentIds.length === 0) {
    return NextResponse.json({ participants: [], summary: { participantsCount: 0, tournamentsCount: 0 } })
  }

  participantsQuery = participantsQuery.in("tournament_id", tournamentIds)

  const { data: participantRows, error: participantsErr } = await participantsQuery
    .order("registered_at", { ascending: false })

  if (participantsErr) return NextResponse.json({ error: participantsErr.message }, { status: 500 })

  // 2) Fetch matching players (history-capable)
  const tournamentIdSet = new Set(participantRows?.map((p) => p.tournament_id) ?? [])
  const userIdSet = new Set(participantRows?.map((p) => p.user_id) ?? [])

  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id,tournament_id,user_id,name,seed,rating,points,omw,buchholz,has_bye")
    .in("tournament_id", Array.from(tournamentIdSet))
    .in("user_id", Array.from(userIdSet))

  if (playersErr) return NextResponse.json({ error: playersErr.message }, { status: 500 })

  const playersByKey = new Map(
    (players ?? []).map((pl) => [`${pl.tournament_id}:${pl.user_id}`, pl])
  )

  const enriched = (participantRows ?? []).map((p) => ({
    ...p,
    player: playersByKey.get(`${p.tournament_id}:${p.user_id}`) ?? null,
  }))

  return NextResponse.json({
    participants: enriched,
    summary: {
      participantsCount: enriched.length,
      tournamentsCount: tournamentIdSet.size,
    },
  })
}

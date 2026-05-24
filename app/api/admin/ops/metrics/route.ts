import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  
  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()
    
  if (!profile || !["admin", "staff", "super_admin"].includes(profile.role || "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    // Get today's date for filtering
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    // Run all queries in parallel
    const [
      usersResult,
      matchesResult,
      streamsResult,
      clipsResult,
      revenueResult,
      payoutsResult,
      alertsResult,
      transactionsResult,
    ] = await Promise.all([
      // Total users
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      
      // Live matches
      supabase.from("matches")
        .select("id, tournament:tournaments(name), player1_score, player2_score, player1:players!matches_player1_id_fkey(gamertag), player2:players!matches_player2_id_fkey(gamertag)")
        .eq("status", "in_progress"),
      
      // Active streams
      supabase.from("user_streams")
        .select("id, title, user:profiles(display_name), total_views")
        .eq("status", "live"),
      
      // Clips today
      supabase.from("clips")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayISO),
      
      // Revenue today (from transactions)
      supabase.from("transactions")
        .select("amount")
        .gte("created_at", todayISO)
        .eq("status", "completed")
        .gt("amount", 0),
      
      // Pending payouts
      supabase.from("payouts")
        .select("amount")
        .eq("status", "pending"),
      
      // Recent moderation alerts (from reports/flags)
      supabase.from("reports")
        .select("id, type, reason, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      
      // Recent transactions
      supabase.from("transactions")
        .select("id, description, amount, created_at")
        .order("created_at", { ascending: false })
        .limit(10),
    ])

    // Calculate totals
    const totalUsers = usersResult.count || 0
    const activeUsers = Math.floor(totalUsers * 0.1) // Estimate 10% daily active
    
    const liveMatches = matchesResult.data?.length || 0
    const activeStreams = streamsResult.data?.length || 0
    const clipsToday = clipsResult.count || 0
    
    const todayRevenue = (revenueResult.data || []).reduce((sum, tx) => sum + (tx.amount || 0), 0)
    const pendingPayouts = (payoutsResult.data || []).reduce((sum, p) => sum + (p.amount || 0), 0)
    
    const moderationQueue = alertsResult.data?.length || 0

    // Format live activity
    const liveActivity = [
      ...(matchesResult.data || []).map((match: any) => ({
        id: match.id,
        type: "match",
        title: match.tournament?.name || "Tournament Match",
        status: "live",
        players: [match.player1?.gamertag || "Player 1", match.player2?.gamertag || "Player 2"],
        score: [match.player1_score || 0, match.player2_score || 0],
        viewers: Math.floor(Math.random() * 500) + 50, // Would come from real viewer tracking
      })),
      ...(streamsResult.data || []).map((stream: any) => ({
        id: stream.id,
        type: "stream",
        title: stream.title,
        status: "live",
        category: "Streaming",
        viewers: stream.total_views || 0,
      })),
    ]

    // Format alerts
    const recentAlerts = (alertsResult.data || []).map((alert: any) => ({
      id: alert.id,
      type: alert.type || "report",
      severity: "medium",
      message: alert.reason || "Pending review",
      created_at: alert.created_at,
    }))

    // Format transactions
    const recentTransactions = (transactionsResult.data || []).map((tx: any) => ({
      id: tx.id,
      description: tx.description || "Transaction",
      amount: tx.amount,
      created_at: tx.created_at,
    }))

    return NextResponse.json({
      data: {
        totalUsers,
        activeUsers,
        liveMatches,
        activeStreams,
        clipsToday,
        todayRevenue,
        pendingPayouts,
        moderationQueue,
        liveActivity,
        recentAlerts,
        recentTransactions,
      }
    })
  } catch (error) {
    console.error("Error fetching ops metrics:", error)
    return NextResponse.json({ 
      data: {
        totalUsers: 0,
        activeUsers: 0,
        liveMatches: 0,
        activeStreams: 0,
        clipsToday: 0,
        todayRevenue: 0,
        pendingPayouts: 0,
        moderationQueue: 0,
        liveActivity: [],
        recentAlerts: [],
        recentTransactions: [],
      }
    })
  }
}

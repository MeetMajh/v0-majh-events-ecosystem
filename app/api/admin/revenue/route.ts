import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check admin access
    const { data: staffRole } = await supabase
      .from("staff_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["owner", "manager"])
      .single()

    if (!staffRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch revenue data
    const [
      { data: allPayments },
      { data: tournaments },
      { data: uniqueUsers },
    ] = await Promise.all([
      supabase
        .from("tournament_payments")
        .select("amount_cents, platform_fee_cents, created_at")
        .eq("status", "succeeded"),
      supabase
        .from("tournaments")
        .select("id")
        .gt("entry_fee_cents", 0),
      supabase
        .from("tournament_payments")
        .select("user_id")
        .eq("status", "succeeded"),
    ])

    const totalRevenue = allPayments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0
    const platformFees = allPayments?.reduce((sum, p) => sum + (p.platform_fee_cents || 0), 0) || 0
    const tournamentCount = tournaments?.length || 0
    
    // Count unique users
    const uniqueUserIds = new Set(uniqueUsers?.map(p => p.user_id) || [])
    const activeUsers = uniqueUserIds.size

    // Calculate monthly data (last 6 months)
    const monthlyData: { month: string; revenue: number; fees: number; tournaments: number }[] = []
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const monthPayments = allPayments?.filter(p => {
        const paymentDate = new Date(p.created_at)
        return paymentDate >= monthDate && paymentDate <= monthEnd
      }) || []

      monthlyData.push({
        month: monthDate.toLocaleString("default", { month: "short", year: "numeric" }),
        revenue: monthPayments.reduce((sum, p) => sum + (p.amount_cents || 0), 0),
        fees: monthPayments.reduce((sum, p) => sum + (p.platform_fee_cents || 0), 0),
        tournaments: monthPayments.length,
      })
    }

    return NextResponse.json({
      totalRevenue,
      platformFees,
      tournamentCount,
      activeUsers,
      monthlyData,
    })
  } catch (error) {
    console.error("[Admin Revenue] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

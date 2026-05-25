import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireCronAuth } from "@/lib/cron-auth"

// Lazy initialization for service role client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase env vars not configured")
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  try {
    const supabaseAdmin = getSupabaseAdmin()

    // Call the cleanup function
    const { data, error } = await supabaseAdmin.rpc("cleanup_stale_intents")

    if (error) {
      console.error("Cleanup error:", error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log("Stale intents cleanup complete:", data)

    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error("Cleanup worker error:", err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Cleanup failed",
      },
      { status: 500 }
    )
  }
}

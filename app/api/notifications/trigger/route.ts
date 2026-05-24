import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // Must be authenticated or service role
    const { data: { user } } = await supabase.auth.getUser()

    // Check caller is staff or service role (via Authorization header)
    const authHeader = req.headers.get("authorization")
    const isServiceCall = authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!user && !isServiceCall) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { user_id, type, title, message, data, priority, tournament_id, match_id } = body

    if (!user_id || !type || !title) {
      return NextResponse.json(
        { error: "user_id, type, and title are required" },
        { status: 400 }
      )
    }

    // Insert notification via service role (bypasses RLS)
    const { data: notification, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id,
        type,
        title,
        body: message,
        data,
        priority: priority ?? "normal",
        tournament_id: tournament_id ?? null,
        match_id: match_id ?? null,
      })
      .select()
      .single()

    if (error || !notification) {
      return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 })
    }

    // Enqueue in_app channel always
    const queueEntries: object[] = [
      {
        user_id,
        notification_id: notification.id,
        channel: "in_app",
        status: "pending",
        scheduled_for: new Date().toISOString(),
      },
    ]

    // Check preferences before enqueuing email
    const { data: prefs } = await supabaseAdmin
      .from("notification_preferences")
      .select("email, email_frequency")
      .eq("user_id", user_id)
      .single()

    const shouldEmail =
      prefs?.email !== false &&
      prefs?.email_frequency !== "silent"

    if (shouldEmail) {
      queueEntries.push({
        user_id,
        notification_id: notification.id,
        channel: "email",
        status: "pending",
        scheduled_for: new Date().toISOString(),
      })
    }

    await supabaseAdmin.from("notification_queue").insert(queueEntries)

    return NextResponse.json({ success: true, notification_id: notification.id })
  } catch (err) {
    console.error("[Notifications] Trigger error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "30"), 100)
    const unreadOnly = searchParams.get("unread") === "true"
    const cursor = searchParams.get("cursor") // created_at for pagination

    let query = supabase
      .from("notifications")
      .select("id, type, title, body, link, icon, priority, is_read, read_at, created_at, tournament_id, match_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq("is_read", false)
    }

    if (cursor) {
      query = query.lt("created_at", cursor)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get unread count
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    return NextResponse.json({
      notifications: data ?? [],
      unread_count: count ?? 0,
      has_more: (data?.length ?? 0) === limit,
      next_cursor: data?.length === limit ? data[data.length - 1].created_at : null,
    })
  } catch (err) {
    console.error("[Notifications] Feed error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

// Mark notifications as read
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { ids, mark_all } = body

    if (mark_all) {
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false)
    } else if (ids?.length) {
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .in("id", ids)
    } else {
      return NextResponse.json({ error: "ids or mark_all required" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Notifications] Mark read error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

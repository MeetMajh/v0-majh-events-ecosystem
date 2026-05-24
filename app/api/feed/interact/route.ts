import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { recordInteraction } from "@/lib/ml-ranking-service"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Must be logged in" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { contentId, interactionType, data } = body

    if (!contentId || !interactionType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const validTypes = [
      "view", "like", "unlike", "comment", "share", 
      "save", "unsave", "report", "not_interested"
    ]

    if (!validTypes.includes(interactionType)) {
      return NextResponse.json(
        { error: "Invalid interaction type" },
        { status: 400 }
      )
    }

    const result = await recordInteraction(user.id, contentId, interactionType, data || {})

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Interaction API error:", error)
    return NextResponse.json(
      { error: "Failed to record interaction" },
      { status: 500 }
    )
  }
}

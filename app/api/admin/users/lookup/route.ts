import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json({ error: "Email parameter required" }, { status: 400 })
    }

    // Look up user by email (case-insensitive)
    const { data: foundUser, error } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .ilike("email", email)
      .single()

    if (error || !foundUser) {
      return NextResponse.json({ 
        success: false, 
        error: "User not found with that email" 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: foundUser.id,
        email: foundUser.email,
        displayName: foundUser.display_name,
      }
    })

  } catch (error) {
    console.error("User lookup error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

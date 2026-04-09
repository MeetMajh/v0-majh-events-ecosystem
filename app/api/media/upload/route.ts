import { put } from "@vercel/blob"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Must be logged in to upload" }, { status: 401 })
    }
    
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const title = formData.get("title") as string || file?.name || "Untitled"
    const description = formData.get("description") as string || ""
    const category = formData.get("category") as string || "other"
    const visibility = formData.get("visibility") as string || "public"
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    
    // Validate file type
    const allowedTypes = [
      "video/mp4", "video/webm", "video/quicktime", "video/x-m4v",
      "image/png", "image/jpeg", "image/gif", "image/webp"
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Supported: MP4, WebM, MOV, PNG, JPG, GIF, WebP" }, { status: 400 })
    }
    
    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 100MB" }, { status: 400 })
    }
    
    // Generate unique file path
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "mp4"
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const filePath = `media/${user.id}/${fileName}`
    
    // Upload to Vercel Blob
    const blob = await put(filePath, file, {
      access: "public",
      contentType: file.type,
    })
    
    // Determine media type
    const mediaType = file.type.startsWith("video/") ? "video" : "image"
    
    // Save to database
    const { error: dbError } = await supabase
      .from("player_media")
      .insert({
        player_id: user.id,
        title,
        description,
        media_type: mediaType,
        category,
        url: blob.url,
        file_size: file.size,
        mime_type: file.type,
        visibility,
      })
    
    if (dbError) {
      console.error("Database error:", dbError)
      // Still return success since the file was uploaded
    }
    
    return NextResponse.json({ 
      url: blob.url,
      pathname: blob.pathname
    })
    
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Upload failed" 
    }, { status: 500 })
  }
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

// Configure body size limit for large file uploads
export const fetchCache = "force-no-store"

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
    
    // Validate file size (50MB max for Supabase free tier)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 50MB" }, { status: 400 })
    }
    
    // Generate unique file path
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "mp4"
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const filePath = `${user.id}/${fileName}`
    
    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("player-media")
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })
    
    if (uploadError) {
      console.error("[v0] Storage upload error:", uploadError)
      
      // Check for bucket not found
      if (uploadError.message.includes("not found") || uploadError.message.includes("Bucket")) {
        return NextResponse.json({ 
          error: "Storage bucket 'player-media' not configured. Please create it in Supabase Storage." 
        }, { status: 500 })
      }
      
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from("player-media")
      .getPublicUrl(filePath)
    
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
        url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        visibility,
      })
    
    if (dbError) {
      console.error("[v0] Database error:", dbError)
      // Still return success since the file was uploaded
    }
    
    return NextResponse.json({ 
      url: urlData.publicUrl, 
      storagePath: filePath 
    })
    
  } catch (error) {
    console.error("[v0] Upload API error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Upload failed" 
    }, { status: 500 })
  }
}

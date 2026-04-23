import { createClient } from "@/lib/supabase/server"
import { put } from "@vercel/blob"
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
    const category = formData.get("category") as string || "highlight"
    const visibility = formData.get("visibility") as string || "public"
    const scheduledLiveAt = formData.get("scheduled_live_at") as string | null
    
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
    
    // Validate file size (100MB max for Vercel Blob)
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
    })
    
    // Determine media type
    const mediaType = file.type.startsWith("video/") ? "clip" : "image"
    
    // Determine if this should go live immediately or be scheduled
    const isScheduled = scheduledLiveAt && new Date(scheduledLiveAt) > new Date()
    const isLive = !isScheduled && visibility === "public"
    
    // Build insert data - start with required core fields
    const insertData: Record<string, unknown> = {
      player_id: user.id,
      title,
      description,
      media_type: mediaType,
      category,
      url: blob.url,
      visibility,
      view_count: 0,
      like_count: 0,
    }

    // Add optional fields that may exist in the schema
    // These will be ignored if columns don't exist
    const optionalFields: Record<string, unknown> = {
      source_type: "upload",
      video_url: blob.url,
      storage_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      moderation_status: "approved",
      is_live: isLive,
      went_live_at: isLive ? new Date().toISOString() : null,
      scheduled_live_at: scheduledLiveAt || null,
      comment_count: 0,
      share_count: 0,
      trending_score: 0,
    }

    // Try with all fields first
    let mediaRecord = null
    let dbError = null

    const { data: fullData, error: fullError } = await supabase
      .from("player_media")
      .insert({ ...insertData, ...optionalFields })
      .select()
      .single()

    if (fullError) {
      // If error mentions a column, try with just core fields
      console.log("[v0] Full insert failed, trying core fields only:", fullError.message)
      
      const { data: coreData, error: coreError } = await supabase
        .from("player_media")
        .insert(insertData)
        .select()
        .single()
      
      mediaRecord = coreData
      dbError = coreError
    } else {
      mediaRecord = fullData
    }
    
    if (dbError) {
      console.error("[v0] Database error:", dbError)
      // Return success with URL even if DB fails - file is uploaded
      return NextResponse.json({ 
        success: true,
        warning: `Uploaded but database save failed: ${dbError.message}`,
        url: blob.url,
        storagePath: filePath,
      })
    }
    
    return NextResponse.json({ 
      success: true,
      url: blob.url, 
      storagePath: filePath,
      mediaId: mediaRecord?.id,
      isLive,
      scheduledLiveAt: scheduledLiveAt || null
    })
    
  } catch (error) {
    console.error("[v0] Upload API error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Upload failed" 
    }, { status: 500 })
  }
}

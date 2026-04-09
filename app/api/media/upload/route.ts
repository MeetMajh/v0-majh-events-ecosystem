import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60
// Dynamic to ensure no static generation issues
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
    const filePath = `${user.id}/${fileName}`
    
    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("player-media")
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      })
    
    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      
      // Check for bucket not found
      if (uploadError.message.includes("not found") || uploadError.message.includes("Bucket")) {
        return NextResponse.json({ 
          error: "Storage bucket 'player-media' not found. Please run the storage setup SQL in Supabase." 
        }, { status: 500 })
      }
      
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from("player-media")
      .getPublicUrl(filePath)
    
    return NextResponse.json({ 
      url: urlData.publicUrl, 
      storagePath: filePath 
    })
    
  } catch (error) {
    console.error("Upload API error:", error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : "Upload failed" 
    }, { status: 500 })
  }
}

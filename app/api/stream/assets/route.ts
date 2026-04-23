import { createClient } from "@/lib/supabase/server"
import { put, del } from "@vercel/blob"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

// GET - List user's stream assets
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const assetType = searchParams.get("type")
    const includePresets = searchParams.get("presets") === "true"
    
    // Build query
    let query = supabase
      .from("stream_assets")
      .select("*")
      .order("created_at", { ascending: false })
    
    // Filter by user assets OR preset assets
    if (includePresets) {
      query = query.or(`user_id.eq.${user.id},is_preset.eq.true`)
    } else {
      query = query.eq("user_id", user.id)
    }
    
    if (assetType) {
      query = query.eq("asset_type", assetType)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error("[v0] Error fetching stream assets:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ data })
  } catch (error) {
    console.error("[v0] Stream assets GET error:", error)
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 })
  }
}

// POST - Upload new stream asset
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const assetType = formData.get("asset_type") as string || "overlay"
    const name = formData.get("name") as string || file?.name || "Untitled Asset"
    const category = formData.get("category") as string || "custom"
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }
    
    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "video/webm", "video/mp4"]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: "Invalid file type. Supported: PNG, JPG, GIF, WebP, WebM, MP4" 
      }, { status: 400 })
    }
    
    // Max 20MB for assets
    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum 20MB" }, { status: 400 })
    }
    
    // Generate unique path
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "png"
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const filePath = `stream-assets/${user.id}/${assetType}/${fileName}`
    
    // Upload to Vercel Blob
    const blob = await put(filePath, file, {
      access: "public",
    })
    
    // Save to database
    const { data, error } = await supabase
      .from("stream_assets")
      .insert({
        user_id: user.id,
        asset_type: assetType,
        name,
        file_url: blob.url,
        storage_path: filePath,
        is_preset: false,
        category,
        metadata: {
          file_size: file.size,
          mime_type: file.type,
          original_name: file.name,
        },
      })
      .select()
      .single()
    
    if (error) {
      console.error("[v0] Error saving stream asset:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      data,
      url: blob.url 
    })
  } catch (error) {
    console.error("[v0] Stream assets POST error:", error)
    return NextResponse.json({ error: "Failed to upload asset" }, { status: 500 })
  }
}

// DELETE - Remove stream asset
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const assetId = searchParams.get("id")
    
    if (!assetId) {
      return NextResponse.json({ error: "Asset ID required" }, { status: 400 })
    }
    
    // Get asset to verify ownership
    const { data: asset, error: fetchError } = await supabase
      .from("stream_assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", user.id)
      .single()
    
    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 })
    }
    
    // Delete from Blob storage
    if (asset.file_url) {
      try {
        await del(asset.file_url)
      } catch (blobError) {
        console.log("[v0] Blob deletion failed (non-critical):", blobError)
      }
    }
    
    // Delete from database
    const { error } = await supabase
      .from("stream_assets")
      .delete()
      .eq("id", assetId)
      .eq("user_id", user.id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Stream assets DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 })
  }
}

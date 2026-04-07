import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params
  
  // Map size to source file and target dimensions
  const sizeMap: Record<string, { source: string; width: number; height: number }> = {
    "icon-192x192.png": { source: "icon-192x192.jpg", width: 192, height: 192 },
    "icon-512x512.png": { source: "icon-512x512.jpg", width: 512, height: 512 },
    "icon-maskable-512x512.png": { source: "icon-maskable-512x512.jpg", width: 512, height: 512 },
  }
  
  const config = sizeMap[size]
  if (!config) {
    return NextResponse.json({ error: "Icon not found" }, { status: 404 })
  }
  
  try {
    const filePath = join(process.cwd(), "public", "icons", config.source)
    const imageBuffer = await readFile(filePath)
    
    // Resize to exact dimensions and convert to PNG
    const pngBuffer = await sharp(imageBuffer)
      .resize(config.width, config.height, { fit: "cover" })
      .png()
      .toBuffer()
    
    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Error converting icon:", error)
    return NextResponse.json({ error: "Failed to convert icon" }, { status: 500 })
  }
}

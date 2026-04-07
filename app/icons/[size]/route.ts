import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params
  
  // Map size to source file
  const sizeMap: Record<string, string> = {
    "icon-192x192.png": "icon-192x192.jpg",
    "icon-512x512.png": "icon-512x512.jpg",
    "icon-maskable-512x512.png": "icon-maskable-512x512.jpg",
  }
  
  const sourceFile = sizeMap[size]
  if (!sourceFile) {
    return NextResponse.json({ error: "Icon not found" }, { status: 404 })
  }
  
  try {
    const filePath = join(process.cwd(), "public", "icons", sourceFile)
    const imageBuffer = await readFile(filePath)
    
    // Convert to PNG
    const pngBuffer = await sharp(imageBuffer).png().toBuffer()
    
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

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Authenticate user
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          throw new Error("Must be logged in to upload")
        }

        return {
          allowedContentTypes: [
            "video/mp4", "video/webm", "video/quicktime", "video/x-m4v",
            "image/png", "image/jpeg", "image/gif", "image/webp"
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
          tokenPayload: JSON.stringify({
            userId: user.id,
          }),
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Save to database after upload completes
        try {
          const payload = JSON.parse(tokenPayload || "{}")
          const userId = payload.userId
          
          if (!userId) return

          const supabase = await createClient()
          
          // Determine media type from content type
          const mediaType = blob.contentType?.startsWith("video/") ? "video" : "image"
          
          // Extract filename without path
          const fileName = blob.pathname.split("/").pop() || "Untitled"
          
          await supabase.from("player_media").insert({
            player_id: userId,
            title: fileName,
            media_type: mediaType,
            url: blob.url,
            file_size: blob.size,
            mime_type: blob.contentType,
            visibility: "public",
          })
        } catch (error) {
          console.error("Error saving to database:", error)
          // Don't throw - the upload succeeded, just database save failed
        }
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}

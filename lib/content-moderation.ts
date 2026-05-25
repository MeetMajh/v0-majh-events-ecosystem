"use server"

import { generateText, Output } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// Moderation result schema
const ModerationResultSchema = z.object({
  safe: z.boolean(),
  category: z.enum([
    "safe",
    "adult",
    "violence",
    "hate",
    "spam",
    "copyright",
    "off_topic"
  ]),
  confidence: z.number().min(0).max(1),
  reason: z.string().nullable(),
  flags: z.array(z.string()),
})

export type ModerationResult = z.infer<typeof ModerationResultSchema>

/**
 * Scan an image/thumbnail for prohibited content using AI vision
 */
export async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  try {
    const result = await generateText({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content moderation system for a gaming/esports platform called MAJH Events. 
Analyze the provided image and determine if it violates community guidelines.

ALLOWED content:
- Gaming/esports content (gameplay, tournaments, highlights)
- Gaming memes that are appropriate
- Player profiles, team logos
- Event coverage, commentary

PROHIBITED content:
- Adult/sexual content (nudity, sexually suggestive)
- Extreme violence or gore
- Hate speech, discrimination
- Spam, scams, advertisements
- Non-gaming content (must be related to gaming/esports)
- Copyright violations (full movie clips, TV shows)

Respond with your analysis.`
        },
        {
          role: "user",
          content: [
            {
              type: "image",
              image: imageUrl,
            },
            {
              type: "text",
              text: "Analyze this image for content moderation. Is it safe for a gaming/esports platform?"
            }
          ],
        },
      ],
      output: Output.object({
        schema: ModerationResultSchema,
      }),
    })

    return result.object
  } catch (error) {
    console.error("[Content Moderation] AI analysis error:", error)
    // Default to requiring manual review on error
    return {
      safe: false,
      category: "safe",
      confidence: 0,
      reason: "Automated moderation unavailable - requires manual review",
      flags: ["moderation_error"],
    }
  }
}

/**
 * Moderate uploaded media by checking its thumbnail
 * For videos, we check the auto-generated thumbnail
 * For external URLs (YouTube, etc), we check the embed thumbnail
 */
export async function moderateMedia(
  mediaId: string
): Promise<{ approved: boolean; result: ModerationResult }> {
  const supabase = await createClient()
  
  // Get media details
  const { data: media, error } = await supabase
    .from("player_media")
    .select("id, thumbnail_url, video_url, title, description")
    .eq("id", mediaId)
    .single()
  
  if (error || !media) {
    return {
      approved: false,
      result: {
        safe: false,
        category: "safe",
        confidence: 0,
        reason: "Media not found",
        flags: ["not_found"],
      },
    }
  }
  
  // Check thumbnail if available
  let imageToCheck = media.thumbnail_url
  
  // If no thumbnail, try to get YouTube thumbnail
  if (!imageToCheck && media.video_url) {
    const youtubeMatch = media.video_url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    )
    if (youtubeMatch) {
      imageToCheck = `https://img.youtube.com/vi/${youtubeMatch[1]}/hqdefault.jpg`
    }
  }
  
  if (!imageToCheck) {
    // No image to moderate - flag for manual review
    return {
      approved: false,
      result: {
        safe: false,
        category: "safe",
        confidence: 0,
        reason: "No thumbnail available for automated review",
        flags: ["no_thumbnail", "manual_review_required"],
      },
    }
  }
  
  // Run AI moderation
  const moderationResult = await moderateImage(imageToCheck)
  
  // Also do a quick text check on title/description
  const textFlags: string[] = []
  const prohibitedWords = [
    "porn", "xxx", "nude", "naked", "sex",
    "scam", "free money", "click here",
    "hate", "kill", "death to"
  ]
  
  const textContent = `${media.title} ${media.description || ""}`.toLowerCase()
  for (const word of prohibitedWords) {
    if (textContent.includes(word)) {
      textFlags.push(`prohibited_word:${word}`)
    }
  }
  
  // Combine results
  const finalResult: ModerationResult = {
    ...moderationResult,
    flags: [...moderationResult.flags, ...textFlags],
    safe: moderationResult.safe && textFlags.length === 0,
  }
  
  // Update media moderation status
  // Use "rejected" for flagged content, "approved" for safe content
  const newStatus = finalResult.safe ? "approved" : "rejected"
  
  await supabase
    .from("player_media")
    .update({
      moderation_status: newStatus,
      is_flagged: !finalResult.safe,
      published_at: finalResult.safe ? new Date().toISOString() : null,
    })
    .eq("id", mediaId)
  
  // Log moderation result
  await supabase.from("moderation_logs").insert({
    media_id: mediaId,
    result: finalResult,
    action_taken: newStatus,
    automated: true,
  }).catch(() => {
    // Table might not exist yet, ignore
  })
  
  return {
    approved: finalResult.safe,
    result: finalResult,
  }
}

/**
 * Batch moderate pending media (for background job)
 */
export async function moderatePendingMedia(limit: number = 10): Promise<{
  processed: number
  approved: number
  flagged: number
}> {
  const supabase = await createClient()
  
  // Get pending media
  const { data: pendingMedia, error } = await supabase
    .from("player_media")
    .select("id")
    .eq("moderation_status", "pending")
    .limit(limit)
  
  if (error || !pendingMedia) {
    return { processed: 0, approved: 0, flagged: 0 }
  }
  
  let approved = 0
  let flagged = 0
  
  for (const media of pendingMedia) {
    const result = await moderateMedia(media.id)
    if (result.approved) {
      approved++
    } else {
      flagged++
    }
  }
  
  return {
    processed: pendingMedia.length,
    approved,
    flagged,
  }
}

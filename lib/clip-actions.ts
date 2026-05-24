"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function deleteClip(clipId: string) {
  const supabase = await createClient()
  
  // Get the clip to verify ownership
  const { data: clip, error: fetchError } = await supabase
    .from("player_media")
    .select("id, player_id, url")
    .eq("id", clipId)
    .single()

  if (fetchError || !clip) {
    throw new Error("Clip not found")
  }

  // Verify the user owns this clip
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== clip.player_id) {
    throw new Error("Unauthorized")
  }

  // Delete from database
  const { error: deleteError } = await supabase
    .from("player_media")
    .delete()
    .eq("id", clipId)
    .eq("player_id", user.id)

  if (deleteError) {
    throw new Error("Failed to delete clip")
  }

  // TODO: Delete from Blob storage if needed

  revalidatePath("/dashboard/creator/clips")
  revalidatePath("/clips")
}

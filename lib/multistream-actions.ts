"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface StreamDestination {
  id: string
  user_id: string
  platform: string
  stream_key: string
  enabled: boolean
  created_at: string
}

/**
 * Get user's multistream destinations
 */
export async function getStreamDestinations() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized", data: [] }
  }

  const { data, error } = await supabase
    .from("multistream_destinations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at")

  if (error) {
    // Table might not exist yet
    console.error("Error fetching destinations:", error)
    return { data: [] }
  }

  return { data: data as StreamDestination[] }
}

/**
 * Add a stream destination
 */
export async function addStreamDestination(platform: string, streamKey: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  // Check for duplicate platform
  const { data: existing } = await supabase
    .from("multistream_destinations")
    .select("id")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .single()

  if (existing) {
    return { error: "You already have this platform configured" }
  }

  const { data, error } = await supabase
    .from("multistream_destinations")
    .insert({
      user_id: user.id,
      platform,
      stream_key: streamKey,
      enabled: true,
    })
    .select()
    .single()

  if (error) {
    console.error("Error adding destination:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream/multistream")
  return { data: data as StreamDestination }
}

/**
 * Update a stream destination
 */
export async function updateStreamDestination(
  destId: string, 
  updates: { stream_key?: string; enabled?: boolean }
) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { data, error } = await supabase
    .from("multistream_destinations")
    .update(updates)
    .eq("id", destId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating destination:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream/multistream")
  return { data: data as StreamDestination }
}

/**
 * Delete a stream destination
 */
export async function deleteStreamDestination(destId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: "Unauthorized" }
  }

  const { error } = await supabase
    .from("multistream_destinations")
    .delete()
    .eq("id", destId)
    .eq("user_id", user.id)

  if (error) {
    console.error("Error deleting destination:", error)
    return { error: error.message }
  }

  revalidatePath("/dashboard/stream/multistream")
  return { success: true }
}

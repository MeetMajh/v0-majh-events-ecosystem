"use server"

import { createClient } from "@/lib/supabase/server"
import { requireStaffAction } from "@/lib/auth/require-staff"
import { revalidatePath } from "next/cache"

export type HomepageSection = {
  visible: boolean
  order: number
  title?: string
  subtitle?: string
}

export type HomepageSections = {
  hero: HomepageSection
  services: HomepageSection
  upcoming_events: HomepageSection
  gallery: HomepageSection
  testimonials: HomepageSection
  cta: HomepageSection
}

export type SiteInfo = {
  tagline: string
  announcement_banner: string | null
  announcement_visible: boolean
}

export async function getSiteSettings() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")

  if (error) {
    console.error("Error fetching site settings:", error)
    return null
  }

  const settings: Record<string, any> = {}
  for (const row of data || []) {
    settings[row.key] = row.value
  }

  return settings
}

export async function getHomepageSections(): Promise<HomepageSections> {
  const settings = await getSiteSettings()

  const defaultSections: HomepageSections = {
    hero: { visible: true, order: 1 },
    services: { visible: true, order: 2 },
    upcoming_events: { visible: true, order: 3 },
    gallery: { visible: true, order: 4 },
    testimonials: { visible: true, order: 5 },
    cta: { visible: true, order: 6 },
  }

  return settings?.homepage_sections || defaultSections
}

export async function getSiteInfo(): Promise<SiteInfo> {
  const settings = await getSiteSettings()

  const defaultInfo: SiteInfo = {
    tagline: "Gaming • Events • Community",
    announcement_banner: null,
    announcement_visible: false,
  }

  return settings?.site_info || defaultInfo
}

export async function updateHomepageSections(sections: HomepageSections) {
  const { supabase, userId } = await requireStaffAction("manager")

  const { error } = await supabase
    .from("site_settings")
    .upsert({
      key: "homepage_sections",
      value: sections,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/")
  revalidatePath("/dashboard/admin/site")
  return { success: true }
}

export async function updateSiteInfo(info: Partial<SiteInfo>) {
  const { supabase, userId } = await requireStaffAction("manager")

  const currentInfo = await getSiteInfo()
  const updatedInfo = { ...currentInfo, ...info }

  const { error } = await supabase
    .from("site_settings")
    .upsert({
      key: "site_info",
      value: updatedInfo,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/")
  revalidatePath("/dashboard/admin/site")
  return { success: true }
}

export async function toggleAnnouncementBanner(visible: boolean) {
  return updateSiteInfo({ announcement_visible: visible })
}

export async function setAnnouncementBanner(text: string | null) {
  return updateSiteInfo({
    announcement_banner: text,
    announcement_visible: !!text,
  })
}

"use server"

import { createClient } from "@/lib/supabase/server"

export interface GuideArticle {
  id: string
  title: string
  summary: string | null
  content: string
  category: {
    slug: string
    tenant_id: string | null
  }
}

export async function getContextualHelp(route: string, elementId?: string): Promise<GuideArticle[]> {
  const supabase = await createClient()
  
  // 1. Find UI contexts that match this route pattern
  let query = supabase
    .from("guide_ui_contexts")
    .select(`
      article_id,
      guide_articles (
        id,
        title,
        summary,
        content,
        guide_categories (
          slug,
          tenant_id
        )
      )
    `)
    .eq("route_pattern", route)

  if (elementId) {
    query = query.eq("element_id", elementId)
  } else {
    query = query.is("element_id", null)
  }

  const { data, error } = await query

  if (error || !data) {
    console.error("[Wizard] Failed to fetch contextual help:", error)
    return []
  }

  // 2. Map and filter out any articles blocked by RLS
  return data
    .filter(row => row.guide_articles !== null)
    .map(row => {
      // Handle the fact that joining to a single record returns an array or single object depending on schema relations
      const article = Array.isArray(row.guide_articles) ? row.guide_articles[0] : row.guide_articles
      if (!article) return null
      
      const category = Array.isArray(article.guide_categories) ? article.guide_categories[0] : article.guide_categories
      
      return {
        id: article.id,
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: category || { slug: 'unknown', tenant_id: null }
      }
    }).filter(Boolean) as GuideArticle[]
}

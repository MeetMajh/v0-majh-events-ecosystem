"use client"

import { useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"

type Article = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  cover_image_url: string | null
  category: string
  published_at: string | null
  profiles: { display_name: string } | null
  tournaments: { name: string; slug: string } | null
}

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "match_report", label: "Match Reports" },
  { key: "news", label: "News" },
  { key: "interview", label: "Interviews" },
  { key: "announcement", label: "Announcements" },
]

export function NewsFilter({ articles }: { articles: Article[] }) {
  const [category, setCategory] = useState("all")

  const filtered = category === "all"
    ? articles
    : articles.filter((a) => a.category === category)

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              category === cat.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No articles found in this category.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <Link key={article.id} href={`/news/${article.slug}`} className="group">
              <div className="rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                {article.cover_image_url && (
                  <div className="relative aspect-video overflow-hidden rounded-t-xl">
                    <img
                      src={article.cover_image_url}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {article.category.replace("_", " ")}
                    </Badge>
                    {article.published_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(article.published_at)}
                      </span>
                    )}
                  </div>
                  <h3 className="mb-1 text-balance font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{article.excerpt}</p>
                  )}
                  {article.profiles && (
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      By {article.profiles.display_name}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

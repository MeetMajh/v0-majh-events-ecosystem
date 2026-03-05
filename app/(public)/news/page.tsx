import Link from "next/link"
import { getArticles } from "@/lib/content-actions"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { Newspaper } from "lucide-react"

export const metadata = { title: "News | MAJH EVENTS" }

export default async function NewsPage() {
  const articles = await getArticles()

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Newspaper className="h-3 w-3" />
          Updates
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">News</h1>
        <p className="mt-2 text-muted-foreground">Tournament recaps, announcements, and community highlights.</p>
      </div>

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No articles yet</p>
          <p className="text-sm text-muted-foreground">Check back soon for the latest news.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Featured (first article) */}
          {articles.length > 0 && (
            <Link href={`/news/${articles[0].slug}`} className="group">
              <div className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30">
                {articles[0].cover_image_url && (
                  <div className="mb-4 aspect-[3/1] overflow-hidden rounded-lg bg-muted" />
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">{articles[0].category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {articles[0].published_at ? formatDate(articles[0].published_at) : "Draft"}
                  </span>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{articles[0].title}</h2>
                <p className="text-muted-foreground line-clamp-2">{articles[0].excerpt}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  By {articles[0].profiles?.display_name ?? "Unknown"}
                </p>
              </div>
            </Link>
          )}

          {/* Rest of articles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.slice(1).map((article) => (
              <Link key={article.id} href={`/news/${article.slug}`} className="group">
                <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">{article.category}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {article.published_at ? formatDate(article.published_at) : "Draft"}
                    </span>
                  </div>
                  <h3 className="mb-1 font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">{article.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{article.excerpt}</p>
                  <p className="mt-3 text-[10px] text-muted-foreground">
                    By {article.profiles?.display_name ?? "Unknown"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

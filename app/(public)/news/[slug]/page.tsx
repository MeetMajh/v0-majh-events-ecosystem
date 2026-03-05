import { notFound } from "next/navigation"
import Link from "next/link"
import { getArticleBySlug } from "@/lib/content-actions"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: "Not Found" }
  return { title: `${article.title} | MAJH EVENTS`, description: article.excerpt }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/news" className="mb-6 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">
        &larr; All News
      </Link>

      <div className="mb-3 flex items-center gap-2">
        <Badge variant="outline" className="text-xs">{article.category}</Badge>
        {article.published_at && (
          <span className="text-xs text-muted-foreground">{formatDate(article.published_at)}</span>
        )}
      </div>

      <h1 className="mb-4 text-3xl font-bold text-balance text-foreground md:text-4xl">{article.title}</h1>

      {article.excerpt && (
        <p className="mb-6 text-lg text-muted-foreground">{article.excerpt}</p>
      )}

      <div className="mb-8 flex items-center gap-2 border-b border-border pb-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {article.profiles?.display_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="text-sm text-muted-foreground">
          {article.profiles?.display_name ?? "Unknown"}
        </span>
      </div>

      {article.tournaments && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <p className="text-xs text-muted-foreground">Related Tournament</p>
          <Link href={`/esports/tournaments/${article.tournaments.slug}`} className="font-medium text-primary hover:underline">
            {article.tournaments.name}
          </Link>
        </div>
      )}

      <div className="prose prose-invert max-w-none">
        {article.content.split("\n").map((paragraph: string, i: number) => (
          paragraph.trim() ? <p key={i} className="mb-4 text-foreground/90 leading-relaxed">{paragraph}</p> : null
        ))}
      </div>
    </article>
  )
}

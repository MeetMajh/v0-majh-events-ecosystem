import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getAllArticlesAdmin, getNewsCategories } from "@/lib/content-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { 
  Plus, 
  Newspaper, 
  Eye, 
  EyeOff, 
  Star,
  Pencil,
  BarChart3,
} from "lucide-react"

export const metadata = {
  title: "News Management | MAJH EVENTS",
  description: "Create and manage news articles",
}

export default async function NewsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/sign-in")
  
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .single()
  
  if (!staffRole || !["owner", "manager", "staff"].includes(staffRole.role)) {
    redirect("/dashboard")
  }
  
  const [articles, categories] = await Promise.all([
    getAllArticlesAdmin(),
    getNewsCategories(),
  ])

  const publishedCount = articles.filter(a => a.is_published).length
  const draftCount = articles.filter(a => !a.is_published).length
  const featuredCount = articles.filter(a => a.featured).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">News Articles</h1>
          <p className="text-muted-foreground">
            Create and manage news, announcements, and community highlights
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/admin/news/new">
            <Plus className="mr-2 h-4 w-4" />
            New Article
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Newspaper className="h-4 w-4" />
            <span className="text-sm">Total Articles</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{articles.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-emerald-600">
            <Eye className="h-4 w-4" />
            <span className="text-sm">Published</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{publishedCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-amber-600">
            <EyeOff className="h-4 w-4" />
            <span className="text-sm">Drafts</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{draftCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-primary">
            <Star className="h-4 w-4" />
            <span className="text-sm">Featured</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{featuredCount}</p>
        </div>
      </div>

      {/* Articles List */}
      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Newspaper className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No articles yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first news article to get started
          </p>
          <Button asChild>
            <Link href="/dashboard/admin/news/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Article
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="divide-y">
            {articles.map((article) => (
              <div key={article.id} className="flex items-center justify-between p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link 
                      href={`/dashboard/admin/news/${article.id}`}
                      className="font-medium text-foreground hover:text-primary truncate"
                    >
                      {article.title}
                    </Link>
                    {article.featured && (
                      <Star className="h-3.5 w-3.5 fill-primary text-primary flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge 
                      variant="outline" 
                      className="text-[10px]"
                      style={{ 
                        borderColor: article.news_categories?.color,
                        color: article.news_categories?.color 
                      }}
                    >
                      {article.news_categories?.name || article.category || "Uncategorized"}
                    </Badge>
                    <span>By {article.profiles?.display_name || "Unknown"}</span>
                    <span>
                      {article.is_published 
                        ? formatDate(article.published_at) 
                        : "Draft"
                      }
                    </span>
                    {article.view_count > 0 && (
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {article.view_count} views
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Badge variant={article.is_published ? "default" : "secondary"}>
                    {article.is_published ? "Published" : "Draft"}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/admin/news/${article.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

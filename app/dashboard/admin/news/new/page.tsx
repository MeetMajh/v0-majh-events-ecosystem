import { requireStaff } from "@/lib/auth/require-staff"
import { getNewsCategories } from "@/lib/content-actions"
import { ArticleForm } from "@/components/admin/article-form"

export const metadata = {
  title: "New Article | MAJH EVENTS",
  description: "Create a new news article",
}

export default async function NewArticlePage() {
  await requireStaff("staff")
  
  const categories = await getNewsCategories()
  
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Article</h1>
        <p className="text-muted-foreground">
          Create a new news article or announcement
        </p>
      </div>
      
      <ArticleForm categories={categories} />
    </div>
  )
}

import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getNewsCategories } from "@/lib/content-actions"
import { ArticleForm } from "@/components/admin/article-form"

export const metadata = {
  title: "Edit Article | MAJH EVENTS",
  description: "Edit news article",
}

export default async function EditArticlePage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/auth/sign-in")
  
  const { data: staffRole } = await supabase
    .from("organization_members")
    .select("role:role_key")
    .eq("user_id", user.id)
    .single()
  
  if (!staffRole || !["owner", "manager", "staff", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_MANAGER", "DEPARTMENT_MANAGER", "DEPARTMENT_STAFF", "PLATFORM_OWNER"].includes(staffRole.role)) {
    redirect("/dashboard")
  }
  
  const [{ data: article }, categories] = await Promise.all([
    supabase
      .from("news_articles")
      .select("*")
      .eq("id", id)
      .single(),
    getNewsCategories(),
  ])

  if (!article) notFound()

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Article</h1>
        <p className="text-muted-foreground">
          Update article content and settings
        </p>
      </div>
      
      <ArticleForm categories={categories} article={article} />
    </div>
  )
}

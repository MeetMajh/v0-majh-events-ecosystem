import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getNewsCategories } from "@/lib/content-actions"
import { ArticleForm } from "@/components/admin/article-form"

export const metadata = {
  title: "New Article | MAJH EVENTS",
  description: "Create a new news article",
}

export default async function NewArticlePage() {
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

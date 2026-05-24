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
    .from("organization_members")
    .select("role:role_key")
    .eq("user_id", user.id)
    .single()
  
  if (!staffRole || !["owner", "manager", "staff", "TENANT_OWNER", "TENANT_SUPER_ADMIN", "TENANT_MANAGER", "DEPARTMENT_MANAGER", "DEPARTMENT_STAFF", "PLATFORM_OWNER"].includes(staffRole.role)) {
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

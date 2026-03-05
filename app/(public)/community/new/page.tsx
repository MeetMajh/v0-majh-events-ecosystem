import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { NewThreadForm } from "@/components/community/new-thread-form"

export const metadata = { title: "New Thread | MAJH EVENTS" }

export default async function NewThreadPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Start a New Thread</h1>
      <NewThreadForm />
    </div>
  )
}

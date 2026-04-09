import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Toaster } from "sonner"

export const metadata = { 
  title: "MAJH Studio Pro - Broadcast Control",
  description: "Professional broadcast production control room"
}

export default async function StudioProLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Studio Pro is a full-screen experience without the dashboard wrapper
  return (
    <>
      {children}
      <Toaster position="top-right" richColors />
    </>
  )
}

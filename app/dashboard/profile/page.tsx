import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ProfileForm } from "@/components/dashboard/profile-form"

export const metadata = { title: "Profile" }

export default async function ProfilePage(props: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Profile</h2>
        <p className="text-muted-foreground">Manage your personal information and preferences</p>
      </div>

      {searchParams.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{searchParams.error}</p>
        </div>
      )}

      {searchParams.success && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm text-primary">Profile updated successfully.</p>
        </div>
      )}

      <ProfileForm
        profile={{
          first_name: profile?.first_name || "",
          last_name: profile?.last_name || "",
          username: profile?.username || "",
          phone: profile?.phone || "",
          birthday: profile?.birthday || "",
          address_line1: profile?.address_line1 || "",
          address_line2: profile?.address_line2 || "",
          city: profile?.city || "",
          state: profile?.state || "",
          zip_code: profile?.zip_code || "",
          marketing_email_opt_in: profile?.marketing_email_opt_in ?? false,
          marketing_sms_opt_in: profile?.marketing_sms_opt_in ?? false,
        }}
        email={user.email || ""}
      />
    </div>
  )
}

"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const firstName = formData.get("first_name") as string
  const lastName = formData.get("last_name") as string
  const phone = formData.get("phone") as string
  const birthday = formData.get("birthday") as string
  const country = formData.get("country") as string
  const addressLine1 = formData.get("address_line1") as string
  const addressLine2 = formData.get("address_line2") as string
  const city = formData.get("city") as string
  const state = formData.get("state") as string
  const zipCode = formData.get("zip_code") as string
  const marketingEmail = formData.get("marketing_email_opt_in") === "on"
  const marketingSms = formData.get("marketing_sms_opt_in") === "on"

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo:
        process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
        `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard`,
      data: {
        first_name: firstName,
        last_name: lastName,
        phone,
        birthday: birthday || null,
        country: country || "US",
        address_line1: addressLine1 || null,
        address_line2: addressLine2 || null,
        city: city || null,
        state: state || null,
        zip_code: zipCode || null,
        marketing_email_opt_in: marketingEmail,
        marketing_sms_opt_in: marketingSms,
      },
    },
  })

  if (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`)
  }

  redirect("/auth/sign-up-success")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get("email") as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/update-password`,
  })

  if (error) {
    redirect(`/auth/forgot-password?error=${encodeURIComponent(error.message)}`)
  }

  redirect("/auth/forgot-password?success=true")
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get("password") as string

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect(`/auth/update-password?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Validate and sanitize username
  const rawUsername = (formData.get("username") as string) || ""
  const username = rawUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30)

  // Check if username is taken (if it changed)
  if (username) {
    const { data: existingUser } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .neq("id", user.id)
      .single()

    if (existingUser) {
      redirect(`/dashboard/profile?error=${encodeURIComponent("Username is already taken")}`)
    }
  }

  const updates: Record<string, any> = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    username: username || null,
    phone: formData.get("phone") as string,
    birthday: (formData.get("birthday") as string) || null,
    country: (formData.get("country") as string) || null,
    address_line1: (formData.get("address_line1") as string) || null,
    address_line2: (formData.get("address_line2") as string) || null,
    city: (formData.get("city") as string) || null,
    state: (formData.get("state") as string) || null,
    zip_code: (formData.get("zip_code") as string) || null,
    marketing_email_opt_in: formData.get("marketing_email_opt_in") === "on",
    marketing_sms_opt_in: formData.get("marketing_sms_opt_in") === "on",
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)

  if (error) {
    redirect(`/dashboard/profile?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath("/dashboard/profile")
  redirect("/dashboard/profile?success=true")
}

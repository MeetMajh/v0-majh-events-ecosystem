import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireCronAuth } from "@/lib/cron-auth"
import { sendEmail } from "@/lib/email/send"
import { getEmailTemplate } from "@/lib/email/templates"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_ATTEMPTS = 3
const BATCH_SIZE = 50

export async function GET(req: Request) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  try {
    // Fetch pending queue items with their notifications and user emails
    const { data: jobs, error } = await supabaseAdmin
      .from("notification_queue")
      .select(`
        id,
        user_id,
        channel,
        attempts,
        notification_id,
        notifications (
          id,
          type,
          title,
          body,
          link,
          priority,
          tournament_id,
          match_id
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .lt("attempts", MAX_ATTEMPTS)
      .order("scheduled_for", { ascending: true })
      .limit(BATCH_SIZE)

    if (error) {
      console.error("[Dispatch] Queue fetch error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const results = { processed: 0, sent: 0, failed: 0, skipped: 0 }

    for (const job of jobs ?? []) {
      results.processed++
      const notification = (job as any).notifications

      try {
        if (job.channel === "in_app") {
          // in_app is already written to notifications table — just mark sent
          await supabaseAdmin
            .from("notification_queue")
            .update({ status: "sent", updated_at: new Date().toISOString() })
            .eq("id", job.id)

          await logDelivery(job.user_id, job.notification_id, "in_app", true, null)
          results.sent++
          continue
        }

        if (job.channel === "email") {
          // Get user email from auth.users via RPC
          const { data: userData } = await supabaseAdmin
            .rpc("get_user_email", { p_user_id: job.user_id })
            .single()

          const email = (userData as any)?.email

          if (!email) {
            await supabaseAdmin
              .from("notification_queue")
              .update({ status: "skipped", updated_at: new Date().toISOString() })
              .eq("id", job.id)
            results.skipped++
            continue
          }

          // Get profile name
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", job.user_id)
            .single()

          const firstName = (profile as any)?.first_name ?? "there"

          // Build email from template
          const template = getEmailTemplate(notification.type, {
            name: firstName,
            title: notification.title,
            message: notification.body,
            link: notification.link,
          })

          const result = await sendEmail(email, template)

          if (result.error) {
            throw new Error(result.error.message)
          }

          await supabaseAdmin
            .from("notification_queue")
            .update({ status: "sent", updated_at: new Date().toISOString() })
            .eq("id", job.id)

          await logDelivery(job.user_id, job.notification_id, "email", true, { id: result.data?.id })
          results.sent++
        }
      } catch (err: any) {
        const newAttempts = job.attempts + 1
        const newStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending"

        await supabaseAdmin
          .from("notification_queue")
          .update({
            status: newStatus,
            attempts: newAttempts,
            last_error: err.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)

        await logDelivery(job.user_id, job.notification_id, job.channel, false, null, err.message)
        results.failed++
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    console.error("[Dispatch] Worker error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

async function logDelivery(
  userId: string,
  notificationId: string,
  channel: string,
  success: boolean,
  response: object | null,
  error?: string
) {
  await supabaseAdmin.from("notification_logs").insert({
    user_id: userId,
    notification_id: notificationId,
    channel,
    success,
    response,
    error: error ?? null,
  })
}

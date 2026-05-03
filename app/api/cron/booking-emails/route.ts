import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEventReminderEmail, sendPostEventFollowUpEmail } from "@/lib/booking-emails"
import { requireCronAuth } from "@/lib/cron-auth"

// Service role client for cron job (no auth context)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Vercel Cron: Run daily at 9:00 AM UTC
// Add to vercel.json: { "crons": [{ "path": "/api/cron/booking-emails", "schedule": "0 9 * * *" }] }

export async function GET(req: Request) {
  const authError = requireCronAuth(req)
  if (authError) return authError

  const results = {
    reminders: { sent: 0, failed: 0 },
    followups: { sent: 0, failed: 0 },
    errors: [] as string[],
  }

  try {
    // ══════════════════════════════════════════
    // 1. SEND 24-HOUR REMINDERS
    // ══════════════════════════════════════════
    
    // Get bookings happening tomorrow (deposit paid, not cancelled)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]

    const { data: upcomingBookings, error: upcomingError } = await supabaseAdmin
      .from("cb_bookings")
      .select(`
        id,
        contact_name,
        contact_email,
        contact_phone,
        event_date,
        start_time,
        guest_count,
        total_cents,
        deposit_cents,
        venue_notes,
        reminder_sent,
        cb_event_packages (name)
      `)
      .eq("event_date", tomorrowStr)
      .in("status", ["confirmed", "deposit_paid"])
      .eq("reminder_sent", false)

    if (upcomingError) {
      results.errors.push(`Failed to fetch upcoming bookings: ${upcomingError.message}`)
    } else if (upcomingBookings && upcomingBookings.length > 0) {
      for (const booking of upcomingBookings) {
        try {
          await sendEventReminderEmail({
            bookingId: booking.id,
            contactName: booking.contact_name,
            contactEmail: booking.contact_email,
            contactPhone: booking.contact_phone || undefined,
            packageName: booking.cb_event_packages?.name || "Event",
            eventDate: booking.event_date,
            startTime: booking.start_time || undefined,
            guestCount: booking.guest_count,
            totalCents: booking.total_cents,
            depositCents: booking.deposit_cents,
            specialRequests: booking.venue_notes || undefined,
          })

          // Mark reminder as sent
          await supabaseAdmin
            .from("cb_bookings")
            .update({ reminder_sent: true })
            .eq("id", booking.id)

          results.reminders.sent++
        } catch (err) {
          results.reminders.failed++
          results.errors.push(`Reminder failed for ${booking.id}: ${err}`)
        }
      }
    }

    // ══════════════════════════════════════════
    // 2. SEND POST-EVENT FOLLOW-UPS
    // ══════════════════════════════════════════
    
    // Get bookings from yesterday that are completed
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]

    const { data: completedBookings, error: completedError } = await supabaseAdmin
      .from("cb_bookings")
      .select(`
        id,
        contact_name,
        contact_email,
        contact_phone,
        event_date,
        start_time,
        guest_count,
        total_cents,
        deposit_cents,
        venue_notes,
        followup_sent,
        cb_event_packages (name)
      `)
      .eq("event_date", yesterdayStr)
      .in("status", ["completed", "deposit_paid", "confirmed"])
      .eq("followup_sent", false)

    if (completedError) {
      results.errors.push(`Failed to fetch completed bookings: ${completedError.message}`)
    } else if (completedBookings && completedBookings.length > 0) {
      for (const booking of completedBookings) {
        try {
          await sendPostEventFollowUpEmail({
            bookingId: booking.id,
            contactName: booking.contact_name,
            contactEmail: booking.contact_email,
            contactPhone: booking.contact_phone || undefined,
            packageName: booking.cb_event_packages?.name || "Event",
            eventDate: booking.event_date,
            startTime: booking.start_time || undefined,
            guestCount: booking.guest_count,
            totalCents: booking.total_cents,
            depositCents: booking.deposit_cents,
            specialRequests: booking.venue_notes || undefined,
          })

          // Mark follow-up as sent and complete the booking
          await supabaseAdmin
            .from("cb_bookings")
            .update({ 
              followup_sent: true,
              status: "completed",
            })
            .eq("id", booking.id)

          results.followups.sent++
        } catch (err) {
          results.followups.failed++
          results.errors.push(`Follow-up failed for ${booking.id}: ${err}`)
        }
      }
    }

    console.log("[Booking Emails Cron] Results:", results)

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("[Booking Emails Cron] Fatal error:", error)
    return NextResponse.json(
      { error: "Cron job failed", details: String(error) },
      { status: 500 }
    )
  }
}

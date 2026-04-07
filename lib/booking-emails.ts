"use server"

import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = "bookings@majhevents.com"
const ADMIN_EMAIL = "events@majhevents.com"

type BookingEmailData = {
  bookingId: string
  contactName: string
  contactEmail: string
  contactPhone?: string
  packageName: string
  eventDate: string
  startTime?: string
  guestCount: number
  totalCents: number
  depositCents: number
  specialRequests?: string
}

// Generate HTML email template
function generateEmailTemplate(content: {
  title: string
  preheader: string
  body: string
  ctaText?: string
  ctaUrl?: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${content.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center; }
    .logo { color: #ffffff; font-size: 24px; font-weight: bold; margin: 0; }
    .logo span { color: #d4af37; }
    .content { padding: 32px; }
    .title { font-size: 24px; font-weight: bold; color: #1a1a2e; margin: 0 0 16px 0; }
    .text { color: #555; margin: 0 0 16px 0; }
    .details-box { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #1a1a2e; }
    .cta-button { display: inline-block; background: #d4af37; color: #1a1a2e !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .footer { background: #f8f9fa; padding: 24px; text-align: center; font-size: 12px; color: #666; }
    .footer a { color: #d4af37; }
    .price-total { font-size: 28px; font-weight: bold; color: #d4af37; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-confirmed { background: #d4edda; color: #155724; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-paid { background: #cce5ff; color: #004085; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">MAJH <span>EVENTS</span></h1>
    </div>
    <div class="content">
      ${content.body}
      ${content.ctaText && content.ctaUrl ? `
        <div style="text-align: center;">
          <a href="${content.ctaUrl}" class="cta-button">${content.ctaText}</a>
        </div>
      ` : ''}
    </div>
    <div class="footer">
      <p>MAJH EVENTS - Premium Gaming Experiences</p>
      <p>Questions? Reply to this email or contact us at <a href="mailto:events@majhevents.com">events@majhevents.com</a></p>
      <p>&copy; ${new Date().getFullYear()} MAJH EVENTS. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `.trim()
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
}

function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':')
  const hour = parseInt(hours)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

// ══════════════════════════════════════════
// BOOKING INQUIRY EMAIL (to user)
// ══════════════════════════════════════════

export async function sendBookingInquiryEmail(data: BookingEmailData) {
  if (!resend) {
    console.log("[Booking Email] Resend not configured, skipping inquiry email")
    return
  }

  const body = `
    <h2 class="title">Thank You for Your Inquiry!</h2>
    <p class="text">Hi ${data.contactName},</p>
    <p class="text">We've received your event booking inquiry. Our team will review your request and get back to you within 24-48 hours.</p>
    
    <div class="details-box">
      <h3 style="margin: 0 0 16px 0; color: #1a1a2e;">Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Reference</span>
        <span class="detail-value">#${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Package</span>
        <span class="detail-value">${data.packageName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${formatDate(data.eventDate)}</span>
      </div>
      ${data.startTime ? `
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${formatTime(data.startTime)}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Guests</span>
        <span class="detail-value">${data.guestCount} people</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Estimated Total</span>
        <span class="detail-value price-total">${formatCurrency(data.totalCents)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Deposit Required</span>
        <span class="detail-value">${formatCurrency(data.depositCents)} (25%)</span>
      </div>
    </div>
    
    <p class="text"><strong>What happens next?</strong></p>
    <ol style="color: #555;">
      <li>Our team reviews your request</li>
      <li>We confirm availability for your selected date</li>
      <li>You receive a confirmation email with payment link</li>
      <li>Pay your 25% deposit to secure your booking</li>
    </ol>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.contactEmail,
      subject: `Booking Inquiry Received - ${data.packageName} on ${formatDate(data.eventDate)}`,
      html: generateEmailTemplate({
        title: "Booking Inquiry Received",
        preheader: `We've received your inquiry for ${data.packageName}`,
        body,
        ctaText: "View Your Booking",
        ctaUrl: `https://majhevents.com/dashboard/my-bookings/${data.bookingId}`,
      }),
    })
  } catch (error) {
    console.error("[Booking Email] Failed to send inquiry email:", error)
  }
}

// ══════════════════════════════════════════
// BOOKING CONFIRMED EMAIL (to user)
// ══════════════════════════════════════════

export async function sendBookingConfirmedEmail(data: BookingEmailData) {
  if (!resend) {
    console.log("[Booking Email] Resend not configured, skipping confirmed email")
    return
  }

  const body = `
    <h2 class="title">Your Booking is Confirmed!</h2>
    <p class="text">Hi ${data.contactName},</p>
    <p class="text">Great news! Your event booking has been confirmed. Please pay your deposit to secure your date.</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <span class="status-badge status-confirmed">CONFIRMED</span>
    </div>
    
    <div class="details-box">
      <h3 style="margin: 0 0 16px 0; color: #1a1a2e;">Event Details</h3>
      <div class="detail-row">
        <span class="detail-label">Reference</span>
        <span class="detail-value">#${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Package</span>
        <span class="detail-value">${data.packageName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${formatDate(data.eventDate)}</span>
      </div>
      ${data.startTime ? `
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${formatTime(data.startTime)}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Guests</span>
        <span class="detail-value">${data.guestCount} people</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total</span>
        <span class="detail-value price-total">${formatCurrency(data.totalCents)}</span>
      </div>
    </div>
    
    <div style="background: #fff3cd; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0; color: #856404;"><strong>Deposit Required:</strong> ${formatCurrency(data.depositCents)}</p>
      <p style="margin: 8px 0 0 0; color: #856404; font-size: 14px;">Pay your deposit to secure your booking date.</p>
    </div>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.contactEmail,
      subject: `Booking Confirmed! - ${data.packageName} on ${formatDate(data.eventDate)}`,
      html: generateEmailTemplate({
        title: "Booking Confirmed",
        preheader: `Your ${data.packageName} event is confirmed!`,
        body,
        ctaText: "Pay Deposit Now",
        ctaUrl: `https://majhevents.com/dashboard/my-bookings/${data.bookingId}`,
      }),
    })
  } catch (error) {
    console.error("[Booking Email] Failed to send confirmed email:", error)
  }
}

// ══════════════════════════════════════════
// DEPOSIT PAID EMAIL (to user)
// ══════════════════════════════════════════

export async function sendDepositPaidEmail(data: BookingEmailData) {
  if (!resend) {
    console.log("[Booking Email] Resend not configured, skipping deposit paid email")
    return
  }

  const body = `
    <h2 class="title">Deposit Received - You're All Set!</h2>
    <p class="text">Hi ${data.contactName},</p>
    <p class="text">We've received your deposit payment. Your event is now fully secured!</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <span class="status-badge status-paid">DEPOSIT PAID</span>
    </div>
    
    <div class="details-box">
      <h3 style="margin: 0 0 16px 0; color: #1a1a2e;">Your Event</h3>
      <div class="detail-row">
        <span class="detail-label">Reference</span>
        <span class="detail-value">#${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Package</span>
        <span class="detail-value">${data.packageName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${formatDate(data.eventDate)}</span>
      </div>
      ${data.startTime ? `
      <div class="detail-row">
        <span class="detail-label">Time</span>
        <span class="detail-value">${formatTime(data.startTime)}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Guests</span>
        <span class="detail-value">${data.guestCount} people</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Deposit Paid</span>
        <span class="detail-value" style="color: #28a745;">${formatCurrency(data.depositCents)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Balance Due</span>
        <span class="detail-value">${formatCurrency(data.totalCents - data.depositCents)}</span>
      </div>
    </div>
    
    <p class="text"><strong>What's Next?</strong></p>
    <ul style="color: #555;">
      <li>Our team will contact you 1 week before your event</li>
      <li>Remaining balance is due on the day of your event</li>
      <li>Arrive 15 minutes early to get set up</li>
    </ul>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: data.contactEmail,
      subject: `Deposit Received - ${data.packageName} on ${formatDate(data.eventDate)}`,
      html: generateEmailTemplate({
        title: "Deposit Received",
        preheader: `Your deposit for ${data.packageName} has been received!`,
        body,
        ctaText: "View Booking Details",
        ctaUrl: `https://majhevents.com/dashboard/my-bookings/${data.bookingId}`,
      }),
    })
  } catch (error) {
    console.error("[Booking Email] Failed to send deposit paid email:", error)
  }
}

// ══════════════════════════════════════════
// ADMIN NOTIFICATION EMAIL
// ══════════════════════════════════════════

export async function sendAdminBookingNotification(data: BookingEmailData, eventType: "inquiry" | "confirmed" | "deposit_paid") {
  if (!resend) {
    console.log("[Booking Email] Resend not configured, skipping admin notification")
    return
  }

  const eventLabels = {
    inquiry: "New Booking Inquiry",
    confirmed: "Booking Confirmed",
    deposit_paid: "Deposit Payment Received",
  }

  const body = `
    <h2 class="title">${eventLabels[eventType]}</h2>
    <p class="text">A new booking ${eventType === "inquiry" ? "inquiry" : "update"} has been received.</p>
    
    <div class="details-box">
      <h3 style="margin: 0 0 16px 0; color: #1a1a2e;">Booking Details</h3>
      <div class="detail-row">
        <span class="detail-label">Reference</span>
        <span class="detail-value">#${data.bookingId.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Customer</span>
        <span class="detail-value">${data.contactName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">${data.contactEmail}</span>
      </div>
      ${data.contactPhone ? `
      <div class="detail-row">
        <span class="detail-label">Phone</span>
        <span class="detail-value">${data.contactPhone}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Package</span>
        <span class="detail-value">${data.packageName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${formatDate(data.eventDate)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Guests</span>
        <span class="detail-value">${data.guestCount}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total</span>
        <span class="detail-value price-total">${formatCurrency(data.totalCents)}</span>
      </div>
      ${data.specialRequests ? `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
        <span class="detail-label">Special Requests:</span>
        <p style="margin: 8px 0 0 0; color: #333;">${data.specialRequests}</p>
      </div>
      ` : ''}
    </div>
  `

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[ADMIN] ${eventLabels[eventType]} - #${data.bookingId.slice(0, 8).toUpperCase()}`,
      html: generateEmailTemplate({
        title: eventLabels[eventType],
        preheader: `${eventLabels[eventType]} from ${data.contactName}`,
        body,
        ctaText: "View in Dashboard",
        ctaUrl: `https://majhevents.com/dashboard/carbardmv/events`,
      }),
    })
  } catch (error) {
    console.error("[Booking Email] Failed to send admin notification:", error)
  }
}

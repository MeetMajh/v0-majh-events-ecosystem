"use server"

import { createClient } from "@/lib/supabase/server"

// Email notification types that we actually send emails for
// (not every notification warrants an email)
const EMAIL_WORTHY_TYPES = [
  "match_ready",
  "tournament_starting",
  "staff_alert",
  "achievement_earned",
]

interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

// Check if user wants email notifications for this type
async function shouldSendEmail(
  userId: string,
  notificationType: string
): Promise<{ shouldSend: boolean; email?: string }> {
  const supabase = await createClient()

  // Get user preferences
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email")
    .eq("user_id", userId)
    .single()

  if (!prefs?.email) {
    return { shouldSend: false }
  }

  // Only send emails for important notification types
  if (!EMAIL_WORTHY_TYPES.includes(notificationType)) {
    return { shouldSend: false }
  }

  // Get user email
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single()

  if (!profile?.email) {
    return { shouldSend: false }
  }

  return { shouldSend: true, email: profile.email }
}

// Generate email HTML for different notification types
function generateEmailHtml(type: string, title: string, body?: string, link?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://majhevents.com"
  const actionLink = link ? `${baseUrl}${link}` : baseUrl

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #1a1a1a;
      margin-bottom: 24px;
    }
    .logo span {
      color: #eab308;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 12px 0;
      color: #1a1a1a;
    }
    p {
      margin: 0 0 16px 0;
      color: #4a4a4a;
    }
    .button {
      display: inline-block;
      background: #eab308;
      color: #1a1a1a;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 16px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      font-size: 12px;
      color: #888;
    }
    .footer a {
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">MAJH <span>EVENTS</span></div>
      <h1>${title}</h1>
      ${body ? `<p>${body}</p>` : ""}
      ${link ? `<a href="${actionLink}" class="button">View Details</a>` : ""}
      <div class="footer">
        <p>You received this email because you have email notifications enabled.</p>
        <p><a href="${baseUrl}/settings/notifications">Manage notification settings</a></p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim()
}

// Send email notification
export async function sendEmailNotification(params: {
  userId: string
  type: string
  title: string
  body?: string
  link?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { shouldSend, email } = await shouldSendEmail(params.userId, params.type)

    if (!shouldSend || !email) {
      return { success: true } // Not an error, just not sending
    }

    const html = generateEmailHtml(params.type, params.title, params.body, params.link)

    // Check if we have Resend API key
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      console.log("[Notification] Email would be sent to:", email)
      console.log("[Notification] Subject:", params.title)
      // In development without API key, just log
      return { success: true }
    }

    // Send via Resend
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MAJH EVENTS <notifications@majhevents.com>",
        to: email,
        subject: params.title,
        html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[Notification] Email send failed:", error)
      return { success: false, error }
    }

    return { success: true }
  } catch (error) {
    console.error("[Notification] Email error:", error)
    return { success: false, error: String(error) }
  }
}

// Batch send emails to multiple users
export async function sendBatchEmailNotifications(params: {
  userIds: string[]
  type: string
  title: string
  body?: string
  link?: string
}): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (const userId of params.userIds) {
    const result = await sendEmailNotification({
      userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
    })

    if (result.success) {
      sent++
    } else {
      failed++
    }
  }

  return { sent, failed }
}

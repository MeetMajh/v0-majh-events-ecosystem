"use server"

import { NextResponse } from "next/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM_EMAIL = "events@majhevents.com"
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://majhevents.com"

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { to, firstName, events } = await req.json()

  if (!to || !events?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const eventsHtml = events
    .map(
      (e: { name: string; slug: string; start_date: string }) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a;">
          <a href="${BASE_URL}/esports/tournaments/${e.slug}" style="color: #eab308; text-decoration: none; font-weight: 600; font-size: 15px;">${e.name}</a>
        </td>
        <td style="padding: 12px 16px; border-bottom: 1px solid #2a2a2a; color: #a3a3a3; font-size: 14px; white-space: nowrap;">
          ${new Date(e.start_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })}
        </td>
      </tr>
    `
    )
    .join("")

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Logo / Header -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:22px;font-weight:800;letter-spacing:0.05em;color:#ffffff;">MAJH <span style="color:#eab308;">EVENTS</span></span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#141414;border-radius:12px;border:1px solid #2a2a2a;overflow:hidden;">

              <!-- Card header -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:28px 32px 20px;border-bottom:1px solid #2a2a2a;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#eab308;">Tournament Reminder</p>
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                      You&apos;re registered for ${events.length} upcoming event${events.length > 1 ? "s" : ""}
                    </h1>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td style="padding:20px 32px 8px;">
                    <p style="margin:0;color:#a3a3a3;font-size:15px;line-height:1.6;">
                      Hey ${firstName || "Player"}, just a reminder that you have the following tournaments coming up. Make sure you&apos;re ready to compete.
                    </p>
                  </td>
                </tr>

                <!-- Events table -->
                <tr>
                  <td style="padding:16px 32px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;">
                      <thead>
                        <tr style="background-color:#1f1f1f;">
                          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Event</th>
                          <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Date</th>
                        </tr>
                      </thead>
                      <tbody style="background-color:#141414;">
                        ${eventsHtml}
                      </tbody>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding:0 32px 32px;text-align:center;">
                    <a href="${BASE_URL}/esports/tournaments" style="display:inline-block;background-color:#eab308;color:#0a0a0a;font-weight:700;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:0.02em;">
                      View My Events
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#525252;">
                You are receiving this because you registered on
                <a href="${BASE_URL}" style="color:#eab308;text-decoration:none;">majhevents.com</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  const { data, error } = await resend.emails.send({
    from: `MAJH Events <${FROM_EMAIL}>`,
    to,
    subject: `Reminder: You have ${events.length} upcoming tournament${events.length > 1 ? "s" : ""} on MAJH Events`,
    html,
  })

  if (error) {
    console.error("[send-reminder] Resend error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: data?.id })
}

import { Resend } from "resend"

// Lazy initialization to avoid build-time errors
let resendInstance: Resend | null = null

function getResend(): Resend {
  if (!resendInstance) {
    const key = process.env.RESEND_API_KEY
    if (!key) {
      throw new Error("RESEND_API_KEY is not configured")
    }
    resendInstance = new Resend(key)
  }
  return resendInstance
}

export type EmailTemplate = {
  subject: string
  html: string
}

export async function sendEmail(to: string, template: EmailTemplate) {
  return getResend().emails.send({
    from: "MAJH Events <events@majhevents.com>",
    to,
    subject: template.subject,
    html: template.html,
  })
}

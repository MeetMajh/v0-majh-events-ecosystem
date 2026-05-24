import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export type EmailTemplate = {
  subject: string
  html: string
}

export async function sendEmail(to: string, template: EmailTemplate) {
  return resend.emails.send({
    from: "MAJH Events <events@majhevents.com>",
    to,
    subject: template.subject,
    html: template.html,
  })
}

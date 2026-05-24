import { emailLayout, heading, body, primaryButton, divider } from "./layout"
import type { EmailTemplate } from "./send"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://majhevents.com"

type TemplateParams = {
  name?: string
  title?: string
  message?: string
  link?: string
  [key: string]: string | undefined
}

// ==========================================
// INDIVIDUAL TEMPLATES
// ==========================================

export function tournamentRegistrationEmail(p: TemplateParams): EmailTemplate {
  return {
    subject: `Registration confirmed: ${p.title ?? "Tournament"}`,
    html: emailLayout(`
      ${heading("You're registered!")}
      ${body(`Hey ${p.name ?? "there"}, your registration for <strong style="color:#fff;">${p.title ?? "the tournament"}</strong> is confirmed.`)}
      ${body("We'll send you a reminder before the event begins. Get ready.")}
      ${p.link ? primaryButton("View Tournament", p.link) : ""}
    `),
  }
}

export function tournamentStartingEmail(p: TemplateParams): EmailTemplate {
  return {
    subject: `${p.title ?? "Your tournament"} is starting soon`,
    html: emailLayout(`
      ${heading("Tournament Starting Soon")}
      ${body(`Hey ${p.name ?? "there"}, <strong style="color:#fff;">${p.title ?? "your tournament"}</strong> is about to begin.`)}
      ${body(p.message ?? "Check in now and make sure you are ready to compete.")}
      ${p.link ? primaryButton("Go to Tournament", p.link) : ""}
    `),
  }
}

export function matchReadyEmail(p: TemplateParams): EmailTemplate {
  return {
    subject: "Your match is ready",
    html: emailLayout(`
      ${heading("Match Ready")}
      ${body(`Hey ${p.name ?? "there"}, your match is ready.`)}
      ${body(p.message ?? "Head to the platform to begin your match now.")}
      ${p.link ? primaryButton("Start Match", p.link) : ""}
    `),
  }
}

export function matchResultEmail(p: TemplateParams): EmailTemplate {
  return {
    subject: "Match result recorded",
    html: emailLayout(`
      ${heading("Match Result")}
      ${body(`Hey ${p.name ?? "there"}, your match result has been recorded.`)}
      ${body(p.message ?? "")}
      ${p.link ? primaryButton("View Result", p.link) : ""}
    `),
  }
}

export function staffAlertEmail(p: TemplateParams): EmailTemplate {
  return {
    subject: `Staff Alert: ${p.title ?? "Action Required"}`,
    html: emailLayout(`
      ${heading(p.title ?? "Staff Alert")}
      ${body(`Hey ${p.name ?? "there"}, you have a new alert from tournament staff.`)}
      ${body(p.message ?? "")}
      ${divider()}
      ${p.link ? primaryButton("View Details", p.link) : ""}
    `),
  }
}

export function achievementEarnedEmail(p: TemplateParams): EmailTemplate {
  return {
    subject: `Achievement unlocked: ${p.title ?? "New Achievement"}`,
    html: emailLayout(`
      ${heading("Achievement Unlocked")}
      ${body(`Hey ${p.name ?? "there"}, you earned a new achievement: <strong style="color:#eab308;">${p.title ?? ""}</strong>.`)}
      ${body(p.message ?? "")}
      ${p.link ? primaryButton("View Achievement", p.link) : ""}
    `),
  }
}

export function systemEmail(p: TemplateParams): EmailTemplate {
  return {
    subject: p.title ?? "Notification from MAJH Events",
    html: emailLayout(`
      ${heading(p.title ?? "Update")}
      ${body(`Hey ${p.name ?? "there"}.`)}
      ${body(p.message ?? "")}
      ${p.link ? primaryButton("View", p.link) : ""}
    `),
  }
}

// ==========================================
// ROUTER — maps notification type to template
// ==========================================

export function getEmailTemplate(type: string, params: TemplateParams): EmailTemplate {
  switch (type) {
    case "tournament_registration":
      return tournamentRegistrationEmail(params)
    case "tournament_starting":
      return tournamentStartingEmail(params)
    case "match_ready":
    case "match_starting":
      return matchReadyEmail(params)
    case "match_result":
      return matchResultEmail(params)
    case "staff_alert":
      return staffAlertEmail(params)
    case "achievement_earned":
      return achievementEarnedEmail(params)
    default:
      return systemEmail(params)
  }
}

import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

interface PendingAlert {
  id: string
  tenant_id: string
  alert_type: string
  severity: "info" | "warning" | "critical"
  title: string
  message: string | null
  resource_type: string | null
  resource_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  webhook_url: string | null
  slack_webhook_url: string | null
  email_recipients: string[] | null
}

// Slack message formatting
function formatSlackMessage(alert: PendingAlert) {
  const severityEmoji = {
    critical: ":rotating_light:",
    warning: ":warning:",
    info: ":information_source:",
  }

  const severityColor = {
    critical: "#dc2626",
    warning: "#f59e0b",
    info: "#3b82f6",
  }

  return {
    attachments: [
      {
        color: severityColor[alert.severity],
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${severityEmoji[alert.severity]} ${alert.title}`,
              emoji: true,
            },
          },
          ...(alert.message
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: alert.message,
                  },
                },
              ]
            : []),
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Type:*\n${alert.alert_type}`,
              },
              {
                type: "mrkdwn",
                text: `*Severity:*\n${alert.severity.toUpperCase()}`,
              },
              ...(alert.resource_type
                ? [
                    {
                      type: "mrkdwn",
                      text: `*Resource:*\n${alert.resource_type}`,
                    },
                  ]
                : []),
              ...(alert.metadata?.amount_cents
                ? [
                    {
                      type: "mrkdwn",
                      text: `*Amount:*\n$${(Number(alert.metadata.amount_cents) / 100).toFixed(2)}`,
                    },
                  ]
                : []),
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Alert ID: ${alert.id} | ${new Date(alert.created_at).toLocaleString()}`,
              },
            ],
          },
        ],
      },
    ],
  }
}

// Generic webhook payload
function formatWebhookPayload(alert: PendingAlert) {
  return {
    event: "financial_alert",
    alert_id: alert.id,
    alert_type: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    resource_type: alert.resource_type,
    resource_id: alert.resource_id,
    metadata: alert.metadata,
    created_at: alert.created_at,
    tenant_id: alert.tenant_id,
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()

  try {
    // Get pending alerts
    const { data: pendingData, error: fetchError } = await supabase.rpc(
      "get_pending_alerts",
      { p_limit: 25 }
    )

    if (fetchError) {
      console.error("Error fetching pending alerts:", fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const alerts: PendingAlert[] = pendingData?.alerts || []

    if (alerts.length === 0) {
      return NextResponse.json({ message: "No pending alerts", processed: 0 })
    }

    const results: {
      id: string
      slack: boolean | null
      webhook: boolean | null
      error?: string
    }[] = []

    for (const alert of alerts) {
      let slackSuccess: boolean | null = null
      let webhookSuccess: boolean | null = null
      let deliveryError: string | null = null

      // Send to Slack
      if (alert.slack_webhook_url) {
        try {
          const slackPayload = formatSlackMessage(alert)
          const slackResponse = await fetch(alert.slack_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackPayload),
          })
          slackSuccess = slackResponse.ok
          if (!slackResponse.ok) {
            deliveryError = `Slack error: ${slackResponse.status}`
          }
        } catch (err) {
          slackSuccess = false
          deliveryError = `Slack error: ${err instanceof Error ? err.message : "Unknown"}`
        }
      }

      // Send to custom webhook
      if (alert.webhook_url) {
        try {
          const webhookPayload = formatWebhookPayload(alert)
          const webhookResponse = await fetch(alert.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(webhookPayload),
          })
          webhookSuccess = webhookResponse.ok
          if (!webhookResponse.ok) {
            deliveryError = `${deliveryError ? deliveryError + "; " : ""}Webhook error: ${webhookResponse.status}`
          }
        } catch (err) {
          webhookSuccess = false
          deliveryError = `${deliveryError ? deliveryError + "; " : ""}Webhook error: ${err instanceof Error ? err.message : "Unknown"}`
        }
      }

      // Mark alert as delivered
      const overallSuccess =
        (slackSuccess === null || slackSuccess) &&
        (webhookSuccess === null || webhookSuccess)

      await supabase.rpc("mark_alert_delivered", {
        p_alert_id: alert.id,
        p_success: overallSuccess,
        p_error: deliveryError,
      })

      results.push({
        id: alert.id,
        slack: slackSuccess,
        webhook: webhookSuccess,
        ...(deliveryError && { error: deliveryError }),
      })
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("Alert delivery error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

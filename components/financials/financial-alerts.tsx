"use client"

import Link from "next/link"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { 
  AlertCircle, 
  CheckCircle, 
  Info, 
  XCircle,
  ArrowRight,
  X
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface FinancialAlert {
  id: string
  alert_type: string
  severity: string
  title: string
  message: string
  action_url?: string
  created_at: string
}

interface FinancialAlertsProps {
  alerts: FinancialAlert[]
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
    case "error":
      return <XCircle className="h-4 w-4" />
    case "warning":
      return <AlertCircle className="h-4 w-4" />
    case "info":
    default:
      return <Info className="h-4 w-4" />
  }
}

function getSeverityVariant(severity: string): "default" | "destructive" {
  switch (severity) {
    case "critical":
    case "error":
      return "destructive"
    default:
      return "default"
  }
}

function getSeverityClasses(severity: string) {
  switch (severity) {
    case "critical":
    case "error":
      return "border-red-200 bg-red-50/50 text-red-800 [&>svg]:text-red-500"
    case "warning":
      return "border-amber-200 bg-amber-50/50 text-amber-800 [&>svg]:text-amber-500"
    case "info":
    default:
      return "border-blue-200 bg-blue-50/50 text-blue-800 [&>svg]:text-blue-500"
  }
}

export function FinancialAlerts({ alerts }: FinancialAlertsProps) {
  const router = useRouter()

  async function dismissAlert(alertId: string) {
    const supabase = createClient()
    await supabase
      .from("financial_alerts")
      .update({ is_dismissed: true })
      .eq("id", alertId)
    
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Alert 
          key={alert.id} 
          variant={getSeverityVariant(alert.severity)}
          className={getSeverityClasses(alert.severity)}
        >
          {getSeverityIcon(alert.severity)}
          <AlertTitle className="flex items-center justify-between">
            <span>{alert.title}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 hover:bg-transparent opacity-60 hover:opacity-100"
              onClick={() => dismissAlert(alert.id)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            <span>{alert.message}</span>
            {alert.action_url && (
              <Link href={alert.action_url}>
                <Button variant="outline" size="sm" className="ml-4 shrink-0">
                  View <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            )}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}

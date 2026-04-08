import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ShieldCheck, 
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
  TrendingUp,
} from "lucide-react"
import { KycReviewQueue } from "@/components/admin/kyc-review-queue"
import { ComplianceAlerts } from "@/components/admin/compliance-alerts"
import { TaxFormReview } from "@/components/admin/tax-form-review"

export const metadata = {
  title: "Compliance Dashboard | Admin",
  description: "Review KYC submissions, compliance alerts, and tax forms",
}

export default async function ComplianceDashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Check admin access
  const { data: staffRole } = await supabase
    .from("staff_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .single()

  if (!staffRole) redirect("/dashboard")

  // Fetch compliance metrics
  const [
    { count: pendingKycCount },
    { count: verifiedCount },
    { count: rejectedCount },
    { count: openAlertsCount },
    { count: pendingTaxFormsCount },
    { data: recentKycSessions },
    { data: recentAlerts },
  ] = await Promise.all([
    // Pending KYC verifications
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("kyc_status", "pending"),
    // Verified users
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("kyc_status", "verified"),
    // Rejected verifications
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("kyc_status", "rejected"),
    // Open compliance alerts
    supabase
      .from("compliance_alerts")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    // Pending tax forms
    supabase
      .from("tax_forms")
      .select("*", { count: "exact", head: true })
      .eq("status", "submitted"),
    // Recent KYC sessions
    supabase
      .from("kyc_sessions")
      .select(`
        id,
        status,
        created_at,
        completed_at,
        risk_score,
        profiles!inner(id, username, display_name, email)
      `)
      .order("created_at", { ascending: false })
      .limit(5),
    // Recent alerts
    supabase
      .from("compliance_alerts")
      .select(`
        id,
        alert_type,
        severity,
        title,
        status,
        created_at,
        profiles(username, display_name)
      `)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const totalKycSubmissions = (pendingKycCount || 0) + (verifiedCount || 0) + (rejectedCount || 0)
  const verificationRate = totalKycSubmissions > 0 
    ? Math.round(((verifiedCount || 0) / totalKycSubmissions) * 100) 
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Compliance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Review identity verifications, compliance alerts, and tax documentation
          </p>
        </div>
        {(openAlertsCount || 0) > 0 && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {openAlertsCount} Open Alert{(openAlertsCount || 0) !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingKycCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              KYC submissions awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{verifiedCount || 0}</div>
            <p className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="mr-1 h-3 w-3 text-green-500" />
              {verificationRate}% verification rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Failed verifications
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Alerts</CardTitle>
            <ShieldAlert className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openAlertsCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tax Forms</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTaxFormsCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Pending review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Views */}
      <Tabs defaultValue="kyc" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kyc" className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            KYC Review
            {(pendingKycCount || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingKycCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alerts
            {(openAlertsCount || 0) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                {openAlertsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tax" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Tax Forms
            {(pendingTaxFormsCount || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingTaxFormsCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kyc" className="space-y-4">
          <KycReviewQueue />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <ComplianceAlerts />
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <TaxFormReview />
        </TabsContent>
      </Tabs>

      {/* Recent Activity Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent KYC Submissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recent KYC Submissions
            </CardTitle>
            <CardDescription>Latest identity verification requests</CardDescription>
          </CardHeader>
          <CardContent>
            {recentKycSessions && recentKycSessions.length > 0 ? (
              <div className="space-y-3">
                {recentKycSessions.map((session: any) => (
                  <div key={session.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {session.profiles?.display_name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {session.profiles?.display_name || session.profiles?.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.risk_score !== null && (
                        <span className={`text-xs font-medium ${
                          session.risk_score < 30 ? "text-green-500" :
                          session.risk_score < 70 ? "text-yellow-500" : "text-red-500"
                        }`}>
                          Risk: {session.risk_score}
                        </span>
                      )}
                      <Badge variant={
                        session.status === "verified" ? "default" :
                        session.status === "requires_input" ? "secondary" :
                        session.status === "processing" ? "outline" :
                        "destructive"
                      }>
                        {session.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No recent KYC submissions</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recent Compliance Alerts
            </CardTitle>
            <CardDescription>Latest flagged activities</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAlerts && recentAlerts.length > 0 ? (
              <div className="space-y-3">
                {recentAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        alert.severity === "critical" ? "bg-red-100 text-red-600" :
                        alert.severity === "high" ? "bg-orange-100 text-orange-600" :
                        alert.severity === "medium" ? "bg-yellow-100 text-yellow-600" :
                        "bg-blue-100 text-blue-600"
                      }`}>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.profiles?.display_name || alert.profiles?.username || "System"} - {new Date(alert.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      alert.status === "open" ? "destructive" :
                      alert.status === "investigating" ? "secondary" :
                      "outline"
                    }>
                      {alert.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No recent alerts</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

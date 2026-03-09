import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Mail, MessageSquare, Send, Clock, Users, BarChart3, 
  Play, Pause, FileText, Zap, Calendar, Settings
} from "lucide-react"
import Link from "next/link"
import { NewCampaignForm } from "@/components/carbardmv/new-campaign-form"

export const metadata = { title: "Marketing | CARBARDMV" }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-400",
  sending: "bg-amber-500/10 text-amber-400",
  sent: "bg-green-500/10 text-green-400",
  paused: "bg-orange-500/10 text-orange-400",
  cancelled: "bg-red-500/10 text-red-400",
}

export default async function MarketingPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  // Fetch campaigns
  const { data: campaigns } = await supabase
    .from("marketing_campaigns")
    .select("*, crm_segments(name)")
    .order("created_at", { ascending: false })
    .limit(20)

  // Fetch templates
  const { data: templates } = await supabase
    .from("marketing_templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  // Fetch automations
  const { data: automations } = await supabase
    .from("automation_rules")
    .select("*, marketing_templates(name)")
    .order("created_at", { ascending: false })

  // Stats
  const sentCampaigns = campaigns?.filter((c: any) => c.status === "sent") || []
  const totalSent = sentCampaigns.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0)
  const totalOpened = sentCampaigns.reduce((sum: number, c: any) => sum + (c.opened_count || 0), 0)
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0

  // Fetch segments for the form
  const { data: segments } = await supabase
    .from("crm_segments")
    .select("id, name, member_count")
    .order("name")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
          <p className="text-sm text-muted-foreground">Campaigns, templates, and automations</p>
        </div>
        <NewCampaignForm segments={segments || []} templates={templates || []} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Campaigns Sent</p>
              <p className="text-lg font-semibold">{sentCampaigns.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Mail className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Emails Sent</p>
              <p className="text-lg font-semibold">{totalSent.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-500/10 p-2">
              <BarChart3 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open Rate</p>
              <p className="text-lg font-semibold">{openRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2">
              <Zap className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Automations</p>
              <p className="text-lg font-semibold">{automations?.filter((a: any) => a.is_active).length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2">
            <Send className="h-4 w-4" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" /> Templates
          </TabsTrigger>
          <TabsTrigger value="automations" className="gap-2">
            <Zap className="h-4 w-4" /> Automations
          </TabsTrigger>
        </TabsList>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          {campaigns && campaigns.length > 0 ? (
            <div className="space-y-3">
              {campaigns.map((campaign: any) => (
                <Card key={campaign.id} className="transition-colors hover:border-primary/30">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{campaign.name}</h3>
                          <Badge variant="outline" className={STATUS_COLORS[campaign.status]}>
                            {campaign.status}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {campaign.type}
                          </Badge>
                        </div>
                        {campaign.subject && (
                          <p className="text-sm text-muted-foreground">Subject: {campaign.subject}</p>
                        )}
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {campaign.crm_segments?.name && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" /> {campaign.crm_segments.name}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(campaign.created_at)}
                          </span>
                          {campaign.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Scheduled: {formatDate(campaign.scheduled_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        {campaign.status === "sent" && (
                          <div className="text-sm">
                            <p className="font-medium">{campaign.sent_count || 0} sent</p>
                            <p className="text-xs text-muted-foreground">
                              {campaign.opened_count || 0} opened ({campaign.sent_count ? Math.round((campaign.opened_count / campaign.sent_count) * 100) : 0}%)
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Send className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-4 text-center text-muted-foreground">
                  No campaigns yet.<br />
                  Create your first email campaign above.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Link href="/dashboard/carbardmv/marketing/templates">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" /> Manage Templates
              </Button>
            </Link>
          </div>
          {templates && templates.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template: any) => (
                <Card key={template.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">{template.type}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {template.subject && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        Subject: {template.subject}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground line-clamp-2">{template.body}</p>
                    {template.variables && template.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((v: string) => (
                          <Badge key={v} variant="outline" className="text-[10px]">
                            {`{{${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-4 text-center text-muted-foreground">No templates yet.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Automations Tab */}
        <TabsContent value="automations" className="space-y-4">
          {automations && automations.length > 0 ? (
            <div className="space-y-3">
              {automations.map((automation: any) => (
                <Card key={automation.id} className="transition-colors hover:border-primary/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{automation.name}</h3>
                          <Badge variant="outline" className="capitalize text-[10px]">
                            {automation.type.replace("_", " ")}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {automation.marketing_templates?.name && (
                            <span>Template: {automation.marketing_templates.name}</span>
                          )}
                          {automation.trigger_config?.days_before !== undefined && (
                            <span>{automation.trigger_config.days_before} days before</span>
                          )}
                          {automation.trigger_config?.days_after !== undefined && (
                            <span>{automation.trigger_config.days_after} days after</span>
                          )}
                          {automation.last_run_at && (
                            <span>Last run: {formatDistanceToNow(new Date(automation.last_run_at), { addSuffix: true })}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={automation.is_active ? "default" : "secondary"}
                          className={automation.is_active ? "bg-green-500/10 text-green-400" : ""}
                        >
                          {automation.is_active ? (
                            <><Play className="mr-1 h-3 w-3" /> Active</>
                          ) : (
                            <><Pause className="mr-1 h-3 w-3" /> Inactive</>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="h-10 w-10 text-muted-foreground/50" />
                <p className="mt-4 text-center text-muted-foreground">No automations configured.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

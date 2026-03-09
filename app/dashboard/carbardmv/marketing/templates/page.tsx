import { createClient } from "@/lib/supabase/server"
import { requireRole } from "@/lib/roles"
import { formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, MessageSquare, FileText, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NewTemplateForm } from "@/components/carbardmv/new-template-form"

export const metadata = { title: "Email Templates | CARBARDMV" }

export default async function TemplatesPage() {
  await requireRole(["owner", "manager", "staff"])
  const supabase = await createClient()

  const { data: templates } = await supabase
    .from("marketing_templates")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/carbardmv/marketing">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
            <p className="text-sm text-muted-foreground">Create and manage reusable email templates</p>
          </div>
        </div>
        <NewTemplateForm />
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template: any) => (
            <Card key={template.id} className="transition-colors hover:border-primary/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {template.type === "email" ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    )}
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={template.is_active ? "default" : "secondary"} className="text-[10px]">
                      {template.is_active ? "Active" : "Inactive"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">{template.type}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {template.subject && (
                  <div>
                    <p className="text-xs text-muted-foreground">Subject:</p>
                    <p className="text-sm font-medium">{template.subject}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Body:</p>
                  <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-line">{template.body}</p>
                </div>
                {template.variables && template.variables.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Variables:</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((v: string) => (
                        <Badge key={v} variant="secondary" className="text-[10px]">
                          {`{{${v}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Created {formatDate(template.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-center text-muted-foreground">
              No templates yet.<br />
              Create your first email template above.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

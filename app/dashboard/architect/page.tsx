import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/auth/require-admin"
import ArchitectClient from "./architect-client"

export default async function ArchitectPage() {
  const auth = await requireAdmin()
  if ("error" in auth) {
    redirect("/auth/login?next=/dashboard/architect")
  }

  return (
    <main className="min-h-screen bg-background text-foreground font-sans">
      <div className="max-w-7xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Architect</h1>
          <p className="text-sm text-muted-foreground mt-1">Database schema, RLS policies, and AI-assisted architecture</p>
        </div>

        {/* Tabbed Layout */}
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-border bg-muted/40 flex gap-0">
            <a
              href="#schema"
              className="px-6 py-3 text-sm font-medium text-foreground border-b-2 border-primary hover:bg-muted/60 transition-colors cursor-pointer"
            >
              Schema Explorer
            </a>
            <a
              href="#context"
              className="px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              Database Context
            </a>
            <a
              href="#ai-assist"
              className="px-6 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              AI Assistant
            </a>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            <ArchitectClient />
          </div>
        </div>
      </div>
    </main>
  )
}

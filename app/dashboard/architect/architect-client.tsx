"use client"

import { useState } from "react"

type Column = {
  column_name: string
  data_type: string
  is_nullable: string
}

type TableSchema = {
  table_name: string
  columns: Column[]
}

type RLSPolicy = {
  table: string
  policyname: string
  cmd: string
  roles: string[]
  permissive: string
  qual: string | null
  with_check: string | null
}

type ContextData = {
  schema: TableSchema[]
  rls: RLSPolicy[]
  counts: Record<string, number>
}

function buildMarkdown(data: ContextData): string {
  const lines: string[] = []

  lines.push("# MAJHEVENTS Database Architect Context")
  lines.push(`\n_Generated: ${new Date().toISOString()}_\n`)

  // Schema
  lines.push("---")
  lines.push("## Schema\n")
  for (const table of data.schema ?? []) {
    lines.push(`### ${table.table_name}`)
    lines.push("| Column | Type | Nullable |")
    lines.push("|--------|------|----------|")
    for (const col of table.columns ?? []) {
      lines.push(`| ${col.column_name} | ${col.data_type} | ${col.is_nullable} |`)
    }
    lines.push("")
  }

  // RLS
  lines.push("---")
  lines.push("## RLS Policies\n")
  const grouped: Record<string, RLSPolicy[]> = {}
  for (const p of data.rls ?? []) {
    if (!grouped[p.table]) grouped[p.table] = []
    grouped[p.table].push(p)
  }
  for (const [table, policies] of Object.entries(grouped)) {
    lines.push(`### ${table}`)
    for (const p of policies) {
      lines.push(`- **${p.policyname}** (${p.cmd}, ${p.permissive}, roles: ${(p.roles ?? []).join(", ")})`)
      if (p.qual) lines.push(`  - USING: \`${p.qual}\``)
      if (p.with_check) lines.push(`  - WITH CHECK: \`${p.with_check}\``)
    }
    lines.push("")
  }

  // Counts
  lines.push("---")
  lines.push("## Row Counts\n")
  lines.push("| Table | Rows |")
  lines.push("|-------|------|")
  for (const [table, count] of Object.entries(data.counts ?? {}).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${table} | ${count === -1 ? "error" : count.toLocaleString()} |`)
  }

  return lines.join("\n")
}

export default function ArchitectClient() {
  const [data, setData] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"schema" | "rls" | "counts">("schema")

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: ["db.schema", "rls", "counts"] }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function copyMarkdown() {
    if (!data) return
    const md = buildMarkdown(data)
    await navigator.clipboard.writeText(md)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs = ["schema", "rls", "counts"] as const

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-foreground">Database Snapshot</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Schema, RLS policies, and row counts</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <button
              onClick={copyMarkdown}
              className="px-3 py-1.5 rounded text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {copied ? "Copied!" : "Copy as Markdown"}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Loading..." : data ? "Refresh" : "Load"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-3 py-2 rounded text-xs bg-destructive/10 border border-destructive/30 text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-xs text-muted-foreground">No snapshot loaded yet.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-xs text-muted-foreground">Querying database...</p>
        </div>
      )}

      {/* Data */}
      {data && (
        <div>
          {/* Summary */}
          <div className="flex items-center gap-4 mb-4 px-3 py-2 rounded text-xs bg-muted/40 border border-border">
            <span className="text-muted-foreground">
              <span className="text-foreground font-semibold">{data.schema?.length ?? 0}</span> tables
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-semibold">{data.rls?.length ?? 0}</span> policies
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "schema" ? "Schema" : tab === "rls" ? "RLS" : "Counts"}
              </button>
            ))}
          </div>

          {/* Schema tab */}
          {activeTab === "schema" && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(data.schema ?? []).map((table) => (
                <div key={table.table_name} className="rounded border border-border bg-muted/20 overflow-hidden text-xs">
                  <div className="px-2 py-1.5 border-b border-border bg-muted/40 font-mono font-semibold">
                    {table.table_name}
                    <span className="ml-2 font-normal text-muted-foreground">({table.columns?.length ?? 0})</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {(table.columns ?? []).map((col) => (
                          <tr key={col.column_name} className="border-t border-border hover:bg-muted/30">
                            <td className="px-2 py-1 font-mono text-foreground">{col.column_name}</td>
                            <td className="px-2 py-1 text-muted-foreground">{col.data_type}</td>
                            <td className="px-2 py-1 text-muted-foreground text-right w-12">{col.is_nullable}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* RLS tab */}
          {activeTab === "rls" && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(() => {
                const grouped: Record<string, RLSPolicy[]> = {}
                for (const p of data.rls ?? []) {
                  if (!grouped[p.table]) grouped[p.table] = []
                  grouped[p.table].push(p)
                }
                return Object.entries(grouped).map(([table, policies]) => (
                  <div key={table} className="rounded border border-border bg-muted/20 overflow-hidden">
                    <div className="px-2 py-1 border-b border-border bg-muted/40 font-mono text-xs font-semibold">
                      {table}
                    </div>
                    <div className="space-y-1 p-2">
                      {policies.map((p) => (
                        <div key={p.policyname} className="text-xs">
                          <div className="font-mono font-semibold text-foreground mb-0.5">{p.policyname}</div>
                          <div className="text-muted-foreground">
                            <span className="inline-block px-1 py-0.5 rounded text-xs bg-primary/20 text-primary mr-1">
                              {p.cmd}
                            </span>
                            {p.roles?.join(", ")}
                          </div>
                          {p.qual && (
                            <div className="mt-0.5 font-mono text-muted-foreground text-xs bg-background/50 px-1 py-0.5 rounded break-all">
                              {p.qual}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}

          {/* Counts tab */}
          {activeTab === "counts" && (
            <div className="rounded border border-border bg-muted/20 overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(data.counts ?? {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([table, count]) => (
                      <tr key={table} className="border-b border-border hover:bg-muted/30">
                        <td className="px-2 py-1 font-mono text-foreground">{table}</td>
                        <td className="px-2 py-1 text-right text-muted-foreground font-mono">
                          {count === -1 ? "error" : count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

export default function ArchitectPage() {
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
    <main className="min-h-screen bg-background text-foreground font-sans p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Database Architect</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Read-only schema, RLS, and row count snapshot</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <button
              onClick={copyMarkdown}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {copied ? "Copied!" : "Copy as Markdown"}
            </button>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Loading..." : data ? "Refresh" : "Load Snapshot"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-muted-foreground text-sm">No snapshot loaded.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Click &quot;Load Snapshot&quot; to fetch schema, RLS policies, and row counts.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <p className="text-muted-foreground text-sm">Querying database...</p>
        </div>
      )}

      {/* Data */}
      {data && (
        <div>
          {/* Summary bar */}
          <div className="flex items-center gap-6 mb-5 px-4 py-3 rounded-md bg-card border border-border text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground font-semibold">{data.schema?.length ?? 0}</span> tables
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-semibold">{data.rls?.length ?? 0}</span> policies
            </span>
            <span className="text-muted-foreground">
              <span className="text-foreground font-semibold">
                {Object.values(data.counts ?? {})
                  .filter((c) => c > 0)
                  .reduce((a, b) => a + b, 0)
                  .toLocaleString()}
              </span>{" "}
              total rows
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-border">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "schema" ? "Schema" : tab === "rls" ? "RLS Policies" : "Row Counts"}
              </button>
            ))}
          </div>

          {/* Schema tab */}
          {activeTab === "schema" && (
            <div className="space-y-4">
              {(data.schema ?? []).map((table) => (
                <div key={table.table_name} className="rounded-md border border-border bg-card overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-foreground">{table.table_name}</span>
                    <span className="text-xs text-muted-foreground">{table.columns?.length ?? 0} columns</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium w-1/3">Column</th>
                          <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium w-1/3">Type</th>
                          <th className="text-left px-4 py-2 text-xs text-muted-foreground font-medium">Nullable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(table.columns ?? []).map((col, i) => (
                          <tr key={col.column_name} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                            <td className="px-4 py-1.5 font-mono text-xs text-foreground">{col.column_name}</td>
                            <td className="px-4 py-1.5 font-mono text-xs text-muted-foreground">{col.data_type}</td>
                            <td className="px-4 py-1.5 text-xs text-muted-foreground">{col.is_nullable}</td>
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
            <div className="space-y-3">
              {(() => {
                const grouped: Record<string, RLSPolicy[]> = {}
                for (const p of data.rls ?? []) {
                  if (!grouped[p.table]) grouped[p.table] = []
                  grouped[p.table].push(p)
                }
                return Object.entries(grouped).map(([table, policies]) => (
                  <div key={table} className="rounded-md border border-border bg-card overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-foreground">{table}</span>
                      <span className="text-xs text-muted-foreground">
                        {policies.length} {policies.length === 1 ? "policy" : "policies"}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {policies.map((p) => (
                        <div key={p.policyname} className="px-4 py-3">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="font-mono text-xs font-semibold text-foreground">{p.policyname}</span>
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                p.cmd === "SELECT"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : p.cmd === "INSERT"
                                  ? "bg-green-500/20 text-green-400"
                                  : p.cmd === "UPDATE"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : p.cmd === "DELETE"
                                  ? "bg-destructive/20 text-destructive"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {p.cmd}
                            </span>
                            <span className="text-xs text-muted-foreground">{p.permissive}</span>
                            <span className="text-xs text-muted-foreground">
                              roles: {(p.roles ?? []).join(", ")}
                            </span>
                          </div>
                          {p.qual && (
                            <div className="mt-1 text-xs font-mono bg-muted/40 px-2 py-1 rounded text-muted-foreground break-all">
                              <span className="text-foreground/40 select-none">USING </span>
                              {p.qual}
                            </div>
                          )}
                          {p.with_check && (
                            <div className="mt-1 text-xs font-mono bg-muted/40 px-2 py-1 rounded text-muted-foreground break-all">
                              <span className="text-foreground/40 select-none">WITH CHECK </span>
                              {p.with_check}
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
            <div className="rounded-md border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Table</th>
                    <th className="text-right px-4 py-2.5 text-xs text-muted-foreground font-medium">Rows</th>
                    <th className="px-4 py-2.5 w-1/2" />
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.counts ?? {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([table, count], i) => {
                      const max = Math.max(...Object.values(data.counts ?? {}))
                      const pct = max > 0 && count > 0 ? (count / max) * 100 : 0
                      return (
                        <tr key={table} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                          <td className="px-4 py-2 font-mono text-xs text-foreground">{table}</td>
                          <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {count === -1 ? (
                              <span className="text-destructive">error</span>
                            ) : (
                              count.toLocaleString()
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

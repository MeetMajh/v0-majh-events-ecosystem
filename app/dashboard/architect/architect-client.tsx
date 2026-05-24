"use client"

import { useState, useEffect } from "react"

// ... (keep the types and helper functions the same as previous)
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

export default function ArchitectClient() {
  const [data, setData] = useState<ContextData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"schema" | "rls" | "counts">("schema")

  // Auto-load on mount
  useEffect(() => {
    load()
  }, [])

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

  const tabs = ["schema", "rls", "counts"] as const

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div>
          <h2 className="text-sm font-bold text-foreground">Live Snapshot</h2>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Syncing..." : "Sync DB"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-4 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "schema" ? "Schema" : tab === "rls" ? "RLS Policies" : "Row Counts"}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 px-3 py-2 rounded text-xs bg-destructive/10 border border-destructive/30 text-destructive">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
            <p className="text-xs">Querying Postgres...</p>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Schema tab */}
            {activeTab === "schema" && (
              <div className="space-y-3">
                {(data.schema ?? []).map((table) => (
                  <div key={table.table_name} className="rounded border border-border bg-muted/10 overflow-hidden text-xs">
                    <div className="px-2 py-1.5 border-b border-border bg-muted/40 font-mono font-semibold flex justify-between">
                      <span>{table.table_name}</span>
                      <span className="font-normal text-muted-foreground">{table.columns?.length ?? 0} cols</span>
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
              <div className="space-y-2">
                {(() => {
                  const grouped: Record<string, RLSPolicy[]> = {}
                  for (const p of data.rls ?? []) {
                    if (!grouped[p.table]) grouped[p.table] = []
                    grouped[p.table].push(p)
                  }
                  return Object.entries(grouped).map(([table, policies]) => (
                    <div key={table} className="rounded border border-border bg-muted/10 overflow-hidden">
                      <div className="px-2 py-1 border-b border-border bg-muted/40 font-mono text-xs font-semibold">
                        {table}
                      </div>
                      <div className="space-y-1 p-2">
                        {policies.map((p) => (
                          <div key={p.policyname} className="text-xs border-b border-border/50 last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                            <div className="font-mono font-semibold text-foreground mb-0.5">{p.policyname}</div>
                            <div className="text-muted-foreground">
                              <span className="inline-block px-1 py-0.5 rounded text-[10px] bg-primary/20 text-primary mr-1">
                                {p.cmd}
                              </span>
                              {p.roles?.join(", ")}
                            </div>
                            {p.qual && (
                              <div className="mt-1 font-mono text-muted-foreground text-[10px] bg-background px-1 py-1 rounded break-all border border-border/50">
                                USING: {p.qual}
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
              <div className="rounded border border-border bg-muted/10 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody>
                    {Object.entries(data.counts ?? {})
                      .sort((a, b) => b[1] - a[1])
                      .map(([table, count]) => (
                        <tr key={table} className="border-b border-border hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono text-foreground">{table}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground font-mono">
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
    </div>
  )
}

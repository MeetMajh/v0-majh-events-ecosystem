import { NextResponse } from "next/server"
import { getSchema, getRLS } from "@/lib/supabase/introspection"
import { createClient } from "@supabase/supabase-js"
import { requireAdmin } from "@/lib/auth/require-admin"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if ("error" in auth) return auth.error

  try {
    const { scope } = await req.json()
    const response: Record<string, unknown> = {}

    // Schema: normalize to client's expected shape (table_name, columns[].column_name, etc.)
    let schemaForCounts: any[] = []
    if (scope?.includes("db.schema") || scope?.includes("counts")) {
      const rawSchema = await getSchema()
      schemaForCounts = Array.isArray(rawSchema) ? rawSchema : []

      if (scope?.includes("db.schema")) {
        response.schema = schemaForCounts.map((t: any) => ({
          table_name: t.table,
          columns: (t.columns ?? []).map((c: any) => ({
            column_name: c.name,
            data_type: c.type,
            is_nullable: c.nullable,
          })),
        }))
      }
    }

    // RLS: normalize to client's expected shape
    if (scope?.includes("rls")) {
      const raw = await getRLS()
      response.rls = (raw ?? []).map((p: any) => ({
        table: p.tablename,
        policyname: p.policyname,
        cmd: p.cmd,
        roles: p.roles ?? [],
        permissive: p.permissive,
        qual: p.qual,
        with_check: p.with_check,
      }))
    }

    // Counts: query each table individually
    if (scope?.includes("counts")) {
      const tableNames = schemaForCounts
        .map((t: any) => t.table)
        .filter((name: any) => typeof name === "string" && name.length > 0)

      const counts: Record<string, number> = {}
      await Promise.all(
        tableNames.map(async (table: string) => {
          try {
            const { count, error } = await supabaseAdmin
              .from(table)
              .select("*", { count: "exact", head: true })
            counts[table] = error ? -1 : (count ?? 0)
          } catch {
            counts[table] = -1
          }
        })
      )
      response.counts = counts
    }

    return NextResponse.json(response)
  } catch (err: any) {
    console.error("[/api/ai/context] error:", err)
    return NextResponse.json(
      { error: err?.message ?? "Context fetch failed" },
      { status: 500 }
    )
  }
}

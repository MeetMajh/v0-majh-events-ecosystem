// app/api/ai/run/route.ts
import { NextResponse } from "next/server";
import { getSchema, getRLS, getTableCounts } from "@/lib/supabase/introspection";
import { requireAdmin } from "@/lib/auth/require-admin";

function buildSchemaDNA(schema: any[]) {
  if (!Array.isArray(schema)) return { tables: 0, summary: "Schema not available" };
  return {
    tables: schema.length,
    tableNames: schema.map((t: any) => t.table).sort(),
    totalColumns: schema.reduce(
      (sum: number, t: any) => sum + (t.columns?.length ?? 0),
      0
    ),
  };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const { task } = await req.json();
    const taskLower = (task ?? "").toLowerCase();

    const wantsSchema = !task || taskLower.includes("schema") || taskLower.includes("table");
    const wantsRLS = taskLower.includes("rls") || taskLower.includes("polic") || taskLower.includes("security");
    const wantsCounts = taskLower.includes("count") || taskLower.includes("rows");
    const fetchAll = !wantsSchema && !wantsRLS && !wantsCounts;

    const result: Record<string, unknown> = {
      task: task ?? "(empty)",
      timestamp: new Date().toISOString(),
      user: auth.user.email,
    };

    if (wantsSchema || fetchAll) {
      const schema = await getSchema();
      result.schema = schema;
      result.schemaDNA = buildSchemaDNA(schema as any[]);
    }

    if (wantsRLS || fetchAll) {
      result.rls = await getRLS();
    }

    if (wantsCounts || fetchAll) {
      result.counts = await getTableCounts();
    }

    return NextResponse.json({ result });
  } catch (err: any) {
    console.error("[/api/ai/run] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Architect run failed" },
      { status: 500 }
    );
  }
}

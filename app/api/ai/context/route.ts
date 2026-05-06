import { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const { scope } = await req.json();

  const response: any = {};

  if (scope.includes("db.schema")) {
    response.schema = await getSchema();
  }

  if (scope.includes("rls")) {
    const raw = await getRLS();
    response.rls = raw.map((p: any) => ({
      table: p.tablename,
      policyname: p.policyname,
      cmd: p.cmd,
      roles: p.roles,
      permissive: p.permissive,
      qual: p.qual,
      with_check: p.with_check,
    }));
  }

  if (scope.includes("counts")) {
    const schema = response.schema ?? await getSchema();
    const tableNames: string[] = schema.map((t: any) => t.table_name);

    const counts: Record<string, number> = {};
    await Promise.all(
      tableNames.map(async (table) => {
        const { count, error } = await supabaseAdmin
          .from(table)
          .select("*", { count: "exact", head: true });
        counts[table] = error ? -1 : (count ?? 0);
      })
    );
    response.counts = counts;
  }

  return NextResponse.json(response);
}

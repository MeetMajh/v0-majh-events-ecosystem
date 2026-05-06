import { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { scope } = await req.json();
  const response: Record<string, unknown> = {};

  if (scope?.includes("db.schema")) {
    response.schema = await getSchema();
  }

  if (scope?.includes("rls")) {
    const raw = await getRLS();
    response.rls = (raw ?? []).map((p: any) => ({
      table: p.tablename,
      policy: p.policyname,
      command: p.cmd,
      rule: p.qual?.includes("auth.uid()")
        ? "User owns this data"
        : "Custom policy",
    }));
  }

  return NextResponse.json(response);
}

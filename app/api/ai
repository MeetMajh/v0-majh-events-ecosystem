import { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";

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
      rule: p.qual?.includes("auth.uid()")
        ? "User owns this data"
        : "Custom policy"
    }));
  }

  return NextResponse.json(response);
}

import { NextResponse } from "next/server";
import { getSchema, getRLS } from "@/lib/supabase/introspection";

export async function POST(req: Request) {
  const { type } = await req.json();

  if (type === "schema") {
    const schema = await getSchema();
    return NextResponse.json({ schema });
  }

  if (type === "rls") {
    const rls = await getRLS();
    return NextResponse.json({ rls });
  }

  return NextResponse.json({ error: "Invalid type" });
}

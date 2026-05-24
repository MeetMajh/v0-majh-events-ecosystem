import { NextResponse } from "next/server"
import { getSchema, getRLS } from "@/lib/supabase/introspection"

export const dynamic = 'force-dynamic';

export async function GET() {
  const rls = await getRLS();
  return NextResponse.json({ rls });
}

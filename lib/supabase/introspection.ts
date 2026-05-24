// lib/supabase/introspection.ts
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function getSchema() {
  const { data, error } = await supabaseAdmin.rpc("introspect_schema");
  if (error) {
    console.error("[introspection] getSchema failed:", error);
    throw new Error(`Schema introspection failed: ${error.message}`);
  }
  return data ?? [];
}

export async function getRLS() {
  const { data, error } = await supabaseAdmin.rpc("introspect_rls");
  if (error) {
    console.error("[introspection] getRLS failed:", error);
    throw new Error(`RLS introspection failed: ${error.message}`);
  }
  return data ?? [];
}

export async function getTableCounts() {
  const { data, error } = await supabaseAdmin.rpc("introspect_counts");
  if (error) {
    console.error("[introspection] getTableCounts failed:", error);
    throw new Error(`Counts introspection failed: ${error.message}`);
  }
  return data ?? {};
}

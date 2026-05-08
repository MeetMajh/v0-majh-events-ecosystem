import { supabase } from "@/lib/supabase/client";

export async function getSchema() {
  const { data } = await supabase.rpc("get_schema");
  return data;
}

export async function getRLS() {
  const { data } = await supabase.rpc("get_rls_policies");
  return data;
}
// /lib/supabase/introspection.ts

import { createClient } from "@supabase/supabase-js";

// ⚠️ Make sure these exist in Vercel env
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Get full schema
export async function getSchema() {
  const { data, error } = await supabase.rpc("get_full_schema");

  if (error) {
    console.error("Schema error:", error);
    return [];
  }

  return data || [];
}

// Get RLS policies
export async function getRLS() {
  const { data, error } = await supabase.rpc("get_full_rls");

  if (error) {
    console.error("RLS error:", error);
    return [];
  }

  return data || [];
}

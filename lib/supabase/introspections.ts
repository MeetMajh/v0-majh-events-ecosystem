import { supabase } from "@/lib/supabase/client";

export async function getSchema() {
  const { data } = await supabase.rpc("get_schema");
  return data;
}

export async function getRLS() {
  const { data } = await supabase.rpc("get_rls_policies");
  return data;
}

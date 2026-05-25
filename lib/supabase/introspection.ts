// lib/supabase/introspection.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization to avoid build-time errors when env vars are not available
let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Return null during build time when env vars are not available
    if (!url || !key) {
      return null;
    }
    
    supabaseAdmin = createClient(url, key);
  }
  return supabaseAdmin;
}

export async function getSchema() {
  const client = getSupabaseAdmin();
  if (!client) {
    console.warn("[introspection] Supabase not configured, returning empty schema");
    return [];
  }
  
  const { data, error } = await client.rpc("introspect_schema");
  if (error) {
    console.error("[introspection] getSchema failed:", error);
    throw new Error(`Schema introspection failed: ${error.message}`);
  }
  return data ?? [];
}

export async function getRLS() {
  const client = getSupabaseAdmin();
  if (!client) {
    console.warn("[introspection] Supabase not configured, returning empty RLS");
    return [];
  }
  
  const { data, error } = await client.rpc("introspect_rls");
  if (error) {
    console.error("[introspection] getRLS failed:", error);
    throw new Error(`RLS introspection failed: ${error.message}`);
  }
  return data ?? [];
}

export async function getTableCounts() {
  const client = getSupabaseAdmin();
  if (!client) {
    console.warn("[introspection] Supabase not configured, returning empty counts");
    return {};
  }
  
  const { data, error } = await client.rpc("introspect_counts");
  if (error) {
    console.error("[introspection] getTableCounts failed:", error);
    throw new Error(`Counts introspection failed: ${error.message}`);
  }
  return data ?? {};
}

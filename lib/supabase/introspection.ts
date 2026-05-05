import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getSchema() {
  const { data, error } = await supabaseAdmin.rpc("get_schema_info")
  
  if (error) {
    // Fallback: query information_schema directly
    const { data: tables } = await supabaseAdmin
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_type", "BASE TABLE")
    
    if (!tables) return []
    
    const schema = await Promise.all(
      tables.map(async (t: { table_name: string }) => {
        const { data: columns } = await supabaseAdmin
          .from("information_schema.columns")
          .select("column_name, data_type, is_nullable")
          .eq("table_schema", "public")
          .eq("table_name", t.table_name)
        
        return {
          table_name: t.table_name,
          columns: columns || []
        }
      })
    )
    
    return schema
  }
  
  return data || []
}

export async function getRLS() {
  const { data, error } = await supabaseAdmin.rpc("get_rls_policies")
  
  if (error) {
    // Fallback: query pg_policies directly
    const { data: policies } = await supabaseAdmin
      .from("pg_policies")
      .select("tablename, policyname, permissive, roles, cmd, qual, with_check")
    
    return policies || []
  }
  
  return data || []
}

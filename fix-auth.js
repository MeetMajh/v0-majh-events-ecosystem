const { createClient } = require('@supabase/supabase-js');
const url = 'https://incmgtdfabzesatzbziz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluY21ndGRmYWJ6ZXNhdHpieml6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY2MTQyMCwiZXhwIjoyMDg4MjM3NDIwfQ.pKnxFdTnp01zmWbyuUWyIjCqyCIObfCu1LREao8OySY';
const supabase = createClient(url, key);

async function run() {
  const { data } = await supabase.rpc('get_policies', { table_name: 'organization_members' });
  console.log(data);
  // We can query pg_policies using service role
  const { data: policies } = await supabase.from('pg_policies').select('*').eq('tablename', 'organization_members');
  console.log("Policies:", policies);
}
run();

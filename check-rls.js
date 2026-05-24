const { createClient } = require('@supabase/supabase-js');
const url = 'https://incmgtdfabzesatzbziz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY2MTQyMCwiZXhwIjoyMDg4MjM3NDIwfQ.pKnxFdTnp01zmWbyuUWyIjCqyCIObfCu1LREao8OySY';
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase.rpc('query_exec', { query: "SELECT policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'organization_members';" });
  console.log(error || data);
}
run();

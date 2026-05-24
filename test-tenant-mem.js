const { createClient } = require('@supabase/supabase-js');
const url = 'https://incmgtdfabzesatzbziz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluY21ndGRmYWJ6ZXNhdHpieml6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY2MTQyMCwiZXhwIjoyMDg4MjM3NDIwfQ.pKnxFdTnp01zmWbyuUWyIjCqyCIObfCu1LREao8OySY';
const supabase = createClient(url, key);

async function run() {
  const { data } = await supabase.from('tenant_memberships').select('*').eq('user_id', '69d91884-a1ca-415a-b96d-2fcda4ff6d78');
  console.log("Tenant memberships:", data);
}
run();

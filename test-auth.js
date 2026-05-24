const { createClient } = require('@supabase/supabase-js');
const url = 'https://incmgtdfabzesatzbziz.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImluY21ndGRmYWJ6ZXNhdHpieml6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjE0MjAsImV4cCI6MjA4ODIzNzQyMH0.lSJ-0vNpQV7MxtoxYZ_nFZqtan-zzW9kY2vxToGBroQ';
const supabase = createClient(url, anonKey);

async function run() {
  // Try to sign in as malchijahharding@gmail.com
  // I don't have the password, so I cannot easily simulate the RLS.
  console.log("No password, can't simulate");
}
run();

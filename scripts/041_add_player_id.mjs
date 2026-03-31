import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrate() {
  console.log("Starting migration: Add player_id column to tournament_registrations")

  // Step 1: Add player_id column if it doesn't exist
  const { error: alterError } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE tournament_registrations 
      ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES profiles(id);
    `
  })

  if (alterError) {
    // Try direct SQL via REST if RPC doesn't work
    console.log("RPC failed, column may already exist or needs manual addition")
    console.log("Error:", alterError.message)
  } else {
    console.log("Added player_id column")
  }

  // Step 2: Backfill player_id from user_id for existing records
  const { data: regs, error: fetchError } = await supabase
    .from("tournament_registrations")
    .select("id, user_id, player_id")
    .is("player_id", null)

  if (fetchError) {
    console.log("Error fetching registrations:", fetchError.message)
    return
  }

  console.log(`Found ${regs?.length || 0} registrations to backfill`)

  for (const reg of regs || []) {
    if (reg.user_id && !reg.player_id) {
      const { error: updateError } = await supabase
        .from("tournament_registrations")
        .update({ player_id: reg.user_id })
        .eq("id", reg.id)

      if (updateError) {
        console.log(`Failed to update registration ${reg.id}:`, updateError.message)
      } else {
        console.log(`Updated registration ${reg.id}: player_id = ${reg.user_id}`)
      }
    }
  }

  console.log("Migration complete!")
}

migrate().catch(console.error)

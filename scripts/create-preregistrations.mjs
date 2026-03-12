import pg from 'pg'

const { Client } = pg

async function createPreregistrationsTable() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
  })

  try {
    await client.connect()
    console.log('Connected to database')

    // Create tournament_preregistrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tournament_preregistrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        player_id UUID REFERENCES auth.users(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired', 'cancelled')),
        invited_by UUID REFERENCES auth.users(id),
        claimed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tournament_id, email)
      );
    `)
    console.log('Created tournament_preregistrations table')

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_preregistrations_tournament ON tournament_preregistrations(tournament_id);
      CREATE INDEX IF NOT EXISTS idx_preregistrations_email ON tournament_preregistrations(email);
      CREATE INDEX IF NOT EXISTS idx_preregistrations_status ON tournament_preregistrations(status);
    `)
    console.log('Created indexes')

    // Enable RLS
    await client.query(`ALTER TABLE tournament_preregistrations ENABLE ROW LEVEL SECURITY;`)
    console.log('Enabled RLS')

    // Drop existing policies if they exist and create new ones
    await client.query(`DROP POLICY IF EXISTS "Staff can manage preregistrations" ON tournament_preregistrations;`)
    await client.query(`
      CREATE POLICY "Staff can manage preregistrations" ON tournament_preregistrations 
        FOR ALL USING (
          EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
        );
    `)
    console.log('Created staff policy')

    await client.query(`DROP POLICY IF EXISTS "Users can view own preregistrations" ON tournament_preregistrations;`)
    await client.query(`
      CREATE POLICY "Users can view own preregistrations" ON tournament_preregistrations 
        FOR SELECT USING (
          email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
          player_id = auth.uid()
        );
    `)
    console.log('Created user policy')

    console.log('Migration complete!')
  } catch (error) {
    console.error('Migration error:', error)
    throw error
  } finally {
    await client.end()
  }
}

createPreregistrationsTable()

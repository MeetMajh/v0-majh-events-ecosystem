import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const { createAdminClient } = await import("@/lib/supabase/server")
    const adminClient = createAdminClient()
    
    // Create the tournament_announcements table
    const { error } = await adminClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS tournament_announcements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
          message TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
          created_by UUID REFERENCES auth.users(id),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_announcements_tournament ON tournament_announcements(tournament_id);
        CREATE INDEX IF NOT EXISTS idx_announcements_created ON tournament_announcements(created_at DESC);

        ALTER TABLE tournament_announcements ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "Anyone can view announcements" ON tournament_announcements;
        CREATE POLICY "Anyone can view announcements" ON tournament_announcements 
          FOR SELECT USING (true);

        DROP POLICY IF EXISTS "Staff can create announcements" ON tournament_announcements;
        CREATE POLICY "Staff can create announcements" ON tournament_announcements 
          FOR INSERT WITH CHECK (
            EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
          );

        DROP POLICY IF EXISTS "Staff can delete announcements" ON tournament_announcements;
        CREATE POLICY "Staff can delete announcements" ON tournament_announcements 
          FOR DELETE USING (
            EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
          );
      `
    })

    if (error) {
      // Try creating table directly via insert attempt
      const supabase = await createClient()
      
      // Test if table exists by trying to select from it
      const { error: testError } = await supabase
        .from("tournament_announcements")
        .select("id")
        .limit(1)
      
      if (testError && testError.code === "42P01") {
        return NextResponse.json({ 
          error: "Table does not exist. Please create it via Supabase dashboard.",
          sql: `
CREATE TABLE tournament_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_tournament ON tournament_announcements(tournament_id);
ALTER TABLE tournament_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view announcements" ON tournament_announcements FOR SELECT USING (true);
CREATE POLICY "Staff can manage announcements" ON tournament_announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM staff_roles WHERE user_id = auth.uid() AND role IN ('owner', 'manager', 'organizer'))
);
          `
        }, { status: 400 })
      }
      
      return NextResponse.json({ message: "Table already exists" })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

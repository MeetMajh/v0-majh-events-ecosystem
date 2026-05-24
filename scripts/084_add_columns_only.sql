-- Add missing columns to existing tables
-- Run this in Supabase SQL Editor if automatic execution fails

ALTER TABLE player_media ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

ALTER TABLE cb_staff_shifts ADD COLUMN IF NOT EXISTS location TEXT;

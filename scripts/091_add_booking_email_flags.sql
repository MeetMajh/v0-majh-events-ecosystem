-- Add email tracking columns to cb_bookings table
-- These columns track whether reminder and follow-up emails have been sent

ALTER TABLE cb_bookings 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS followup_sent BOOLEAN DEFAULT FALSE;

-- Add index for efficient cron job queries
CREATE INDEX IF NOT EXISTS idx_cb_bookings_reminder 
ON cb_bookings(event_date, status, reminder_sent) 
WHERE reminder_sent = FALSE;

CREATE INDEX IF NOT EXISTS idx_cb_bookings_followup 
ON cb_bookings(event_date, status, followup_sent) 
WHERE followup_sent = FALSE;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'cb_bookings' 
AND column_name IN ('reminder_sent', 'followup_sent');

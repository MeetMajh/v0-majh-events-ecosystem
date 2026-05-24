# SQL for Clip View Tracking System

Run these SQL commands in Supabase SQL Editor to ensure view tracking works properly:

## Step 1: Ensure player_media has view_count column

```sql
-- Verify view_count column exists and is properly typed
ALTER TABLE player_media ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Create index for fastest view count queries
CREATE INDEX IF NOT EXISTS idx_player_media_view_count 
  ON player_media(view_count DESC)
  WHERE view_count > 0;
```

## Step 2: Create trigger to auto-update updated_at timestamp

```sql
-- Create function for timestamp update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on player_media
DROP TRIGGER IF EXISTS update_player_media_updated_at ON player_media;
CREATE TRIGGER update_player_media_updated_at
BEFORE UPDATE ON player_media
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Step 3: Set up RLS for view tracking

```sql
-- Allow anyone to increment views on public clips
DROP POLICY IF EXISTS "Anyone can increment clip views" ON player_media;
CREATE POLICY "Anyone can increment clip views" ON player_media
  FOR UPDATE USING (visibility = 'public' AND moderation_status = 'approved')
  WITH CHECK (visibility = 'public' AND moderation_status = 'approved');
```

## Step 4: Verify setup with test queries

```sql
-- Check view_count column exists
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_name = 'player_media' 
  AND column_name IN ('view_count', 'views')
ORDER BY column_name;

-- Check indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'player_media'
  AND indexname LIKE '%view%'
ORDER BY indexname;

-- Check current clips with view counts
SELECT 
  id,
  title,
  view_count,
  visibility,
  moderation_status,
  created_at
FROM player_media
WHERE visibility = 'public'
  AND moderation_status = 'approved'
ORDER BY view_count DESC, created_at DESC
LIMIT 10;
```

## Expected Results

After running this SQL:
- ✅ `view_count` column exists and defaults to 0
- ✅ Index created for fast view count queries
- ✅ Auto-timestamp function active
- ✅ RLS policy allows public view increments
- ✅ Current clips queryable with real view counts

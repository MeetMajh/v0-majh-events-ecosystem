# SQL SETUP - VOD SYSTEM

## RUN THESE COMMANDS IN SUPABASE SQL EDITOR (In Order)

---

## STEP 1: Verify Columns Exist
Copy and paste each separately. All should show "1 row" (the column exists).

```sql
-- Check mux_playback_id exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_streams' AND column_name = 'mux_playback_id';
```

```sql
-- Check playback_url exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_streams' AND column_name = 'playback_url';
```

```sql
-- Check is_live exists on stream_sources
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'stream_sources' AND column_name = 'is_live';
```

**Expected Result:** All three queries return 1 row each ✅

---

## STEP 2: Verify RLS Policies Exist

Run this verification query:

```sql
SELECT schemaname, tablename, policyname, qual 
FROM pg_policies 
WHERE tablename IN ('user_streams', 'stream_sources')
ORDER BY tablename, policyname;
```

**Expected Result:** You should see these policies:

### user_streams policies (6 total):
- Users can create own streams
- Users can delete own streams
- Users can update own streams
- Users can view own streams
- Public can view ended streams
- Public can view live streams

### stream_sources policies (3 total):
- Only admins can insert stream sources
- Only admins can update stream sources
- Public can view all stream sources

---

## STEP 3: If Any Policies Are MISSING - Run These

**If "Public can view ended streams" is MISSING:**
```sql
DROP POLICY IF EXISTS "Public can view ended streams" ON user_streams;
CREATE POLICY "Public can view ended streams" ON user_streams
  FOR SELECT USING (status = 'ended' AND is_public = true);
```

**If "Only admins can update stream sources" is MISSING:**
```sql
DROP POLICY IF EXISTS "Only admins can update stream sources" ON stream_sources;
CREATE POLICY "Only admins can update stream sources" ON stream_sources
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' OR role = 'staff'
    )
  );
```

**If "Only admins can insert stream sources" is MISSING:**
```sql
DROP POLICY IF EXISTS "Only admins can insert stream sources" ON stream_sources;
CREATE POLICY "Only admins can insert stream sources" ON stream_sources
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' OR role = 'staff'
    )
  );
```

**If "Public can view all stream sources" is MISSING:**
```sql
DROP POLICY IF EXISTS "Public can view all stream sources" ON stream_sources;
DROP POLICY IF EXISTS "Anyone can view active stream sources" ON stream_sources;
CREATE POLICY "Public can view all stream sources" ON stream_sources
  FOR SELECT USING (true);
```

---

## STEP 4: Enable RLS on Tables (If Not Already Enabled)

```sql
-- Enable RLS on user_streams
ALTER TABLE user_streams ENABLE ROW LEVEL SECURITY;
```

```sql
-- Enable RLS on stream_sources
ALTER TABLE stream_sources ENABLE ROW LEVEL SECURITY;
```

---

## STEP 5: Verify Everything Works

Run this test query to confirm access:

```sql
-- This should show all live public streams
SELECT id, title, status FROM user_streams 
WHERE status = 'live' AND is_public = true
LIMIT 5;
```

```sql
-- This should show all stream sources
SELECT id, title, is_live FROM stream_sources
LIMIT 5;
```

---

## STEP 6: Final Verification Query

Run this comprehensive check:

```sql
SELECT 
  'user_streams' as table_name,
  'mux_playback_id' as column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_streams' AND column_name IN ('mux_playback_id', 'playback_url')
UNION ALL
SELECT 
  'stream_sources' as table_name,
  'is_live' as column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'stream_sources' AND column_name = 'is_live';
```

**Expected Result:**
```
table_name      | column_name      | data_type | is_nullable
user_streams    | mux_playback_id  | text      | YES
user_streams    | playback_url     | text      | YES
stream_sources  | is_live          | boolean   | YES
```

---

## ALL DONE ✅

If all verification queries pass, the backend is fully connected and ready to use:
- endStream() will save VOD metadata ✅
- /dashboard/recordings will load user VODs ✅
- /live/vods will show public VODs ✅
- Admin can toggle stream sources live/offline ✅


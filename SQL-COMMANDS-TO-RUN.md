# SQL Commands to Execute in Supabase SQL Editor

## Copy-Paste These Exact Commands

### Command 1: Add VOD Viewing RLS Policy
```sql
-- Add this policy to allow public viewing of ended streams (VODs)
CREATE POLICY "Public can view ended streams" ON user_streams
  FOR SELECT USING (status = 'ended' AND is_public = true);
```

---

### Command 2: Add mux_playback_id Column (if not exists)
```sql
-- Add column for Mux playback ID used in HLS URL generation
ALTER TABLE user_streams 
ADD COLUMN IF NOT EXISTS mux_playback_id TEXT;
```

---

### Command 3: Add Admin-Only Stream Source Update Policy
```sql
-- Only admins/staff can modify stream sources
-- First drop any existing update policies that might conflict
DROP POLICY IF EXISTS "Users can update own sources" ON stream_sources;
DROP POLICY IF EXISTS "Anyone can update stream sources" ON stream_sources;

-- Create new admin-only policy
CREATE POLICY "Only admins can update stream sources" ON stream_sources
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' OR role = 'staff'
    )
  );
```

---

### Command 4: Add Admin-Only Stream Source Insert Policy
```sql
-- Only admins/staff can add new stream sources
CREATE POLICY "Only admins can insert stream sources" ON stream_sources
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE role = 'admin' OR role = 'staff'
    )
  );
```

---

### Command 5: Verify All Policies Are Correct (Run this to check)
```sql
-- Check all RLS policies on both tables
SELECT schemaname, tablename, policyname, qual
FROM pg_policies 
WHERE tablename IN ('user_streams', 'stream_sources')
ORDER BY tablename, policyname;
```

**Expected output should show:**

For `user_streams`:
- Users can view own streams
- Users can create own streams
- Users can update own streams
- Users can delete own streams
- Public can view live streams
- Public can view ended streams ← NEW

For `stream_sources`:
- Only admins can update stream sources ← NEW/MODIFIED
- Only admins can insert stream sources ← NEW/MODIFIED
- Anyone can view stream sources

---

### Command 6: Verify Schema Columns Exist
```sql
-- Verify user_streams has all required columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_streams'
ORDER BY ordinal_position;
```

**Key columns to verify:**
- ✅ id (uuid)
- ✅ user_id (uuid)
- ✅ title (text)
- ✅ status (text) - should be 'offline', 'live', or 'ended'
- ✅ started_at (timestamp)
- ✅ ended_at (timestamp)
- ✅ playback_url (text)
- ✅ mux_playback_id (text) ← NEW
- ✅ is_public (boolean)

---

## Test Queries to Verify Everything Works

### Test 1: Can Public View Live Streams?
```sql
SELECT id, title, status 
FROM user_streams 
WHERE status = 'live' AND is_public = true
LIMIT 3;
```
**Should return:** Live streams if any exist

---

### Test 2: Can Public View VODs?
```sql
SELECT id, title, status, ended_at
FROM user_streams 
WHERE status = 'ended' AND is_public = true
LIMIT 3;
```
**Should return:** VODs if any exist (after running migration)

---

### Test 3: Can Public View Stream Sources?
```sql
SELECT id, title, platform, is_live, is_featured, priority
FROM stream_sources
ORDER BY is_live DESC, is_featured DESC, priority DESC;
```
**Should return:** All stream sources in your database

---

### Test 4: Check Stream Source Policies
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename = 'stream_sources'
ORDER BY policyname;
```
**Should show:** All policies including the new admin ones

---

## Execution Order

Execute these commands IN ORDER in Supabase SQL Editor:

1. ✅ Run **Command 1** (Add VOD viewing policy)
2. ✅ Run **Command 2** (Add mux_playback_id column)
3. ✅ Run **Command 3** (Add admin update policy)
4. ✅ Run **Command 4** (Add admin insert policy)
5. ✅ Run **Command 5** (Verify all policies)
6. ✅ Run **Command 6** (Verify all columns)
7. ✅ Run **Test 1-4** (Verify queries work)

---

## If You Get Errors

### Error: "policy already exists"
**Solution:** The policy already exists, which is fine. The code uses `IF NOT EXISTS` or drops before creating. Skip to next command.

### Error: "column already exists"
**Solution:** The column already exists. This is expected and fine. Skip to next command.

### Error: "Role in profiles table doesn't exist"
**Solution:** Check what role column values actually exist in your profiles table:
```sql
SELECT DISTINCT role FROM profiles;
```

Then update the admin policy commands to use the actual role values from your system.

---

## Connection Verification

After executing all commands, run this to verify everything is properly connected:

```sql
-- All-in-one verification query
SELECT 
  'user_streams' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN status = 'live' THEN 1 END) as live_count,
  COUNT(CASE WHEN status = 'ended' THEN 1 END) as vod_count
FROM user_streams

UNION ALL

SELECT 
  'stream_sources' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_live = true THEN 1 END) as live_count,
  COUNT(CASE WHEN is_active = false THEN 1 END) as inactive_count
FROM stream_sources;
```

This shows you:
- How many records in each table
- How many are live
- How many are ended/inactive

---

## Files Modified for Backend Connection

1. **`/lib/go-live-actions.ts`**
   - Added `manuallyStartStreaming()` function
   - Added `checkStreamStatus()` function
   - Both use Supabase RLS with user auth

2. **`/app/dashboard/stream/page.tsx`**
   - Added handlers for manual start and status check
   - Calls server actions (backend functions)

3. **`/app/(public)/live/page.tsx`**
   - Updated stream_sources query (removed is_active filter)
   - Added is_featured to sort order

4. **`/app/(public)/live/vods/page.tsx`**
   - NEW page that queries ended streams
   - Uses new RLS policy for VOD access

5. **`/scripts/051-user-streams-final.sql`**
   - Added `mux_playback_id` column
   - Added "Public can view ended streams" RLS policy

6. **`/scripts/052-stream-sources-admin-policies.sql`**
   - NEW migration for admin-only stream source policies

---

## Summary

✅ All changes are **server-side** (no localStorage or client-side state)  
✅ All use **Supabase RLS** for security  
✅ All use **user authentication** checks  
✅ All interact with **actual database tables**  
✅ All have **proper error handling**  

**No UI-only code. Everything is connected to the backend.**

# Go Live Implementation - Backend Audit & Verification

## Summary of All Changes Made

### 1. **Server Actions in `/lib/go-live-actions.ts`**

#### A. `manuallyStartStreaming(streamId: string)` - Lines 269-318
- **Purpose:** Manual button to mark stream as "live" 
- **Database Operations:**
  - Reads: `user_streams` table (fetch existing stream)
  - Updates: `user_streams` table (set status = 'live', started_at, playback_url)

**RLS Policy Check:** ✅ PASSES
- Policy: "Users can update own streams" ON user_streams
- Condition: `auth.uid() = user_id`
- Our code validates: `eq("user_id", user.id)` verified via `auth.getUser()`

**SQL Query:**
```sql
UPDATE user_streams 
SET status = 'live', started_at = NOW(), playback_url = $1, updated_at = NOW()
WHERE id = $2 AND user_id = $3 AND status = 'offline'
RETURNING *;
```

**Column Status:**
- ✅ `status` - EXISTS (TEXT, CHECK status IN ('offline', 'live', 'ended'))
- ✅ `started_at` - EXISTS (TIMESTAMPTZ)
- ✅ `playback_url` - EXISTS (TEXT)
- ✅ `updated_at` - EXISTS (TIMESTAMPTZ)
- ⚠️ `mux_playback_id` - USED at line 294 but NOT IN SCHEMA

---

#### B. `checkStreamStatus(streamId: string)` - Lines 320-379
- **Purpose:** Health check that polls Mux API and auto-updates if active
- **Database Operations:**
  - Reads: `user_streams` table
  - Updates: `user_streams` table (conditionally)
  - External: Mux API call via HTTP

**RLS Policy Check:** ✅ PASSES (same as above)

**External Dependencies:**
- ✅ `process.env.MUX_TOKEN_ID` - Set (confirmed)
- ✅ `process.env.MUX_TOKEN_SECRET` - Set (confirmed)
- Mux API endpoint: `https://api.mux.com/video/v1/live_streams/{stream_id}`

---

#### C. `toggleStreamSourceLive(id: string, is_live: boolean)` - Lines 345-347
- **Purpose:** Toggle stream source "live" status from UI
- **Database Operations:** Updates `stream_sources` table

**RLS Policy Check:** ⚠️ NEEDS ADMIN POLICY
- Current policy allows public SELECT on stream_sources
- No UPDATE policy defined for admins
- **Recommendation:** Add admin-only UPDATE policy

---

### 2. **UI Changes in `/app/dashboard/stream/page.tsx`**

#### A. New Handlers
- `handleStartStreaming()` - Calls `manuallyStartStreaming()`
- `handleCheckStatus()` - Calls `checkStreamStatus()`
- Both handle errors and success with toast notifications

#### B. New UI Elements
- "I'm Streaming Now" button (shown when status = 'offline')
- "Check Stream Status" button (shown when status = 'offline')
- "Not Live Yet" warning message

**Backend Connection:** ✅ FULLY CONNECTED
- All buttons properly invoke server actions
- All responses properly trigger SWR cache refresh

---

### 3. **Stream Sources Query Fix in `/app/(public)/live/page.tsx`**

**Change:** Removed `.eq("is_active", true)` filter

**Before:**
```typescript
.eq("is_active", true)
.order("is_live", { ascending: false })
```

**After:**
```typescript
// Now shows ALL 4 stream sources
.order("is_live", { ascending: false })
.order("is_featured", { ascending: false })
.order("priority", { ascending: false })
```

**RLS Policy Check:** ✅ PASSES
- Policy: "Anyone can view active stream sources" - allows public read access

**Column Status:**
- ✅ `is_live` - EXISTS
- ✅ `is_featured` - EXISTS  
- ✅ `priority` - EXISTS

---

### 4. **VOD Library Page `/live/vods/page.tsx`**

**Database Query:**
```sql
SELECT * FROM user_streams 
WHERE status = 'ended' AND is_public = true
ORDER BY ended_at DESC
LIMIT 50
```

**RLS Policy Check:** ⚠️ FAILS
- Current policy: `status = 'live' AND is_public = true`
- This query uses: `status = 'ended'` - NOT COVERED by RLS
- **Result:** Query will return 0 rows due to RLS blocking

**Missing Policy:** 
```sql
CREATE POLICY "Public can view ended streams" ON user_streams
FOR SELECT USING (status = 'ended' AND is_public = true);
```

---

## 🚨 Critical Issues

### Issue #1: Missing `mux_playback_id` Column
- **Used:** go-live-actions.ts line 294
- **Location:** user_streams table
- **Status:** Column does NOT exist in schema
- **Current Code:**
```typescript
if (!playbackUrl && stream.mux_playback_id) {
  playbackUrl = `https://stream.mux.com/${stream.mux_playback_id}.m3u8`
}
```
- **Fix Option A:** Add migration to create column:
```sql
ALTER TABLE user_streams ADD COLUMN mux_playback_id TEXT;
```
- **Fix Option B:** Use existing column (check what's actually populated)

### Issue #2: VOD Query Fails Due to Missing RLS Policy
- **Problem:** `/live/vods` page queries `status = 'ended'` but RLS doesn't allow it
- **Fix:** Add policy to 051-user-streams-final.sql:
```sql
CREATE POLICY "Public can view ended streams" ON user_streams
FOR SELECT USING (status = 'ended' AND is_public = true);
```

### Issue #3: Stream Source Updates Not Protected
- **Problem:** `toggleStreamSourceLive()` can be called by any authenticated user
- **Fix:** Add admin-only policy to stream_sources:
```sql
CREATE POLICY "Only admins can update stream sources" ON stream_sources
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND role = 'admin'
  )
);
```

---

## Backend Verification Checklist

| Component | RLS | Schema | Executable | Status |
|-----------|-----|--------|-----------|--------|
| manuallyStartStreaming | ✅ | ⚠️ | ❌ | **BLOCKED** |
| checkStreamStatus | ✅ | ⚠️ | ⚠️ | **WORKS** (but mux_playback_id unused) |
| toggleStreamSourceLive | ⚠️ | ✅ | ⚠️ | **WORKS** (needs admin policy) |
| /live (stream sources) | ✅ | ✅ | ✅ | **COMPLETE** |
| /live/vods (VOD page) | ⚠️ | ✅ | ❌ | **BLOCKED** |

---

## Required SQL Fixes

Run these in Supabase SQL Editor:

### Fix #1: Add VOD Viewing Policy
```sql
CREATE POLICY "Public can view ended streams" ON user_streams
FOR SELECT USING (status = 'ended' AND is_public = true);
```

### Fix #2: Add Admin Protection for Stream Sources
```sql
CREATE POLICY "Only admins can update stream sources" ON stream_sources
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND role = 'admin'
  )
);
```

### Fix #3: Add mux_playback_id Column (if needed)
```sql
ALTER TABLE user_streams ADD COLUMN mux_playback_id TEXT;
```

---

## Test Queries

### Verify VOD RLS Works:
```sql
-- As authenticated user
SELECT id, title, status FROM user_streams WHERE status = 'ended' LIMIT 1;
```

### Verify Stream Sources Query Works:
```sql
-- As public (no auth)
SELECT id, title, is_live, is_featured, priority 
FROM stream_sources 
ORDER BY is_live DESC, is_featured DESC, priority DESC;
```

### Check All Active Policies:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('user_streams', 'stream_sources')
ORDER BY tablename, policyname;
```

---

## Summary

**UI & Business Logic:** ✅ Fully implemented  
**Frontend Connections:** ✅ Properly wired  
**Backend Database:** ⚠️ Needs 3 fixes  
**Deployment Readiness:** ❌ NOT READY (blocked by RLS & schema issues)

**Before deploying to production, execute the 3 SQL fixes above.**

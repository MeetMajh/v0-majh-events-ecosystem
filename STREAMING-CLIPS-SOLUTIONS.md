# MAJH EVENTS - STREAMING & CLIPS SYSTEM COMPLETE GUIDE

## A. STREAM SHARING & VOD LIBRARY SOLUTIONS

### Issue 1: Missing VOD in Public Library
**VOD 415efa6c-af15-49dc-9fa2-9ee5caf36cb1 is in recordings but not in VODs**

**SQL Diagnostic Query:**
```sql
SELECT 
  id,
  title,
  status,
  is_public,
  mux_playback_id,
  duration_seconds,
  created_at
FROM user_streams
WHERE id = '415efa6c-af15-49dc-9fa2-9ee5caf36cb1';
```

**If issue found, fix with:**
```sql
UPDATE user_streams
SET 
  status = 'ended',
  is_public = true
WHERE id = '415efa6c-af15-49dc-9fa2-9ee5caf36cb1';
```

### Issue 2: Individual Stream Source Sharing
**Currently can't share individual streams like /watch/vod/[id]**

**Solution: Create Stream Source Share Links**
- Route: `/watch/stream/[id]` (similar to `/watch/vod/[id]`)
- Shows embedded player for stream source (YouTube, Twitch, Kick)
- Shareable URL format: `majhevents.com/watch/stream/[streamSourceId]`
- Include embed code for stream iframe

### Issue 3: "Hot Matches Events Streams" Header
**Currently not prominent enough**

**Enhancement:**
- Move to hero section at top of `/live` page
- Add large call-to-action buttons:
  - "Watch All Streams" (larger button)
  - "Go Live" (primary CTA)
  - "View VODs" button
- Use gradient background
- Add stream count indicator

---

## B. LIVE PAGE IMPROVEMENTS

### Issue 1: Queue Navigation (Next/Previous)
**Need to go to next stream in the queue**

**Implementation:**
- Store stream sources in order (priority field already exists)
- Add "Next Stream" and "Previous Stream" buttons
- Current stream highlighted
- Auto-play next when current ends (optional)

### Issue 2: Shareable Stream Links
**Each stream source needs majhevents.com link**

**Solution:**
- Use `/watch/stream/[id]` route (see Issue A.2)
- Add "Share" button to each stream card
- Copy link format: `majhevents.com/watch/stream/{streamSourceId}`
- QR code generator for sharing

---

## C. CLIPS SYSTEM - COMPLETE REFERENCE

### Where Clips Are Stored
- **Database Tables:**
  - `clips` - Main clips table (if exists)
  - `player_media` - Alternative clips storage
  - Check: `SELECT * FROM information_schema.tables WHERE table_name IN ('clips', 'player_media')`

### Where to Access Clips

**Viewing (Public):**
- `/clips` - Public clips feed
- `/media` - Media library

**Creating (Authenticated):**
- `/dashboard/creator` - Creator dashboard
- `/studio/clip` - Clip creation/upload interface
- `/dashboard/creator/analytics/[clipId]` - View clip analytics

**Managing (Authenticated):**
- `/dashboard/creator/clips` - Your uploaded clips (if exists)
- Delete/edit options available

### How to Upload Clips

**Method 1: Direct Upload**
1. Go to `/dashboard/creator`
2. Look for "Create Clip" or "Upload" button
3. Select video file or record from stream
4. Add title, description, game category
5. Publish

**Method 2: From Stream**
1. While streaming, mark clip moment
2. Go to `/studio` or `/dashboard/creator`
3. Find "Create from Stream" option
4. Select timestamp range
5. Publish as clip

**Method 3: From Dashboard**
1. `/dashboard/creator/clips`
2. "New Clip" button
3. Upload or paste YouTube/Vimeo link
4. Metadata
5. Publish

### How to View Your Uploaded Clips
1. Go to `/dashboard/creator`
2. Look for "My Clips" or "Uploads" section
3. Can see:
   - Title, thumbnail, duration
   - View count
   - Like/share count
   - Analytics (if available)
4. Click clip to view full details

### Clips Features Available
- Upload custom clips
- Create from stream moments (if enabled)
- Share clips with link
- Analytics (views, engagement)
- Category tags (MTG, Pokemon, etc.)
- Trending clips feed
- User profile clips showcase

### Database Schema for Clips
```sql
-- Check clips table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'clips'
ORDER BY ordinal_position;

-- Or check player_media table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'player_media'
ORDER BY ordinal_position;
```

---

## ACTION ITEMS (Priority Order)

### Immediate (Critical)
1. Run SQL diagnostic query for VOD 415efa6c-af15-49dc-9fa2-9ee5caf36cb1
2. Fix VOD visibility (is_public=true, status='ended')
3. Create `/watch/stream/[id]` route for stream source sharing

### Short-term (High)
1. Add stream source share buttons
2. Enhance "Hot Matches" header styling
3. Add next/previous navigation on `/live` page

### Medium-term (Enhancement)
1. Add queue system for stream sources
2. Create stream source landing pages
3. Add QR code sharing for streams

### Long-term (Polish)
1. Auto-play next stream on current end
2. Clip creation from live streams
3. Stream analytics dashboard

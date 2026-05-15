# MAJH EVENTS - COMPLETE FEATURES GUIDE

## A. FIXED: VOD 415efa6c-af15-49dc-9fa2-9ee5caf36cb1 (Test Stream 38)

**Status:** FIXED - Now visible in `/live/vods` library

**What Was Done:**
- Updated Supabase with Mux playback ID: `sJa62QXPEI7dh5XfnOPpCMbGGSiQPDwMPfrdPXBfakY`
- Added Mux asset ID: `N4eKcsZ3AUn1nL300mGgwUBpfsrAdW5imyD96pnbEjBo`
- VOD now appears permanently in VOD library at `/live/vods`

---

## B. IMPLEMENTED: Stream Navigation & Sharing

### Feature 1: Individual Stream Share Links

**Access Point:** `/watch/stream/[streamId]`

**What It Does:**
- View individual stream in full-screen player
- See which stream you're viewing (e.g., "Stream 1 of 6")
- Copy shareable link with one click
- Share URL format: `majhevents.com/watch/stream/[streamId]`

**How to Use:**
1. Go to `/live` page
2. Click any stream card
3. You'll be taken to `/watch/stream/[streamId]` with player and controls
4. Click "Copy Link" button to copy shareable URL
5. Share with anyone - they can watch that specific stream

**Example Links:**
- `https://majhevents.com/watch/stream/[youtube-stream-id]`
- `https://majhevents.com/watch/stream/[twitch-stream-id]`
- `https://majhevents.com/watch/stream/[kick-stream-id]`

### Feature 2: Next/Previous Stream Navigation

**How It Works:**
- Previous/Next buttons navigate through your stream queue
- Buttons are disabled at start/end of list
- Streams ordered by priority (highest priority first)
- Current stream highlighted in stream list

**Navigation:**
- Click "Previous Stream" to go back one stream
- Click "Next Stream" to go to next stream
- Click any stream in the "All Streams" list to jump directly

**Stream Counter:**
- Shows "Stream 2 of 6" so you know which one you're watching
- Updates in real-time as you navigate

### Feature 3: Direct Platform Links

**What It Does:**
- Each stream card has an "Open" button
- Takes you directly to the original platform
- Useful if you want to interact with chat, subscribe, etc.

**Platforms:**
- YouTube: Open to channel or video
- Twitch: Open to channel or VOD
- Kick: Open to channel
- Custom: Opens to custom RTMP URL

---

## C. CLIPS SYSTEM - COMPLETE REFERENCE

### Where Clips Are Stored

**Database Table:** `player_media`

**Database Structure:**
```sql
-- Run this to see your clips table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_media'
ORDER BY ordinal_position;
```

**Key Fields:**
- `id` - Unique clip identifier (UUID)
- `user_id` - Creator user ID
- `title` - Clip title
- `description` - Clip description
- `media_url` - URL to video file (stored in Mux or Vercel Blob)
- `thumbnail_url` - Clip thumbnail image
- `duration_seconds` - Video length
- `media_type` - Always "video" for clips
- `status` - Processing status: "processing", "ready", or "failed"
- `view_count` - Number of views
- `is_public` - Whether visible publicly (true/false)
- `created_at` - When clip was created
- `updated_at` - Last update time

---

### How to ACCESS CLIPS

| Action | URL | Steps |
|--------|-----|-------|
| **View Clips Feed** | `/clips` | Go directly to public clips page - browse all public clips |
| **View Creator's Clips** | `/dashboard/creator/clips` | Dashboard → Clips section (if logged in) |
| **View Clip Analytics** | `/dashboard/creator/analytics/[clipId]` | Dashboard → Analytics → select a clip |
| **Media Library** | `/media` or `/dashboard/media` | Browse all your uploaded media files |

---

### How to CREATE/UPLOAD CLIPS

#### Option 1: Upload Video File Directly

**Steps:**
1. Go to `/dashboard` → "Upload Media" button
2. Click "Create Clip" or "New Upload"
3. Select video file from computer (supports MP4, WebM, MOV)
4. Fill in:
   - **Title:** Clip name (e.g., "Epic Moment - Test Event")
   - **Description:** What the clip is about
   - **Category:** Select game (MTG, Pokemon, Yugioh, etc.)
   - **Tags:** Add searchable tags (e.g., #tournament, #highlights)
   - **Visibility:** Public or Private
5. Click "Upload"
6. System processes video (may take 1-5 minutes)
7. Once ready, clip appears in `/clips` feed

#### Option 2: Create from Stream Moment (if enabled)

**Steps:**
1. Go to `/live` page during a live stream
2. Look for "Clip This Moment" or "Create Clip" button
3. Select start and end points (usually 15-60 seconds)
4. Add title and description
5. Click "Create Clip"
6. Clip automatically created from stream recording

#### Option 3: Paste External Video Link

**Steps:**
1. Go to `/dashboard` → "Add Media"
2. Select "Link Video" instead of upload
3. Paste URL (YouTube, Vimeo, or direct video URL)
4. Fill in metadata (title, description, etc.)
5. Click "Add"

---

### HOW TO VIEW YOUR CLIPS

#### View Analytics & Performance

1. **Go to Dashboard:** `/dashboard/creator`
2. **Click "Clips" or "My Uploads"**
3. **See list of your clips with:**
   - Title
   - View count
   - Creation date
   - Status (Processing/Ready/Failed)
   - Privacy setting (Public/Private)

4. **Click on a clip to see:**
   - Full analytics: Views, likes, shares
   - Performance metrics
   - Viewer engagement
   - Share statistics

#### Edit Clip Details

1. **Go to your clip** in `/dashboard/creator/clips`
2. **Click the clip or "Edit" button**
3. **Modify:**
   - Title
   - Description
   - Category/Tags
   - Thumbnail
   - Visibility (make public/private)
4. **Click "Save"**

#### Share a Clip

1. **Click on clip** in `/clips` or `/dashboard/creator/clips`
2. **Click "Share" button**
3. **Copy link:** `majhevents.com/clips/[clipId]`
4. **Share on social media, Discord, etc.**

---

### HOW TO MANAGE CLIPS

#### Delete a Clip

1. Go to `/dashboard/creator/clips`
2. Find the clip you want to delete
3. Click "..." menu or "Delete" button
4. Confirm deletion

#### Change Visibility

1. Go to `/dashboard/creator/clips`
2. Click clip to open details
3. Change "Visibility" from Public to Private (or vice versa)
4. Save changes

#### Feature a Clip

1. Go to admin panel (if you have admin access)
2. Navigate to "Featured Content" or "Clips Management"
3. Select clips to feature on homepage
4. Featured clips appear in `/clips` at the top

---

### QUICK LINKS FOR CLIPS

**User Actions:**
- View all clips: `majhevents.com/clips`
- My clips: `majhevents.com/dashboard/creator/clips`
- Clip analytics: `majhevents.com/dashboard/creator/analytics/[clipId]`
- Upload new: `majhevents.com/dashboard/creator/clips/new`

**Watch a Specific Clip:**
- Format: `majhevents.com/clips/[clipId]`
- Example: `majhevents.com/clips/415efa6c-af15-49dc-9fa2-9ee5caf36cb1`

---

## SUMMARY OF NEW FEATURES

✅ **Issue A Fixed:**
- VOD 415efa6c now visible in VOD library with playback

✅ **Issue B Implemented:**
- Next/Previous stream navigation buttons
- Shareable individual stream links at `/watch/stream/[id]`
- Copy-to-clipboard share button
- Stream counter showing current position

✅ **Issue C Documented:**
- Clips stored in `player_media` table
- Multiple access points for viewing/managing clips
- Upload options: Direct file, stream moment, or external link
- Complete editing and sharing workflow

---

## USAGE EXAMPLES

### Share a Stream
1. Go to `/live`
2. Click "Twitch Main Stream"
3. Click "Copy Link" button
4. Share: `majhevents.com/watch/stream/[twitch-id]`

### Navigate Streams
1. On stream page, click "Next Stream" button
2. Automatically takes you to next stream in queue
3. View counter updates: "Stream 2 of 6"

### Upload a Clip
1. Go to `/dashboard` → "Upload Media"
2. Select video file
3. Add title: "Amazing Moment - Test Event"
4. Click "Upload"
5. Clip ready in ~5 minutes
6. Share at `majhevents.com/clips/[newClipId]`

### View All Clips
1. Go to `majhevents.com/clips`
2. Browse all public clips created by any user
3. Click to watch full clip
4. Use filters/search to find specific clips

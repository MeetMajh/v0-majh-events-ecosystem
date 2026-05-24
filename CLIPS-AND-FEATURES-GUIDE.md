# MAJH EVENTS - COMPLETE STREAMING & CLIPS GUIDE

## ISSUE A: Fixed - Missing VOD Playback IDs

**Status:** ✅ RESOLVED

**Problem:** VOD "test stream 38" (ID: 415efa6c-af15-49dc-9fa2-9ee5caf36cb1) existed but had null Mux playback IDs, preventing display in VOD library.

**Solution Applied:**
```sql
UPDATE user_streams
SET 
  mux_playback_id = 'sJa62QXPEI7dh5XfnOPpCMbGGSiQPDwMPfrdPXBfakY',
  mux_asset_id = 'N4eKcsZ3AUn1nL300mGgwUBpfsrAdW5imyD96pnbEjBo',
  playback_url = 'https://stream.mux.com/sJa62QXPEI7dh5XfnOPpCMbGGSiQPDwMPfrdPXBfakY.m3u8'
WHERE id = '415efa6c-af15-49dc-9fa2-9ee5caf36cb1';
```

**Result:** VOD now displays permanently in `/live/vods` with full playback capability.

---

## ISSUE B: Stream Navigation & Sharing Features

### ✅ Feature 1: Individual Stream Share Links

**Access Point:** `/watch/stream/[streamId]`

**Capabilities:**
- View individual stream in full player with embed
- See real-time position: "Stream X of Y"
- Copy shareable majhevents.com link (one-click copy)
- Share URLs work on Discord, Twitter, email, etc.

**How to Share a Stream:**

1. Go to `https://www.majhevents.com/live` page
2. Click any stream source card (YouTube, Twitch, Kick)
3. Redirects to `/watch/stream/[streamId]` with player
4. Click **"Copy Link"** button (top right)
5. Share URL: `majhevents.com/watch/stream/[streamId]`

**Example Shareable Links:**
```
https://majhevents.com/watch/stream/abc123xyz789
https://majhevents.com/watch/stream/twitch-stream-1
https://majhevents.com/watch/stream/youtube-main
```

### ✅ Feature 2: Next/Previous Stream Navigation

**Navigation Controls:**
- **"Previous Stream"** button - Go back one stream in queue
- **"Next Stream"** button - Go forward one stream
- Buttons **disabled** at start/end of list (no wrapping)
- Streams ordered by **priority** (admin-configurable)

**How to Queue Through Streams:**

1. On any stream page at `/watch/stream/[id]`
2. Look for **"Previous Stream"** and **"Next Stream"** buttons
3. Click to navigate through queue
4. Current position shown: **"Stream 2 of 6"**
5. Or click any stream in **"All Streams"** sidebar to jump directly

**Real-time Updates:**
- Stream counter updates as you navigate
- Current stream highlighted in sidebar
- Live indicator shows if streaming now
- Smooth transitions between streams

### ✅ Feature 3: Stream List & Sidebar

**What You See:**
- Full list of all active stream sources
- Priority-ordered display
- Live status badges (red "LIVE" indicator)
- Platform badges (YouTube, Twitch, Kick)
- Quick-click navigation

**Sidebar Interaction:**
- Click any stream to jump to it instantly
- Current stream highlighted with border
- Hover effects for better UX
- Shows stream number in list

---

## ISSUE C: Clips System - Complete Guide

### Where Clips Are Stored

**Database:** Supabase table `player_media`

**Storage Options:**
- Vercel Blob (for uploaded files)
- Mux (for stream moments)
- External URLs (YouTube, Vimeo embeds)

**Database Fields:**
```
id (UUID)              - Unique clip identifier
user_id (UUID)         - Creator user ID
title (TEXT)           - Clip name
description (TEXT)     - What's in the clip
media_url (TEXT)       - URL to video file
thumbnail_url (TEXT)   - Clip preview image
duration_seconds (INT) - Length in seconds
media_type (TEXT)      - Type ('video', 'audio')
status (TEXT)          - 'processing', 'ready', 'failed'
view_count (INT)       - Total views
is_public (BOOL)       - True = visible in feed
created_at (TIMESTAMP) - When created
updated_at (TIMESTAMP) - Last modified
```

### Access Points for Clips

| What | URL | Notes |
|------|-----|-------|
| **View All Clips** | `/clips` | Public feed - discover clips |
| **View Single Clip** | `/watch/clip/[clipId]` | Individual clip player |
| **My Clips** | `/dashboard/creator/clips` | Your uploads (auth required) |
| **Clip Analytics** | `/dashboard/creator/analytics/[clipId]` | Views, engagement metrics |
| **Media Library** | `/dashboard/creator/media` | Browse all your media |
| **Manage Clips** | `/dashboard/creator/my-clips` | Edit, delete, publish |

### How to Upload a Clip

**Step 1: Access Creator Dashboard**
```
URL: https://www.majhevents.com/dashboard/creator
Look for: "Upload Clip", "Create Clip", or "+ New" button
```

**Step 2: Choose Upload Method**

**Option A - Upload Video File:**
- Click "Upload" or drag-and-drop
- Select file from computer (MP4, WebM, MOV)
- Wait for upload to complete

**Option B - Record Stream Moment:**
- During live stream, click "Clip This"
- Select start/end time (usually 15-90 seconds)
- Automatically created from stream VOD

**Option C - Add External Video:**
- Click "Add from URL"
- Paste link (YouTube, Vimeo, direct video URL)
- System embeds or imports video

**Step 3: Add Metadata**
- **Title** - Clip name (required)
- **Description** - Context, timestamps, details
- **Category** - Select: MTG, Pokemon, Yugioh, Weiss, VGC, Other
- **Tags** - Add searchable keywords (e.g., #tournament, #combo)
- **Thumbnail** - Upload custom or use default frame

**Step 4: Set Visibility & Publish**
- **Visibility:** 
  - Public (appears in `/clips` feed)
  - Unlisted (shareable but not in feed)
  - Private (only you can see)
- **Allow Comments** - Yes/No
- **Allow Downloads** - Yes/No
- Click **"Publish"** to go live

### How to View & Manage Your Clips

**Option 1: Creator Dashboard**
```
Go to: /dashboard/creator
View: All your clips with thumbnails
See: Title, views, date, status, visibility
Actions: Edit, Delete, Share, Analytics
```

**Option 2: Clip Analytics**
```
Go to: /dashboard/creator/analytics
Select: Any clip to see detailed metrics
Track: Views, engagement, shares, demographics
```

**Option 3: Media Management**
```
Go to: /dashboard/creator/my-clips
View: Table format with all clips
Columns: Title, Views, Duration, Status, Date
Actions: Quick edit, publish, delete
```

### Sharing Clips

**Generate Shareable Link:**
1. Go to `/dashboard/creator/my-clips`
2. Click clip to open details
3. Click "Share" or "Copy Link"
4. URL format: `majhevents.com/watch/clip/[clipId]`

**Share Clip Examples:**
```
Personal Clip: https://majhevents.com/watch/clip/abc123xyz
Tournament Moment: https://majhevents.com/watch/clip/def456uvw
Epic Play: https://majhevents.com/watch/clip/ghi789rst
```

**Platforms to Share On:**
- Discord (auto-embeds)
- Twitter (shows preview)
- Facebook (auto-plays)
- Email (embeddable link)
- Reddit (embeddable link)

### Edit Your Clips

**After Upload, You Can:**
- Change title and description
- Update category and tags
- Replace thumbnail
- Change visibility (public/private/unlisted)
- Trim/cut clip duration
- Delete clip entirely

**How to Edit:**
1. Go to `/dashboard/creator/my-clips`
2. Find clip and click "Edit"
3. Modify fields
4. Click "Save Changes"

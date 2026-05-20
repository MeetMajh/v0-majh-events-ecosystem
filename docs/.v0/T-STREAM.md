# T-STREAM: Multi-Tenant Broadcast Streaming Platform

**Status:** Diagnostic & Architecture Phase  
**Epic Owner:** Streaming Infrastructure  
**Target Release:** Q3 2026  
**Priority:** High (core platform capability)

---

## Executive Summary

T-STREAM enables MAJH Events to support a complete broadcast ecosystem where:
- **Players** stream from their profiles or during tournaments to build audience
- **Tournaments** embed live player streams in bracket/match pages
- **Broadcasters** (organizers/admins) compose multi-input broadcasts pulling from 1-4 player streams
- **Viewers** watch on majhevents.com with chat/engagement, external platforms (YouTube/Twitch), and on-demand VODs

**Architecture:** LiveKit (low-latency WebRTC) for ingest/composition + Mux (fallback RTMP for OBS) + Hybrid storage (Blob for recent + cold archive option)

---

## Current State vs. Target

| Component | Current | Target | Gap |
|-----------|---------|--------|-----|
| **Player Streaming** | OBS → Mux RTMP only | Browser native + OBS fallback | Native browser ingest |
| **Match Viewer Embed** | Text scoreboard | Live player stream embed | Requires LiveKit room |
| **Broadcast Studio** | UI built, no output | Composite 1-4 sources to broadcast room | Egress + composition logic |
| **Multistream** | Mux webhooks ready | LiveKit egress to Twitch/YouTube/RTMP | Egress job orchestration |
| **Chat/Engagement** | Per-tournament only | Per-stream + broadcast | LiveKit data channel |
| **VOD Storage** | Mux only | Mux + Blob hybrid | Strategy needed |
| **Access Control** | Global role (staff_roles) | Org-level broadcast permissions | T-204 integration |

---

## System Architecture

### Layer 1: Player Ingest (WebRTC via LiveKit)

```
Player Browser (majhevents.com)
    ↓
    [getUserMedia capture]
    ↓
    LiveKit Room: player-{userId}-{streamId}
    (private, only player + organizer can join)
    ↓
    Stored as participant track
    (audio + video WebRTC medias)
```

**Workflows:**
1. **Player goes live:**
   - Create LiveKit room `player-{userId}-{streamId}`
   - Grant player token to join as "publisher"
   - Store room info in `user_streams` table (new: `livekit_room_name`)
   - Emit event for tournament (if in match)

2. **Auto-join in tournament:**
   - Match starts → auto-create room if not exists
   - Prompt player to "Start Broadcasting" (not mandatory)
   - Player joins with camera/mic from browser

3. **Audience views player stream:**
   - Tournament match page → embed LiveKit VideoTrack component
   - Join as "subscriber" (viewer role)
   - Low-latency playback (~100ms)
   - Chat panel via LiveKit data channel

---

### Layer 2: Broadcast Composition (LiveKit Composite Participant)

```
Broadcast Studio UI (organizer browser)
    ↓
    [Scene builder - position 1-4 player streams]
    ↓
    Create LiveKit Room: broadcast-{eventId}
    ↓
    Composite Participant:
    - Input: 4 player video tracks + commentary audio
    - Canvas: Layout engine (B1-B4 scoreboard, F1/F2 faces, C1/C2 gameplay, MT title)
    - Output: Single mixed WebRTC stream
    ↓
    Broadcast room joins as publisher
    (viewers join as subscribers)
```

**Workflows:**
1. **Organizer creates broadcast:**
   - Select tournament/event
   - Choose 1-4 player streams from active participants
   - Define layout (template: 1v1, 1v2, 2v2, commentary)
   - Press "Start Broadcast"

2. **Studio system:**
   - Create `broadcast-{eventId}` room
   - Load composite participant (WebRTC canvas encoder)
   - Subscribe to 4 player rooms (fetch tracks)
   - Compose onto canvas in real-time
   - Publish composed stream back to broadcast room

3. **Viewer joins broadcast:**
   - Join as subscriber to `broadcast-{eventId}`
   - Receive composed video + commentary audio
   - See low-latency broadcast (~100-200ms)

---

### Layer 3: Egress & Multistream (LiveKit Egress)

```
Broadcast Room (active WebRTC stream)
    ↓
    [Trigger egress job on broadcast start]
    ↓
    LiveKit Egress:
    ├─ Output 1: RTMP → Twitch
    ├─ Output 2: RTMP → YouTube
    ├─ Output 3: RTMP → Custom (self-hosted or external)
    └─ Output 4: File → MP4/WebM (VOD)
```

**Workflows:**
1. **Organizer clicks "Go Live":**
   - Check broadcast room status (room active + participant publishing)
   - Create LiveKit egress job:
     ```
     {
       roomName: "broadcast-{eventId}",
       outputs: [
         { type: "rtmp", urls: ["rtmp://live.twitch.tv/app/..."] },
         { type: "rtmp", urls: ["rtmp://a.rtmp.youtube.com/live2/..."] },
         { type: "file", filepath: "s3://..." or "blob://..." }
       ]
     }
     ```
   - Store egress job ID in `broadcasts` table

2. **Fallback OBS path (existing):**
   - Mux stream endpoint stays active
   - Organizer can pull from Mux RTMP as secondary source
   - Ensures broadcast never relies solely on LiveKit

3. **Broadcast ends:**
   - Stop egress job
   - Finalize VOD (post-process if needed)
   - Create `broadcast_recordings` entry

---

### Layer 4: Public Viewer (HLS Fallback)

```
majhevents.com/live (non-authenticated viewers)
    ↓
    [Request broadcast HLS stream]
    ↓
    LiveKit Egress File Output
    ├─ Generates HLS playlist (.m3u8)
    └─ Segments (.ts files) stored in Blob
    ↓
    HLS.js player renders live + on-demand
```

**Why HLS fallback:**
- WebRTC requires JS + browser codecs (not all devices support)
- HLS works on all browsers + native apps
- Generated by egress automatically
- Slight latency increase (~3-10s) acceptable for public viewers

---

## Database Schema Additions

### `user_streams` (extends existing)

```sql
ALTER TABLE user_streams ADD COLUMN (
  livekit_room_name TEXT,              -- player-{userId}-{streamId}
  livekit_token TEXT,                  -- JWT for player to join
  player_count INT DEFAULT 0,          -- current viewer count
  peak_viewers INT DEFAULT 0,          -- max concurrent viewers
  stream_type TEXT DEFAULT 'practice', -- 'practice' | 'tournament' | 'showcase'
  tournament_id UUID REFERENCES tournaments(id),
  chat_channel_id UUID                 -- LiveKit data channel ID
);
```

### `broadcasts` (NEW)

```sql
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'live', 'ended', 'recording')),
  broadcast_room_name TEXT,            -- broadcast-{eventId}
  egress_job_id TEXT,                  -- LiveKit egress job ID
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Only organizer + org admins can view/create
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_can_create_broadcast" ON broadcasts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM organization_members 
      WHERE user_id = auth.uid() 
      AND role_key IN ('owner', 'manager', 'organizer')
      AND organization_id IN (
        SELECT organization_id FROM events WHERE id = NEW.event_id
      ))
  );
```

### `broadcast_inputs` (NEW)

```sql
CREATE TABLE broadcast_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  player_stream_id UUID NOT NULL REFERENCES user_streams(id),
  input_position INT CHECK (input_position BETWEEN 1 AND 4),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);
```

### `broadcast_recordings` (NEW)

```sql
CREATE TABLE broadcast_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id),
  vod_url TEXT,                        -- HLS playlist or MP4 URL
  storage_type TEXT,                   -- 'mux' | 'blob' | 'hybrid'
  duration_seconds INT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Access Control & Permissions

### Who Can Create a Broadcast?

Requires **at least one of:**
- Organization owner
- Organization manager
- Tournament organizer (org-scoped)
- Staff with "broadcast" permission (org-scoped)

**Via:** `organization_members.role_key IN ('owner', 'manager', 'organizer')` (T-204 integration)

### Who Can Stream?

**Any authenticated user** can go live on their profile.
- If in active tournament: auto-scoped to tournament's organization
- Chat/engagement: only visible to users with tournament/event access

---

## Storage Strategy: Hybrid Approach

### Problem
- Mux: ~$0.03-0.05 per minute (1 hour broadcast = $1.80-3.00)
- LiveKit egress file: File storage only (need external CDN/origin)
- Blob: Good for near-term, expensive long-term ($0.06/GB/month)
- Cold archive: AWS Glacier (~$0.004/GB/month), 12-hour retrieval

### Solution: Tiered Hybrid

```
Broadcast Created (T=0)
  ↓
Broadcast Lives (T=1 to T+end)
  ├─ HLS segments → Blob (live playback)
  ├─ MP4 file → Mux egress (backup + edit-friendly)
  └─ Metadata → Database
  
30 days after broadcast ends
  ├─ If viewed < 10 times: Archive to cold storage (AWS Glacier)
  ├─ If viewed >= 10 times: Keep on Blob (CDN cache)
  └─ Delete intermediate HLS segments (keep MP4 only)

6 months after archive
  ├─ If not accessed: Delete from cold storage
  └─ Otherwise: Keep (searchable via `broadcast_recordings`)
```

**Cost Example (100 concurrent viewers, 1-hour stream):**
| Component | Unit Cost | Qty | Cost |
|-----------|-----------|-----|------|
| LiveKit egress | $0.05/min | 60 min | $3.00 |
| Blob storage (30 days) | $0.06/GB/month | ~0.5 GB | $0.03 |
| Mux MP4 backup | $0.003/min | 60 min | $0.18 |
| **Total** | | | **$3.21** |

If archived to Glacier after 30 days: **-$0.03** (net $3.18, amortized)

---

## Implementation Sequence

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create LiveKit account + environment config
- [ ] Add `livekit_room_name` to `user_streams` (migration)
- [ ] Create `broadcasts`, `broadcast_inputs`, `broadcast_recordings` tables
- [ ] Build `/api/livekit/rooms` endpoints (create/delete rooms)

### Phase 2: Player Streaming (Weeks 3-4)
- [ ] Build "Go Live" button on profile page (client-side capture + LiveKit join)
- [ ] Implement `/dashboard/profile/go-live` page
- [ ] Add viewer count + chat to player stream embed
- [ ] Update tournament match pages to embed live player streams

### Phase 3: Broadcast Studio (Weeks 5-6)
- [ ] Build broadcast creation UI (`/dashboard/broadcast/create`)
- [ ] Implement composite participant server (WebRTC canvas encoding)
- [ ] Build broadcast scene editor (drag-drop layout)
- [ ] Implement egress job orchestration

### Phase 4: Egress & Multistream (Weeks 7-8)
- [ ] Integrate LiveKit egress API
- [ ] Implement multistream output (Twitch/YouTube RTMP)
- [ ] Set up VOD storage pipeline (Blob + cold archive)
- [ ] Create broadcast VOD viewer page

### Phase 5: Polish & Testing (Weeks 9-10)
- [ ] Add failover logic (Mux fallback if LiveKit unavailable)
- [ ] Performance tuning (composite frame rate, bitrate optimization)
- [ ] Load testing (concurrent streams, viewer scale)
- [ ] Analytics dashboard

---

## Risk Mitigation

### Risk 1: LiveKit Service Outage
**Mitigation:** Keep Mux/RTMP fallback path active. Broadcast UI should auto-fallback if room creation fails.

### Risk 2: Composite Participant Resource Exhaustion
**Mitigation:** Limit broadcasts to organization tier (e.g., Pro tier = up to 4 concurrent broadcasts). Monitor CPU/memory.

### Risk 3: Player Stream Latency Causes Lip-Sync Issues
**Mitigation:** Use HLS fallback for playback (fixed delay). WebRTC used for real-time, not sync-critical.

### Risk 4: Storage Costs Spiral
**Mitigation:** Enforce 30-day auto-archive + viewer-based retention policy. Monitor Blob usage monthly.

---

## Integration Points with Existing Systems

| System | Integration | Change Required |
|--------|-----------|-----------------|
| **T-204 (Auth Refactor)** | Broadcast access control | Use `organization_members.role_key` after T-204 |
| **Tournament Module** | Auto-join player to stream on match start | Emit `tournament:match_started` event → trigger LiveKit room creation |
| **Chat System** | Per-stream chat via LiveKit data channel | Extend existing chat to support LiveKit data channel |
| **Analytics** | Track stream metrics (viewers, bitrate, errors) | Add LiveKit webhook integration for events |
| **VOD Module** | Broadcast VOD appears in creator dashboard | Add `broadcast_recordings` to VOD query |
| **Notifications** | Notify followers when creator goes live | Use existing notification system with stream_id link |

---

## Success Criteria

- [ ] Player can go live from profile without OBS
- [ ] Tournament match pages show live player streams with <500ms latency
- [ ] Organizer can create broadcast with 1-4 player inputs
- [ ] Broadcast outputs simultaneously to Twitch + YouTube + MAJH Platform
- [ ] VOD stored and retrievable within 5 minutes of broadcast end
- [ ] Cold storage archive works for 30+ day old broadcasts
- [ ] Fallback to Mux/RTMP works if LiveKit unavailable
- [ ] Load test: 100 concurrent player streams + 10 active broadcasts (no degradation)

---

## Open Questions

1. **Commentary Input:** Should broadcast accept secondary audio input (commentator mic) or remix from existing sources?
2. **Co-streaming:** Should two organizers be able to co-manage a broadcast simultaneously?
3. **Replay/Rewind:** Should broadcast support live replay of last 5-10 minutes?
4. **Graphics Overlay:** Should system support dynamic overlay insertion (sponsor logos, etc.)?

---

## References

- [LiveKit Documentation](https://docs.livekit.io)
- [Mux RTMP Ingest](https://docs.mux.com/guides/video/ingest-live-stream)
- [Broadcast Vision Sketch](../broadcast-vision.md)
- [AGENTS.md - Authorization Constraints](./AGENTS.md)

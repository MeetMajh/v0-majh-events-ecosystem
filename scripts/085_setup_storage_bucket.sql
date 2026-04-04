-- =====================================================
-- STORAGE BUCKET SETUP FOR PLAYER MEDIA
-- Run this in Supabase SQL Editor
-- =====================================================

-- Create the player-media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-media',
  'player-media',
  true,  -- Public bucket so videos can be streamed
  104857600,  -- 100MB file size limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage policies for player-media bucket

-- Allow authenticated users to upload their own files
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
CREATE POLICY "Users can upload to their own folder" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'player-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own files
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
CREATE POLICY "Users can update their own files" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'player-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
CREATE POLICY "Users can delete their own files" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-media' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to all files in player-media bucket
DROP POLICY IF EXISTS "Public can view player media" ON storage.objects;
CREATE POLICY "Public can view player media" ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'player-media');

SELECT 'Storage bucket player-media configured successfully!' AS status;

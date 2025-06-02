-- FitFind Supabase Storage Setup
-- Execute this script in your Supabase SQL Editor

-- Create storage bucket for uploaded images
INSERT INTO storage.buckets (id, name, public)
VALUES ('outfit-images', 'outfit-images', true);

-- Create storage policies
CREATE POLICY "Users can upload their own images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'outfit-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own images" ON storage.objects
FOR SELECT USING (
  bucket_id = 'outfit-images' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    -- Allow anonymous viewing for public images
    (storage.foldername(name))[1] = 'anonymous'
  )
);

CREATE POLICY "Users can delete their own images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'outfit-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add storage_path column to search_sessions table
ALTER TABLE search_sessions 
ADD COLUMN storage_path TEXT;

-- Add index for cleanup operations
CREATE INDEX idx_search_sessions_storage_path ON search_sessions(storage_path);

-- Add index for anonymous session cleanup
CREATE INDEX idx_search_sessions_anonymous_cleanup 
ON search_sessions(user_id, created_at) 
WHERE user_id IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN search_sessions.storage_path 
IS 'Path to the image file in Supabase Storage for cleanup purposes'; 
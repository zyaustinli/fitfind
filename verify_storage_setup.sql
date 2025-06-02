-- FitFind Storage Setup Verification
-- Run this in your Supabase SQL Editor to verify the setup

-- Check if storage_path column was added
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'search_sessions' 
AND column_name = 'storage_path';

-- Check if indexes were created
SELECT 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'search_sessions' 
AND indexname LIKE '%storage%';

-- Check if storage bucket exists
SELECT 
    name, 
    public,
    created_at
FROM storage.buckets 
WHERE name = 'outfit-images';

-- Check storage policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND policyname LIKE '%outfit%' OR policyname LIKE '%images%';

-- Test query to show recent sessions with storage info
SELECT 
    id,
    user_id,
    image_filename,
    image_url,
    storage_path,
    status,
    created_at
FROM search_sessions 
ORDER BY created_at DESC 
LIMIT 5; 
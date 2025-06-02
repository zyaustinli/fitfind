-- Migration: Add soft delete functionality to user_search_history table
-- Run this in your Supabase SQL Editor

-- Add deleted_at column to user_search_history table
ALTER TABLE user_search_history 
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient filtering of deleted items
CREATE INDEX idx_user_search_history_deleted_at ON user_search_history(deleted_at);

-- Update RLS policy to allow users to update their own search history (for soft delete)
CREATE POLICY "Users can update own search history" ON user_search_history
    FOR UPDATE USING (auth.uid() = user_id);

-- Optional: Add a function to soft delete search history items
CREATE OR REPLACE FUNCTION soft_delete_search_history(history_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_search_history 
    SET deleted_at = NOW() 
    WHERE id = history_id 
    AND user_id = auth.uid()
    AND deleted_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Add a function to restore soft deleted search history items
CREATE OR REPLACE FUNCTION restore_search_history(history_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE user_search_history 
    SET deleted_at = NULL 
    WHERE id = history_id 
    AND user_id = auth.uid()
    AND deleted_at IS NOT NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
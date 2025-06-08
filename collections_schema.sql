-- Collections feature database schema
-- Run this after the main database_schema.sql

-- User collections table
CREATE TABLE user_collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_image_url TEXT,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name) -- Prevent duplicate collection names per user
);

-- Collection items junction table
CREATE TABLE collection_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    collection_id UUID REFERENCES user_collections(id) ON DELETE CASCADE,
    saved_item_id UUID REFERENCES user_saved_items(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(collection_id, saved_item_id) -- Prevent duplicate items in same collection
);

-- Add collection_id to user_saved_items for default collection assignment
ALTER TABLE user_saved_items 
ADD COLUMN collection_id UUID REFERENCES user_collections(id) ON DELETE SET NULL;

-- Performance indexes
CREATE INDEX idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX idx_user_collections_created_at ON user_collections(created_at DESC);
CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id);
CREATE INDEX idx_collection_items_saved_item_id ON collection_items(saved_item_id);
CREATE INDEX idx_collection_items_position ON collection_items(collection_id, position);
CREATE INDEX idx_user_saved_items_collection_id ON user_saved_items(collection_id);

-- Enable Row Level Security
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

-- User collections policies
CREATE POLICY "Users can manage own collections" ON user_collections
    FOR ALL USING (auth.uid() = user_id);

-- Collection items policies  
CREATE POLICY "Users can manage collection items for own collections" ON collection_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_collections 
            WHERE user_collections.id = collection_items.collection_id 
            AND user_collections.user_id = auth.uid()
        )
    );

-- Update trigger for collections
CREATE TRIGGER update_user_collections_updated_at
    BEFORE UPDATE ON user_collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default collection for new users
CREATE OR REPLACE FUNCTION create_default_collection_for_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_collections (user_id, name, description, is_private)
    VALUES (NEW.id, 'My Favorites', 'Your saved fashion items', FALSE);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default collection when user profile is created
CREATE TRIGGER on_user_profile_created
    AFTER INSERT ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION create_default_collection_for_user(); 
-- FitFind Database Schema
-- Run this script in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Search sessions table
CREATE TABLE search_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_filename TEXT NOT NULL,
    file_id TEXT NOT NULL UNIQUE, -- Maps to backend file system
    status TEXT NOT NULL CHECK (status IN ('uploading', 'analyzing', 'searching', 'completed', 'error')),
    search_queries TEXT[] DEFAULT '{}',
    num_items_identified INTEGER DEFAULT 0,
    num_products_found INTEGER DEFAULT 0,
    conversation_context JSONB,
    error_message TEXT,
    country TEXT DEFAULT 'us',
    language TEXT DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Clothing items table (normalized from search results)
CREATE TABLE clothing_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_session_id UUID REFERENCES search_sessions(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    item_type TEXT NOT NULL,
    total_products INTEGER DEFAULT 0,
    price_range_min DECIMAL(10,2),
    price_range_max DECIMAL(10,2),
    price_range_average DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table (individual products from search results)
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clothing_item_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE,
    external_id TEXT, -- Product ID from retailer
    title TEXT NOT NULL,
    price DECIMAL(10,2),
    old_price DECIMAL(10,2),
    discount_percentage INTEGER,
    image_url TEXT,
    product_url TEXT,
    source TEXT NOT NULL,
    source_icon TEXT,
    rating DECIMAL(3,2),
    review_count INTEGER,
    delivery_info TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User saved items (wishlist)
CREATE TABLE user_saved_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- User search history (for quick access and analytics)
CREATE TABLE user_search_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    search_session_id UUID REFERENCES search_sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_search_sessions_user_id ON search_sessions(user_id);
CREATE INDEX idx_search_sessions_created_at ON search_sessions(created_at DESC);
CREATE INDEX idx_search_sessions_file_id ON search_sessions(file_id);
CREATE INDEX idx_clothing_items_session_id ON clothing_items(search_session_id);
CREATE INDEX idx_products_clothing_item_id ON products(clothing_item_id);
CREATE INDEX idx_user_saved_items_user_id ON user_saved_items(user_id);
CREATE INDEX idx_user_search_history_user_id ON user_search_history(user_id);
CREATE INDEX idx_products_source ON products(source);
CREATE INDEX idx_products_price ON products(price);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_search_history ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Search sessions policies
CREATE POLICY "Users can view own search sessions" ON search_sessions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own search sessions" ON search_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own search sessions" ON search_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Clothing items policies (inherit from search sessions)
CREATE POLICY "Users can view clothing items from own sessions" ON clothing_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM search_sessions 
            WHERE search_sessions.id = clothing_items.search_session_id 
            AND search_sessions.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert clothing items for own sessions" ON clothing_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM search_sessions 
            WHERE search_sessions.id = clothing_items.search_session_id 
            AND search_sessions.user_id = auth.uid()
        )
    );

-- Products policies (inherit from clothing items)
CREATE POLICY "Users can view products from own sessions" ON products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clothing_items 
            JOIN search_sessions ON search_sessions.id = clothing_items.search_session_id
            WHERE clothing_items.id = products.clothing_item_id 
            AND search_sessions.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert products for own sessions" ON products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM clothing_items 
            JOIN search_sessions ON search_sessions.id = clothing_items.search_session_id
            WHERE clothing_items.id = products.clothing_item_id 
            AND search_sessions.user_id = auth.uid()
        )
    );

-- User saved items policies
CREATE POLICY "Users can manage own saved items" ON user_saved_items
    FOR ALL USING (auth.uid() = user_id);

-- User search history policies
CREATE POLICY "Users can view own search history" ON user_search_history
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own search history" ON user_search_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_search_sessions_updated_at
    BEFORE UPDATE ON search_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
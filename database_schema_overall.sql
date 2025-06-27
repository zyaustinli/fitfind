-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.clothing_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  search_session_id uuid,
  query text NOT NULL,
  item_type text NOT NULL,
  total_products integer DEFAULT 0,
  price_range_min numeric,
  price_range_max numeric,
  price_range_average numeric,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clothing_items_pkey PRIMARY KEY (id),
  CONSTRAINT clothing_items_search_session_id_fkey FOREIGN KEY (search_session_id) REFERENCES public.search_sessions(id)
);
CREATE TABLE public.collection_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  collection_id uuid,
  saved_item_id uuid,
  added_at timestamp with time zone DEFAULT now(),
  position integer DEFAULT 0,
  CONSTRAINT collection_items_pkey PRIMARY KEY (id),
  CONSTRAINT collection_items_saved_item_id_fkey FOREIGN KEY (saved_item_id) REFERENCES public.user_saved_items(id),
  CONSTRAINT collection_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.user_collections(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clothing_item_id uuid,
  external_id text,
  title text NOT NULL,
  price numeric,
  old_price numeric,
  discount_percentage integer,
  image_url text,
  product_url text,
  source text NOT NULL,
  source_icon text,
  rating numeric,
  review_count integer,
  delivery_info text,
  tags ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_clothing_item_id_fkey FOREIGN KEY (clothing_item_id) REFERENCES public.clothing_items(id)
);
CREATE TABLE public.search_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  image_url text NOT NULL,
  image_filename text NOT NULL,
  file_id text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status = ANY (ARRAY['uploading'::text, 'analyzing'::text, 'searching'::text, 'completed'::text, 'error'::text])),
  search_queries ARRAY DEFAULT '{}'::text[],
  num_items_identified integer DEFAULT 0,
  num_products_found integer DEFAULT 0,
  conversation_context jsonb,
  error_message text,
  country text DEFAULT 'us'::text,
  language text DEFAULT 'en'::text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  storage_path text,
  CONSTRAINT search_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT search_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_collections (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  description text,
  cover_image_url text,
  is_private boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_collections_pkey PRIMARY KEY (id),
  CONSTRAINT user_collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_saved_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  product_id uuid,
  notes text,
  tags ARRAY DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT now(),
  collection_id uuid,
  CONSTRAINT user_saved_items_pkey PRIMARY KEY (id),
  CONSTRAINT user_saved_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_saved_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT user_saved_items_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.user_collections(id)
);
CREATE TABLE public.user_search_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  search_session_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT user_search_history_pkey PRIMARY KEY (id),
  CONSTRAINT user_search_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT user_search_history_search_session_id_fkey FOREIGN KEY (search_session_id) REFERENCES public.search_sessions(id)
);
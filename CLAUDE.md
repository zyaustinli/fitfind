# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (Flask)
- **Start development server**: `python app.py` (runs on port 5000)
- **Start with development script**: `python start_dev.py` (starts both backend and frontend)
- **Run search tests**: `python search_test.py`
- **Run collections tests**: `python run_collections_tests.py`

### Frontend (Next.js)
- **Development server**: `cd fitfind-frontend && npm run dev` (runs on port 3000)
- **Build production**: `cd fitfind-frontend && npm run build`
- **Lint**: `cd fitfind-frontend && npm run lint`
- **Bundle analysis**: `cd fitfind-frontend && npm run analyze`

### Environment Setup
- Create `.env` file in root with API keys: `GOOGLE_API_KEY`, `SERPAPI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_JWT_SECRET`
- Install Python dependencies: `pip install -r requirements.txt`
- Install Node.js dependencies: `cd fitfind-frontend && npm install`

## Architecture Overview

### Full-Stack Structure
FitFind is an AI-powered fashion discovery application with a Flask backend and Next.js frontend:

**Backend Stack:**
- **Flask 3.0.0**: Main API server with CORS support
- **Python 3.8+**: Runtime environment
- **Supabase**: PostgreSQL database with RLS and authentication
- **Google Gemini 2.5 Flash**: AI image analysis and clothing identification
- **SerpAPI**: Google Shopping search integration
- **Gunicorn**: Production WSGI server

**Frontend Stack:**
- **Next.js 15**: React framework with App Router
- **React 19**: UI library with latest features
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS v4**: Utility-first CSS framework
- **Supabase Auth**: Authentication system
- **Custom Context API**: State management

## Core Features & User Experience

### 1. AI-Powered Image Analysis
**Main Flow** (`/src/app/page.tsx`):
- **Split Layout**: Upload section + results display
- **Multi-format Support**: JPG, PNG, WEBP (max 10MB)
- **Progressive Loading**: Real-time status updates (Analyzing → Searching → Complete)
- **AI Processing**: Google Gemini 2.5 Flash identifies clothing items and generates search queries

### 2. Authentication System
**Components**: `/src/contexts/AuthContext.tsx`, `/src/components/auth/`
- **Supabase Integration**: Complete email/password authentication
- **Profile Management**: Automatic profile creation and management
- **Session Persistence**: Maintains authentication across page refreshes
- **Modal Interface**: Unified auth modal with login/signup/forgot password

### 3. Search History Management
**Location**: `/src/app/history/`, `/src/hooks/useSearchHistory.ts`
- **Persistent Storage**: All searches saved to database with full metadata
- **Advanced Filtering**: Search by queries, date, items found, products found
- **Bulk Operations**: Multi-select deletion with progress tracking
- **Undo Functionality**: Temporary undo for accidental deletions (10-second timeout)
- **Network Resilience**: Offline-aware operations with retry logic

### 4. Wishlist System
**Location**: `/src/app/wishlist/`, `/src/hooks/useWishlist.ts`
- **One-Click Saving**: Save products directly from search results
- **Advanced Filtering**: Price range, sources, tags, full-text search
- **Multiple View Modes**: Grid and list layouts with responsive design
- **Optimistic Updates**: Instant UI feedback with rollback on errors
- **Infinite Scroll**: Pagination with load more functionality

### 5. Collections Feature
**Location**: `/src/app/collections/`, `/src/hooks/useCollections.ts`
- **Organization System**: Group saved items into themed collections
- **Default Collection**: "My Favorites" auto-created for each user
- **Collection Management**: Create, edit, delete collections with cover images
- **Item Organization**: Add/remove items from multiple collections
- **Privacy Controls**: Public/private collection settings

## Backend Architecture

### Core Services

#### 1. Main Application (`app.py`)
**Purpose**: Flask application serving as API gateway with 30+ endpoints

**Key Features**:
- Production-ready CORS configuration
- Content compression and security headers
- File upload handling (16MB limit)
- Comprehensive error handling and logging

**API Endpoints**:
- **Authentication**: `/api/auth/status`, `/api/auth/profile`
- **Image Processing**: `/api/upload`, `/api/redo`, `/api/results/<file_id>`
- **Search History**: `/api/history` (GET/DELETE), `/api/history/<session_id>`
- **Wishlist**: `/api/wishlist` (GET/POST), `/api/wishlist/add`, `/api/wishlist/remove`
- **Collections**: `/api/collections` (CRUD), `/api/collections/<id>/items`
- **System**: `/api/health`, `/api/storage/cleanup`

#### 2. AI/ML Pipeline (`search_recommendation.py`)
**Purpose**: Core recommendation engine with 1500+ lines of sophisticated processing

**Key Functions**:
- **`create_search_query_gemini()`**: Analyzes images using Google Gemini with detailed fashion expertise
- **`search_items_parallel()`**: Concurrent SerpAPI searches (max 5 workers)
- **`clean_search_results_for_frontend()`**: Processes raw results for frontend consumption
- **`extract_item_type_from_query()`**: Intelligent clothing type extraction with 1000+ item types
- **`redo_search_queries()`**: Conversation continuity for improved results

**AI Pipeline Flow**:
1. **Image Upload** → Gemini Vision API analyzes clothing items
2. **Query Generation** → Creates specific search queries for each item (10-15 words max)
3. **Parallel Search** → SerpAPI searches multiple retailers simultaneously
4. **Data Cleaning** → Standardizes product information and pricing
5. **Result Storage** → Saves to database and file system

#### 3. Database Service (`database_service.py`)
**Purpose**: Comprehensive database abstraction layer with 20+ operations

**Core Operations**:
- **User Management**: Profile creation, updates, preferences
- **Search Sessions**: Complete session lifecycle management
- **Product Management**: UUID-based product storage with external ID mapping
- **Wishlist Operations**: Add/remove with duplicate prevention
- **Collection Management**: CRUD operations with item relationships
- **History Tracking**: Soft deletion and cleanup with retention policies

#### 4. Authentication Middleware (`auth_middleware.py`)
**Purpose**: JWT token validation and user context management

**Security Features**:
- **JWT Validation**: Proper signature verification with Supabase secrets
- **Decorators**: `@require_auth` and `@optional_auth` for route protection
- **User Context**: Automatic user injection into Flask's `g` object
- **Error Handling**: Comprehensive token validation with detailed error messages

#### 5. Image Storage Service (`image_storage_service.py`)
**Purpose**: Supabase Storage integration with automated cleanup

**Storage Strategy**:
- **User Folders**: `{user_id}/{file_id}.{extension}`
- **Anonymous Support**: Temporary storage with 24-hour cleanup
- **Metadata Tracking**: File paths stored in database for cleanup
- **Automated Cleanup**: Scheduled removal of anonymous images

### Database Schema

#### Core Tables
- **`user_profiles`**: Extended user information with preferences
- **`search_sessions`**: Image processing sessions with status tracking
- **`clothing_items`**: Identified clothing pieces with metadata
- **`products`**: Individual product results with pricing and ratings
- **`user_saved_items`**: Wishlist items with notes and tags
- **`user_collections`**: User-created collections with privacy settings
- **`collection_items`**: Collection membership with positioning
- **`user_search_history`**: Search tracking with soft deletion

#### Key Features
- **Row-Level Security (RLS)**: Complete data isolation by user
- **Automatic Triggers**: Profile and collection creation on signup
- **Comprehensive Indexing**: Optimized for all query patterns
- **Soft Deletion**: History items can be hidden/restored
- **UUID Primary Keys**: Prevents ID enumeration attacks

## Frontend Architecture

### Component System

#### Core UI Components (`/src/components/ui/`)
- **`ImageUpload`**: Advanced drag-drop with modal preview
- **`RecommendationsDisplay`**: Tabbed interface for grouped product results
- **`ProductCard`**: Rich product display with save/shop actions
- **`Button`**: Consistent button system with variants and loading states
- **`Dialog`**: Modal system for forms and confirmations
- **`Toast`**: Notification system with queue management
- **`Skeleton`**: Loading states for improved perceived performance

#### Feature Components

**Authentication** (`/src/components/auth/`):
- **`AuthModal`**: Unified modal for all authentication flows
- **`LoginForm`**: Email/password login with comprehensive validation
- **`SignupForm`**: User registration with profile creation
- **`ForgotPasswordForm`**: Password reset with email verification

**Wishlist** (`/src/components/wishlist/`):
- **`WishlistGrid`**: Responsive grid with filtering and infinite scroll
- **`WishlistCard`**: Individual item cards with actions and metadata
- **`WishlistFilters`**: Advanced filtering controls with price ranges
- **`WishlistActions`**: Bulk operation controls with progress feedback

**Search History** (`/src/components/history/`):
- **`SearchHistoryGrid`**: Grid layout with sorting and filtering
- **`SearchHistoryCard`**: Individual search result cards with metadata
- **`SearchHistoryFilters`**: Comprehensive sorting and filtering controls
- **`ConfirmDeleteDialog`**: Deletion confirmation with undo options

**Collections** (`/src/components/collections/`):
- **`CollectionCard`**: Individual collection display with item previews
- **`CreateCollectionModal`**: New collection creation with cover images
- **`EditCollectionModal`**: Collection editing with privacy controls
- **`AddToCollectionModal`**: Item addition with collection selection

### State Management

#### Context Providers
- **`AuthContext`**: User authentication and profile management
- **`HistoryContext`**: Search history events and deletion coordination
- **`NavigationContext`**: Route tracking and loading states

#### Custom Hooks
- **`useWishlist`**: Complete wishlist management with optimistic updates
- **`useSearchHistory`**: Search history with bulk operations and undo
- **`useCollections`**: Collection CRUD with item management
- **`useNetwork`**: Network status awareness for offline functionality
- **`usePageVisibility`**: Page visibility detection for performance

### Type System (`/src/types/index.ts`)
**400+ lines of comprehensive TypeScript definitions**:
- **API Response Types**: Complete backend integration types
- **UI Component Types**: Props and state definitions
- **Data Entity Types**: Product, user, collection, and history types
- **Form Types**: Validation and submission types

## AI/ML Pipeline Details

### Google Gemini Integration
**System Prompt**: Sophisticated fashion expertise with 100+ lines of detailed instructions
- **Priority Framework**: Item type → Visual characteristics → Distinctive details → Style context
- **Search Strategy**: Optimized for Google Shopping algorithms
- **Brand Recognition**: Specific brand and product name identification
- **Fashion Terminology**: Industry-standard vocabulary usage

### Query Generation
**Format**: JSON array of 10-15 word search queries
- **Gender Specification**: "women's", "men's", "unisex" prefixes
- **Precise Descriptors**: Color, pattern, silhouette, material
- **Searchable Features**: Focus on retailer-common terms
- **Fallback Handling**: Robust error handling for invalid responses

### Product Search
**SerpAPI Integration**: Parallel processing with error isolation
- **Concurrent Requests**: Up to 5 parallel searches
- **Rate Limiting**: Respectful API usage patterns
- **Error Handling**: Individual query failures don't break pipeline
- **Result Aggregation**: Intelligent merging of search results

### Data Processing
**Comprehensive Cleaning**: 500+ lines of product normalization
- **Price Parsing**: Multiple currency and format support
- **Rating Normalization**: 0-5 scale standardization
- **Image Selection**: Best quality image URL selection
- **Discount Calculation**: Automatic percentage calculation
- **Tag Extraction**: Sale and promotion tag identification

## Performance & Optimization

### Frontend Performance
- **React.memo**: Memoized components prevent unnecessary re-renders
- **useMemo/useCallback**: Optimized hook dependencies
- **Image Lazy Loading**: Skeleton screens during loading
- **Infinite Scroll**: Efficient pagination with intersection observer
- **Bundle Analysis**: Webpack bundle optimization

### Backend Performance
- **Parallel Processing**: Concurrent API calls for product search
- **Database Indexing**: Optimized queries for all access patterns
- **Connection Pooling**: Efficient Supabase connection management
- **Caching Headers**: Proper cache control for static assets
- **Response Compression**: Gzip compression for large responses

### Network Resilience
- **Offline Support**: Network-aware operations with queuing
- **Retry Logic**: Automatic retry for failed operations
- **Optimistic Updates**: Instant UI feedback with rollback
- **Graceful Degradation**: Fallback functionality for network issues

## Security Implementation

### Authentication Security
- **JWT Validation**: Proper signature and expiration verification
- **Row-Level Security**: Database access isolated by user
- **Token Refresh**: Automatic token refresh handling
- **Session Management**: Secure session storage and cleanup

### Data Protection
- **Input Validation**: Comprehensive validation at all layers
- **File Type Validation**: Secure file upload handling
- **XSS Prevention**: Sanitized output and CSP headers
- **CORS Configuration**: Environment-specific origin controls

### Storage Security
- **Supabase Storage**: Secure file storage with access policies
- **Anonymous Cleanup**: Automatic removal of temporary files
- **Path Validation**: Secure file path handling
- **Size Limits**: Upload size restrictions (16MB)

## Development Workflow

### Code Organization
- **Service Layer**: Clear separation of concerns
- **Component Composition**: Reusable, composable components
- **Type Safety**: Comprehensive TypeScript coverage
- **Error Boundaries**: Graceful error handling at multiple levels

### Testing Strategy
- **Backend Testing**: `search_test.py` for search functionality
- **Collections Testing**: `run_collections_tests.py` for collections
- **Frontend Testing**: Component and integration tests
- **API Testing**: Comprehensive endpoint testing

### Deployment
- **Backend**: Railway deployment with Gunicorn
- **Frontend**: Vercel deployment with optimizations
- **Database**: Supabase managed PostgreSQL
- **Storage**: Supabase Storage with CDN

## Common Development Patterns

### Error Handling
- **Structured Errors**: Consistent error response format
- **User-Friendly Messages**: Clear error communication
- **Logging**: Comprehensive error logging for debugging
- **Fallback UI**: Graceful degradation for error states

### Data Flow
- **Optimistic Updates**: Immediate UI feedback
- **Rollback Mechanisms**: Error recovery patterns
- **Loading States**: Progressive loading indicators
- **Cache Invalidation**: Smart cache management

### API Design
- **RESTful Endpoints**: Consistent API design patterns
- **Pagination**: Efficient data loading
- **Filtering**: Comprehensive filtering capabilities
- **Sorting**: Multi-column sorting support

## Key Technical Considerations

### Scalability
- **Database Partitioning**: User-based data organization
- **Caching Strategy**: Multi-level caching implementation
- **API Rate Limiting**: Respectful third-party API usage
- **Resource Optimization**: Memory and CPU optimization

### Maintainability
- **Code Documentation**: Comprehensive inline documentation
- **Type Definitions**: Strong typing throughout
- **Component Patterns**: Consistent component architecture
- **Service Abstraction**: Clean service layer separation

### User Experience
- **Progressive Enhancement**: Works without JavaScript
- **Accessibility**: ARIA labels and keyboard navigation
- **Mobile Optimization**: Responsive design patterns
- **Performance Monitoring**: Real-time performance tracking

This architecture provides a robust, scalable, and maintainable foundation for the FitFind application, with comprehensive features for fashion discovery, user management, and AI-powered recommendations.
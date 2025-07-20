"use client";

import { useState, useEffect } from "react";
import { FolderHeart, Search, Sparkles, Stars, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections } from "@/hooks/useCollections";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollectionCard, CreateCollectionModal } from "@/components/collections";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

type CreateCollectionModalState =
  | { isOpen: false }
  | { isOpen: true }

export default function CollectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [createModalState, setCreateModalState] = useState<CreateCollectionModalState>({ isOpen: false });
  const [searchQuery, setSearchQuery] = useState("");

  const {
    collections,
    loading,
    error,
    fetchCollections,
    createNewCollection,
    hasCollections,
    isEmpty
  } = useCollections({
    autoFetch: true
  });

  // Filter collections based on search query
  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (collection.description && collection.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Show loading state while checking authentication or loading collections
  if (authLoading || (loading.isLoading && collections.length === 0)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex justify-center pt-32">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-purple-600 rounded-full animate-spin animate-reverse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show authentication required message if not signed in
  if (!user) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
          <div className="flex items-center justify-center min-h-screen p-8">
            <div className="text-center max-w-md">
              {/* AI-themed icon */}
              <div className="relative mb-8 mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-[#6b7f3a]/20 rounded-full blur-xl"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-[#6b7f3a]/10 rounded-full flex items-center justify-center border border-primary/20">
                  <FolderHeart className="w-10 h-10 text-primary" />
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-[#6b7f3a] animate-pulse" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-4">
                Your Style Collections
              </h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Create an account to organize your fashion finds into beautiful collections, discover new trends, and build your perfect wardrobe.
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                  className="w-full bg-gradient-to-r from-primary to-[#6b7f3a] hover:from-primary/90 hover:to-[#6b7f3a]/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Your Style Journey
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                  className="w-full border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
                  size="lg"
                >
                  Welcome Back
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {modalState.isOpen && (
          <AuthModal 
            open={modalState.isOpen} 
            onOpenChange={(open) => setModalState(open ? modalState : { isOpen: false })}
            defaultMode={modalState.mode}
          />
        )}
      </>
    );
  }

  const handleCreateCollection = async (name: string, description?: string, isPrivate?: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      await createNewCollection(name, description, false);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create collection. Please try again.';
      return { success: false, error: errorMessage };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-7xl mx-auto p-8">
        {/* Modern Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-[#6b7f3a]/20 rounded-xl flex items-center justify-center">
                    <FolderHeart className="w-5 h-5 text-primary" />
                  </div>
                  <Stars className="absolute -top-1 -right-1 w-4 h-4 text-[#6b7f3a] animate-pulse" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-[#6b7f3a] bg-clip-text text-transparent">
                  Your Collections
                </h1>
              </div>
            </div>

            {/* Create Collection Button */}
            <Button
              onClick={() => setCreateModalState({ isOpen: true })}
              className="bg-gradient-to-r from-primary to-[#6b7f3a] hover:from-primary/90 hover:to-[#6b7f3a]/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Collection
            </Button>
          </div>

          {/* Search Bar */}
          {hasCollections && (
            <div className="relative max-w-2xl">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search your collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-background/50 border-border/50 focus:border-primary/50 focus:bg-background transition-all duration-300"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading.isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-purple-600 rounded-full animate-spin animate-reverse"></div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error.hasError && (
          <div className="text-center py-12">
            <div className="text-destructive mb-4">⚠️ {error.message}</div>
            <Button onClick={fetchCollections} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading.isLoading && !error.hasError && isEmpty && (
          <div className="text-center py-12">
            <div className="relative mb-8 mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-[#6b7f3a]/20 rounded-full blur-xl"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-[#6b7f3a]/10 rounded-full flex items-center justify-center border border-primary/20">
                <FolderHeart className="w-10 h-10 text-primary" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold mb-4">Start Your First Collection</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
              Organize your saved fashion items into beautiful collections. Create themed groups like &quot;Work Outfits&quot;, &quot;Summer Essentials&quot;, or &quot;Dream Closet&quot;.
            </p>
            
            <Button
              onClick={() => setCreateModalState({ isOpen: true })}
              className="bg-gradient-to-r from-primary to-[#6b7f3a] hover:from-primary/90 hover:to-[#6b7f3a]/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Collection
            </Button>
          </div>
        )}

        {/* Collections Grid */}
        {!loading.isLoading && !error.hasError && hasCollections && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCollections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>
        )}

        {/* No Search Results */}
        {!loading.isLoading && !error.hasError && hasCollections && filteredCollections.length === 0 && searchQuery && (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold mb-2">No collections found</h3>
            <p className="text-muted-foreground mb-4">
              No collections match &quot;{searchQuery}&quot;. Try a different search term.
            </p>
            <Button onClick={() => setSearchQuery("")} variant="outline">
              Clear Search
            </Button>
          </div>
        )}
      </div>

      {/* Create Collection Modal */}
      <CreateCollectionModal
        open={createModalState.isOpen}
        onOpenChange={(open) => setCreateModalState({ isOpen: open })}
        onCreateCollection={handleCreateCollection}
      />
    </div>
  );
}
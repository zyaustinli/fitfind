"use client";

import { useState, useEffect } from "react";
import { FolderHeart, Sparkles, Stars, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections } from "@/hooks/useCollections";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { CollectionCard, CreateCollectionModal } from "@/components/collections";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

type CreateCollectionModalState =
  | { isOpen: false }
  | { isOpen: true }

export default function WishlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [createModalState, setCreateModalState] = useState<CreateCollectionModalState>({ isOpen: false });

  // Debug logging for wishlist page auth state
  useEffect(() => {
    console.log('💖 Wishlist page auth state:', {
      hasUser: !!user,
      userEmail: user?.email,
      authLoading,
      timestamp: new Date().toISOString()
    });
  }, [user, authLoading]);

  const {
    collections,
    loading,
    error,
    fetchCollections,
    createNewCollection,
    hasCollections,
    isEmpty
  } = useCollections({
    autoFetch: !!user
  });

  // Show loading state while checking authentication
  if (authLoading) {
    console.log('💖 Wishlist showing loading state');
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="flex h-screen items-center justify-center">
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
    console.log('💖 Wishlist showing sign-in required');
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
          <div className="flex items-center justify-center min-h-screen p-8">
            <div className="text-center max-w-md">
              {/* AI-themed icon */}
              <div className="relative mb-8 mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-red-600/20 rounded-full blur-xl"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-pink-500/10 to-red-600/10 rounded-full flex items-center justify-center border border-pink-500/20">
                  <FolderHeart className="w-10 h-10 text-pink-600" />
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-red-600 animate-pulse" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-pink-600 bg-clip-text text-transparent mb-4">
                Your Collections
              </h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Create an account to save your favorite fashion finds, organize them into collections, and never lose track of items you love.
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                  className="w-full bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-600/90 hover:to-red-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Your Collections
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                  className="w-full border-pink-500/20 hover:border-pink-500/40 hover:bg-pink-500/5 transition-all duration-300"
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
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500/20 to-red-600/20 rounded-xl flex items-center justify-center">
                    <FolderHeart className="w-5 h-5 text-pink-600" />
                  </div>
                  <Stars className="absolute -top-1 -right-1 w-4 h-4 text-red-600 animate-pulse" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-pink-600 to-red-600 bg-clip-text text-transparent">
                  Your Collections
                </h1>
              </div>
              <p className="text-muted-foreground">
                {collections.length > 0 ? `${collections.length} collection${collections.length === 1 ? '' : 's'}` : 'No collections yet'}
              </p>
            </div>

            {/* Create Collection Button */}
            <Button
              onClick={() => setCreateModalState({ isOpen: true })}
              className="bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-600/90 hover:to-red-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              size="lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Collection
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {loading.isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-pink-500/20 border-t-pink-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-t-red-600 rounded-full animate-spin animate-reverse"></div>
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
          <div className="text-center py-16">
            <div className="relative mb-8 mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-red-600/20 rounded-full blur-xl"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-pink-500/10 to-red-600/10 rounded-full flex items-center justify-center border border-pink-500/20">
                <FolderHeart className="w-10 h-10 text-pink-600" />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold mb-4">Start Your First Collection</h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
              Organize your saved fashion items into beautiful collections. Create themed groups like &quot;Work Outfits&quot;, &quot;Summer Essentials&quot;, or &quot;Dream Closet&quot;.
            </p>
            
            <Button
              onClick={() => setCreateModalState({ isOpen: true })}
              className="bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-600/90 hover:to-red-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
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
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
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

 
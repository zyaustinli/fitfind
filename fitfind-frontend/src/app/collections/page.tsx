"use client";

import { useState, useEffect } from "react";
import { FolderHeart, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCollections } from "@/hooks";
import { AuthModal } from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { 
  CollectionGrid, 
  CollectionFilters, 
  CollectionModal,
  type CollectionFiltersState 
} from "@/components/collections";
import type { Collection } from "@/types";
import { useRouter } from "next/navigation";

type ModalState = 
  | { isOpen: false }
  | { isOpen: true; mode: 'login' | 'signup' }

export default function CollectionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [modalState, setModalState] = useState<ModalState>({ isOpen: false });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Collection state and filters
  const [filters, setFilters] = useState<CollectionFiltersState>({
    searchQuery: undefined,
    sortBy: 'newest',
    isPrivate: undefined,
    viewMode: 'grid',
    showCreateModal: false,
    showEditModal: false
  });

  const {
    collections,
    filteredCollections,
    totalCount,
    loading,
    error,
    hasMore,
    createNewCollection,
    updateExistingCollection,
    deleteExistingCollection,
    loadMore,
    operations
  } = useCollections({
    autoFetch: !!user,
    initialLimit: 20
  });

  // Show loading state while checking authentication
  if (authLoading) {
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
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
          <div className="flex items-center justify-center min-h-screen p-8">
            <div className="text-center max-w-md">
              {/* Collections-themed icon */}
              <div className="relative mb-8 mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-full blur-xl"></div>
                <div className="relative w-24 h-24 bg-gradient-to-br from-primary/10 to-purple-600/10 rounded-full flex items-center justify-center border border-primary/20">
                  <FolderHeart className="w-10 h-10 text-primary" />
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-purple-600 animate-pulse" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent mb-4">
                Organize Your Style
              </h1>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Create collections to organize your saved items by style, occasion, or any way you like. 
                Sign in to start building your personalized fashion collections.
              </p>
              
              <div className="space-y-3">
                <Button 
                  onClick={() => setModalState({ isOpen: true, mode: 'signup' })}
                  className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Start Organizing
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => setModalState({ isOpen: true, mode: 'login' })}
                  className="w-full border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
                  size="lg"
                >
                  Sign In
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

  // Event handlers
  const handleCreateCollection = async (data: any) => {
    await createNewCollection(data.name, { 
      description: data.description, 
      is_private: data.is_private 
    });
    setShowCreateModal(false);
  };

  const handleEditCollection = (collection: Collection) => {
    setEditingCollection(collection);
  };

  const handleUpdateCollection = async (data: any) => {
    if (editingCollection) {
      await updateExistingCollection(editingCollection.id, data);
      setEditingCollection(null);
    }
  };

  const handleDeleteCollection = async (collection: Collection) => {
    if (window.confirm(`Are you sure you want to delete "${collection.name}"? This action cannot be undone.`)) {
      await deleteExistingCollection(collection.id);
    }
  };

  const handleCollectionClick = (collection: Collection) => {
    router.push(`/collections/${collection.id}`);
  };

  const handleShareCollection = async (collection: Collection) => {
    const url = `${window.location.origin}/collections/${collection.id}`;
    try {
      await navigator.clipboard.writeText(url);
      // Could add a toast here
      console.log('Collection URL copied to clipboard');
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleSelectionChange = (collection: Collection, selected: boolean) => {
    setSelectedCollections(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(collection.id);
      } else {
        newSet.delete(collection.id);
      }
      
      setShowBulkActions(newSet.size > 0);
      return newSet;
    });
  };

  const handleFiltersChange = (newFilters: Partial<CollectionFiltersState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: undefined,
      sortBy: 'newest',
      isPrivate: undefined,
      viewMode: 'grid',
      showCreateModal: false,
      showEditModal: false
    });
  };

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
                My Collections
              </h1>
              <p className="text-muted-foreground mt-2 text-sm md:text-base">
                Organize your saved items into beautiful collections
              </p>
            </div>
            
            <Button 
              onClick={() => setShowCreateModal(true)}
              className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              aria-label="Create a new collection"
              title="Create a new collection to organize your items"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Collection
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <CollectionFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onResetFilters={handleResetFilters}
              totalCount={totalCount}
            />
          </div>

          {/* Collections Grid */}
          <CollectionGrid
            collections={filteredCollections}
            isLoading={loading.isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onCollectionClick={handleCollectionClick}
            onCreateCollection={() => setShowCreateModal(true)}
            onEditCollection={handleEditCollection}
            onDeleteCollection={handleDeleteCollection}
            onShareCollection={handleShareCollection}
            selectedCollections={selectedCollections}
            onSelectionChange={handleSelectionChange}
            showSelection={showBulkActions}
            filters={filters}
          />

          {/* Error State */}
          {error.hasError && (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error.message}</p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Collection Modal */}
      <CollectionModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={handleCreateCollection}
        isLoading={operations.isCreating}
        title="Create New Collection"
      />

      {/* Edit Collection Modal */}
      <CollectionModal
        open={!!editingCollection}
        onOpenChange={(open) => !open && setEditingCollection(null)}
        onSubmit={handleUpdateCollection}
        collection={editingCollection || undefined}
        isLoading={operations.isUpdating}
        title="Edit Collection"
      />
    </>
  );
} 
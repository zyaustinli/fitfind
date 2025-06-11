"use client";

import { useState, useEffect } from "react";
import { X, Plus, FolderPlus, Loader2, Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCollections } from "@/hooks/useCollections";
import type { Collection, WishlistItemDetailed } from "@/types";

interface AddToCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WishlistItemDetailed | null;
  onSuccess?: () => void;
}

export function AddToCollectionModal({ 
  open, 
  onOpenChange, 
  item,
  onSuccess 
}: AddToCollectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  const {
    collections,
    loading: collectionsLoading,
    error: collectionsError,
    fetchCollections,
    createNewCollection,
    addToCollection
  } = useCollections();

  // Filter collections based on search query
  const filteredCollections = collections.filter(collection =>
    collection.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (collection.description && collection.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedCollections(new Set());
      setSearchQuery("");
      setError("");
      setShowCreateNew(false);
      setNewCollectionName("");
      fetchCollections();
    }
  }, [open, fetchCollections]);

  if (!open || !item) return null;

  const handleCollectionToggle = (collectionId: string) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(collectionId)) {
      newSelected.delete(collectionId);
    } else {
      newSelected.add(collectionId);
    }
    setSelectedCollections(newSelected);
  };

  const handleCreateAndAdd = async () => {
    if (!newCollectionName.trim()) {
      setError("Collection name is required");
      return;
    }

    try {
      setLoading(true);
      const newCollection = await createNewCollection(newCollectionName.trim());
      
      if (newCollection) {
        // Add the new collection to selected collections
        setSelectedCollections(prev => new Set([...prev, newCollection.id]));
        setShowCreateNew(false);
        setNewCollectionName("");
      } else {
        setError("Failed to create collection");
      }
    } catch (err) {
      setError("An error occurred while creating the collection");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCollections = async () => {
    if (selectedCollections.size === 0) {
      setError("Please select at least one collection");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Add item to each selected collection
      const promises = Array.from(selectedCollections).map(collectionId =>
        addToCollection(collectionId, item.id)
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(Boolean).length;

      if (successCount === selectedCollections.size) {
        // All additions successful
        onSuccess?.();
        onOpenChange(false);
      } else if (successCount > 0) {
        // Some successful, some failed
        setError(`Added to ${successCount} of ${selectedCollections.size} collections`);
      } else {
        // All failed
        setError("Failed to add item to collections");
      }
    } catch (err) {
      setError("An error occurred while adding to collections");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Add to Collections</h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClose}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Item Preview */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <img 
              src={item.products.image_url || '/placeholder-image.jpg'} 
              alt={item.products.title}
              className="w-12 h-12 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm line-clamp-1">{item.products.title}</h3>
              <p className="text-xs text-muted-foreground">
                {item.products.source} • {item.products.price || 'Price not available'}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search and Create */}
          <div className="p-4 border-b border-border space-y-3">
            {/* Search Collections */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections..."
                className="pl-10"
                disabled={loading}
              />
            </div>

            {/* Create New Collection Toggle */}
            {!showCreateNew ? (
              <Button
                onClick={() => setShowCreateNew(true)}
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                disabled={loading}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Collection
              </Button>
            ) : (
              <div className="space-y-2">
                <Input
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="New collection name..."
                  disabled={loading}
                  maxLength={100}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateAndAdd}
                    size="sm"
                    disabled={loading || !newCollectionName.trim()}
                    className="flex-1"
                  >
                    {loading ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3 mr-1" />
                    )}
                    Create
                  </Button>
                  <Button
                    onClick={() => setShowCreateNew(false)}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Collections List */}
          <div className="flex-1 overflow-y-auto p-4">
            {collectionsLoading.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : collectionsError.hasError ? (
              <div className="text-center py-8">
                <p className="text-sm text-destructive">{collectionsError.message}</p>
                <Button onClick={fetchCollections} variant="outline" size="sm" className="mt-2">
                  Try Again
                </Button>
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No collections match your search" : "No collections found"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCollections.map((collection) => (
                  <div
                    key={collection.id}
                    onClick={() => handleCollectionToggle(collection.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCollections.has(collection.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedCollections.has(collection.id)
                          ? 'border-primary bg-primary'
                          : 'border-border'
                      }`}>
                        {selectedCollections.has(collection.id) && (
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium line-clamp-1">{collection.name}</h3>
                        {collection.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {collection.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {collection.item_count || 0}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Selected Collections Summary */}
          {selectedCollections.size > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">
                Adding to {selectedCollections.size} collection{selectedCollections.size !== 1 ? 's' : ''}:
              </p>
              <div className="flex flex-wrap gap-1">
                {Array.from(selectedCollections).slice(0, 3).map(id => {
                  const collection = collections.find(c => c.id === id);
                  return collection ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {collection.name}
                    </Badge>
                  ) : null;
                })}
                {selectedCollections.size > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selectedCollections.size - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              onClick={handleClose}
              variant="outline" 
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddToCollections}
              className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              disabled={loading || selectedCollections.size === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Add to Collections
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
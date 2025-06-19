"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Collection } from "@/types";

interface DeleteCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: Collection;
  onDeleteCollection: (id: string) => Promise<boolean>;
}

export function DeleteCollectionModal({ 
  open, 
  onOpenChange, 
  collection,
  onDeleteCollection 
}: DeleteCollectionModalProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleDelete = async () => {
    setLoading(true);

    try {
      const success = await onDeleteCollection(collection.id);
      if (success) {
        onOpenChange(false);
      }
    } catch (err) {
      console.error('Failed to delete collection:', err);
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
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-border">
          <div className="w-8 h-8 bg-destructive/10 rounded-lg flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Delete Collection</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-muted-foreground">
            Are you sure you want to delete <strong>"{collection.name}"</strong>?
          </p>
          
          <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  This action cannot be undone
                </p>
                <p className="text-sm text-muted-foreground">
                  All items in this collection will be permanently removed from the collection, 
                  but they will remain in your wishlist.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <Button 
            type="button"
            onClick={handleClose}
            variant="outline" 
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete}
            variant="destructive"
            className="flex-1"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Collection
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
} 
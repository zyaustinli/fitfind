"use client";

import { useState, useEffect } from "react";
import { X, Edit3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Collection } from "@/types";

interface EditCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection: Collection;
  onUpdateCollection: (id: string, name: string, description?: string, isPrivate?: boolean) => Promise<boolean>;
}

export function EditCollectionModal({ 
  open, 
  onOpenChange, 
  collection,
  onUpdateCollection 
}: EditCollectionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPrivate: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form data when modal opens or collection changes
  useEffect(() => {
    if (open && collection) {
      setFormData({
        name: collection.name,
        description: collection.description || '',
        isPrivate: false
      });
      setError('');
    }
  }, [open, collection]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Collection name is required');
      return;
    }

    if (formData.name.trim().length < 2) {
      setError('Collection name must be at least 2 characters long');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await onUpdateCollection(
        collection.id,
        formData.name.trim(),
        formData.description.trim() || undefined,
        false
      );
      
      if (success) {
        onOpenChange(false);
      } else {
        setError('Failed to update collection. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError('');
      onOpenChange(false);
    }
  };

  const hasChanges = 
    formData.name !== collection.name ||
    formData.description !== (collection.description || '');

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center">
              <Edit3 className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Edit Collection</h2>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Collection Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-collection-name" className="text-sm font-medium">
              Collection Name *
            </Label>
            <Input
              id="edit-collection-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Summer Essentials, Work Outfits..."
              disabled={loading}
              className="focus:border-primary/50"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              {formData.name.length}/100 characters
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-collection-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="edit-collection-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe what this collection is about... (optional)"
              disabled={loading}
              className="resize-none focus:border-primary/50"
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/500 characters
            </p>
          </div>



          {/* Error Message */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
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
              type="submit"
              className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              disabled={loading || !formData.name.trim() || !hasChanges}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Update Collection
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 
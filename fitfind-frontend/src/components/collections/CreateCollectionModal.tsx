"use client";

import { useState } from "react";
import { X, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CreateCollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateCollection: (name: string, description?: string, isPrivate?: boolean) => Promise<boolean>;
}

export function CreateCollectionModal({ 
  open, 
  onOpenChange, 
  onCreateCollection 
}: CreateCollectionModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPrivate: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const success = await onCreateCollection(
        formData.name.trim(),
        formData.description.trim() || undefined,
        formData.isPrivate
      );
      
      if (success) {
        // Reset form and close modal
        setFormData({ name: '', description: '', isPrivate: false });
        onOpenChange(false);
      } else {
        setError('Failed to create collection. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({ name: '', description: '', isPrivate: false });
      setError('');
      onOpenChange(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-md w-full animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Create New Collection</h2>
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
            <Label htmlFor="collection-name" className="text-sm font-medium">
              Collection Name *
            </Label>
            <Input
              id="collection-name"
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
            <Label htmlFor="collection-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="collection-description"
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

          {/* Privacy Setting */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="collection-private"
              checked={formData.isPrivate}
              onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
              disabled={loading}
              className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary focus:ring-2"
            />
            <div className="space-y-1">
              <Label htmlFor="collection-private" className="text-sm font-medium cursor-pointer">
                Private Collection
              </Label>
              <p className="text-xs text-muted-foreground">
                Only you can see private collections
              </p>
            </div>
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
              disabled={loading || !formData.name.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Create Collection
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
} 
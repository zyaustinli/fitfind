"use client";

import { useState, useCallback } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  Loader2, 
  Upload, 
  X, 
  Eye, 
  EyeOff,
  Check,
  AlertCircle 
} from "lucide-react";
import type { Collection, CollectionCreateRequest, CollectionUpdateRequest } from "@/types";

interface CollectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CollectionCreateRequest | CollectionUpdateRequest) => Promise<void>;
  collection?: Collection; // For editing
  isLoading?: boolean;
  title?: string;
}

export function CollectionModal({
  open,
  onOpenChange,
  onSubmit,
  collection,
  isLoading = false,
  title
}: CollectionModalProps) {
  const isEditing = !!collection;
  
  // Form state
  const [formData, setFormData] = useState({
    name: collection?.name || '',
    description: collection?.description || '',
    cover_image_url: collection?.cover_image_url || '',
    is_private: collection?.is_private || false
  });
  
  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(
    collection?.cover_image_url || null
  );
  const [imageLoading, setImageLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Collection name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Collection name must be at least 2 characters';
    } else if (formData.name.trim().length > 50) {
      newErrors.name = 'Collection name must be less than 50 characters';
    }
    
    if (formData.description && formData.description.length > 200) {
      newErrors.description = 'Description must be less than 200 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, image: 'Please select a valid image file' }));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, image: 'Image size must be less than 5MB' }));
      return;
    }

    setImageLoading(true);
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.image;
      return newErrors;
    });

    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        setFormData(prev => ({ ...prev, cover_image_url: result }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setErrors(prev => ({ ...prev, image: 'Failed to upload image' }));
    } finally {
      setImageLoading(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData(prev => ({ ...prev, cover_image_url: '' }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    
    if (!validateForm()) {
      return;
    }

    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description?.trim() || undefined,
        cover_image_url: formData.cover_image_url || undefined,
        is_private: formData.is_private
      };

      await onSubmit(submitData);
      onOpenChange(false);
      
      // Reset form if creating new collection
      if (!isEditing) {
        setFormData({
          name: '',
          description: '',
          cover_image_url: '',
          is_private: false
        });
        setImagePreview(null);
        setErrors({});
        setSubmitAttempted(false);
      }
    } catch (error) {
      console.error('Failed to save collection:', error);
      setErrors(prev => ({ 
        ...prev, 
        submit: 'Failed to save collection. Please try again.' 
      }));
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      // Reset form state on close
      if (!isEditing) {
        setFormData({
          name: '',
          description: '',
          cover_image_url: '',
          is_private: false
        });
        setImagePreview(null);
      } else if (collection) {
        setFormData({
          name: collection.name,
          description: collection.description || '',
          cover_image_url: collection.cover_image_url || '',
          is_private: collection.is_private
        });
        setImagePreview(collection.cover_image_url || null);
      }
      setErrors({});
      setSubmitAttempted(false);
    }
  };

  const modalTitle = title || (isEditing ? 'Edit Collection' : 'Create Collection');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          <DialogClose />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Collection Name */}
          <div className="space-y-2">
            <Label htmlFor="collection-name">
              Collection Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="collection-name"
              type="text"
              placeholder="Enter collection name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={cn(
                errors.name && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isLoading}
              maxLength={50}
            />
            {errors.name && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.name}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.name.length}/50 characters
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="collection-description">Description</Label>
            <textarea
              id="collection-description"
              placeholder="Describe your collection (optional)"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={cn(
                "flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
                errors.description && "border-destructive focus-visible:ring-destructive"
              )}
              disabled={isLoading}
              maxLength={200}
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/200 characters
            </p>
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <Label>Cover Image</Label>
            
            {imagePreview ? (
              <div className="relative">
                <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imagePreview}
                    alt="Collection cover"
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveImage}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isLoading || imageLoading}
                />
                <div className={cn(
                  "aspect-video rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center bg-muted/25 hover:bg-muted/50 transition-colors",
                  (isLoading || imageLoading) && "opacity-50 cursor-not-allowed"
                )}>
                  {imageLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground text-center">
                        Click to upload cover image<br />
                        <span className="text-xs">PNG, JPG up to 5MB</span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {errors.image && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.image}
              </p>
            )}
          </div>

          {/* Privacy Setting */}
          <div className="space-y-3">
            <Label>Privacy</Label>
            <div className="space-y-3">
              <div 
                className={cn(
                  "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  !formData.is_private ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                )}
                onClick={() => handleInputChange('is_private', false)}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  !formData.is_private ? "border-primary bg-primary" : "border-border"
                )}>
                  {!formData.is_private && <div className="w-2 h-2 rounded-full bg-background" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span className="font-medium">Public</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Anyone can view this collection</p>
                </div>
              </div>

              <div 
                className={cn(
                  "flex items-center space-x-3 rounded-lg border p-3 cursor-pointer transition-colors",
                  formData.is_private ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                )}
                onClick={() => handleInputChange('is_private', true)}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  formData.is_private ? "border-primary bg-primary" : "border-border"
                )}>
                  {formData.is_private && <div className="w-2 h-2 rounded-full bg-background" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4" />
                    <span className="font-medium">Private</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Only you can view this collection</p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {errors.submit}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || (submitAttempted && Object.keys(errors).length > 0)}
              className="flex-1 gap-2"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Collection'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 
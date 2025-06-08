"use client";

import { useState, useCallback } from "react";
import { Sparkles, Search, AlertCircle, ShoppingBag, RefreshCw, RotateCcw, Upload, ImageIcon } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { RecommendationsDisplay } from "@/components/ui/recommendations-display";
import { Button } from "@/components/ui/button";
import { uploadOutfitImage, redoSearch, ApiError } from "@/lib/api";
import { transformBackendData } from "@/lib/data-transform";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/hooks/useWishlist"; // Import the hook
import type { UploadedImage, ClothingItem, SearchSession } from "@/types";

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [searchSession, setSearchSession] = useState<SearchSession | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);

  const { user } = useAuth();
  const { addItem, removeItem, isInWishlist } = useWishlist({}); // Use the wishlist hook

  const handleImageSelect = useCallback((image: UploadedImage) => {
    setUploadedImage(image);
    setSearchSession(null);
  }, []);

  const handleImageRemove = useCallback(() => {
    setUploadedImage(null);
    setSearchSession(null);
  }, []);

  const handleUploadNewOutfit = useCallback(() => {
    setUploadedImage(null);
    setSearchSession(null);
  }, []);

  const handleFindRecommendations = async () => {
    if (!uploadedImage) return;

    setIsSearching(true);
    
    try {
      const initialSession: SearchSession = {
        id: Date.now().toString(),
        imageUrl: uploadedImage.preview,
        status: 'analyzing',
        queries: [],
        results: [],
        createdAt: new Date()
      };

      setSearchSession(initialSession);

      const response = await uploadOutfitImage(uploadedImage.file, {
        country: 'us',
        language: 'en'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to analyze image');
      }

      const transformedResults = transformBackendData(response.cleaned_data);

      setSearchSession({
        ...initialSession,
        status: 'completed',
        queries: response.search_queries,
        results: transformedResults,
        conversationContext: response.conversation_context,
        backendData: response.cleaned_data,
        fileId: response.file_id,
        sessionId: response.session_id
      });

    } catch (error) {
      console.error('Error analyzing outfit:', error);
      
      let errorMessage = 'Failed to analyze image. Please try again.';
      if (error instanceof ApiError) {
        errorMessage = error.message;
      }

      setSearchSession(prev => prev ? {
        ...prev,
        status: 'error',
        error: errorMessage
      } : null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveItem = useCallback(async (item: ClothingItem) => {
    if (!user) {
      alert('Please sign in to save items to your wishlist.');
      return;
    }
    if (item.product_id) {
      await addItem(item.product_id);
    }
  }, [user, addItem]);

  const handleRemoveItem = useCallback(async (item: ClothingItem) => {
    if (!user) return;
    if (item.product_id) {
      await removeItem(item.product_id);
    }
  }, [user, removeItem]);

  const handleRedoSearch = async () => {
    if (!searchSession?.conversationContext) return;

    setIsRedoing(true);
    
    try {
      const response = await redoSearch(
        searchSession.conversationContext,
        undefined,
        {
          country: 'us',
          language: 'en',
          fileId: searchSession.fileId,
          sessionId: searchSession.sessionId
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to redo search');
      }

      const transformedResults = transformBackendData(response.cleaned_data);

      setSearchSession(prev => prev ? {
        ...prev,
        queries: response.new_queries,
        results: transformedResults,
        conversationContext: response.conversation_context,
        backendData: response.cleaned_data
      } : null);

    } catch (error) {
      console.error('Error redoing search:', error);
      
      let errorMessage = 'Failed to improve search. Please try again.';
      if (error instanceof ApiError) {
        errorMessage = error.message;
      }

      setSearchSession(prev => prev ? {
        ...prev,
        status: 'error',
        error: errorMessage
      } : null);
    } finally {
      setIsRedoing(false);
    }
  };

  return (
    <div className="h-full flex">
      {/* Upload Section */}
      <div className="flex-1 p-8 border-r border-border bg-background">
        <div className="max-w-lg mx-auto h-full flex flex-col">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Upload Your Outfit</h1>
            <p className="text-muted-foreground">
              Let FitFind AI analyze outfits and find similar items!
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <ImageUpload
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              uploadedImage={uploadedImage}
              disabled={isSearching}
              showExpandOnly={searchSession?.status === 'completed'}
            />

            {/* Find Recommendations Button */}
            {uploadedImage && !searchSession && (
              <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Button
                  onClick={handleFindRecommendations}
                  disabled={isSearching}
                  size="lg"
                  className="w-full max-w-xs bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Find Recommendations
                </Button>
              </div>
            )}

            {/* Loading State */}
            {isSearching && (
              <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="relative">
                    <div className="w-6 h-6 border-2 border-primary/30 rounded-full" />
                    <div className="absolute inset-0 w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                  <span className="animate-pulse">Analyzing your outfit...</span>
                </div>
              </div>
            )}

            {/* Action Buttons - Redo and Upload New */}
            {searchSession?.status === 'completed' && (
              <div className="mt-6 flex justify-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <Button
                  onClick={handleRedoSearch}
                  disabled={isRedoing}
                  variant="outline"
                  size="sm"
                  className="group relative overflow-hidden hover:scale-105 transition-all duration-200 hover:shadow-md"
                  title="Redo search with improved queries"
                >
                  {isRedoing ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </Button>
                
                <Button
                  onClick={handleUploadNewOutfit}
                  variant="outline"
                  size="sm"
                  className="group relative overflow-hidden hover:scale-105 transition-all duration-200 hover:shadow-md"
                  title="Upload a new outfit"
                >
                  <Upload className="w-4 h-4 mr-2 group-hover:-translate-y-0.5 transition-transform duration-200" />
                  Upload new outfit
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="flex-1 p-8 bg-gradient-to-br from-muted/30 to-primary/5">
        <div className="h-full flex flex-col">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Your Style Recommendations</h2>
            <p className="text-muted-foreground">
              {searchSession?.results.length
                ? `Found ${searchSession.results.length} similar items for your style`
                : "Upload an outfit photo to discover your perfect matches"
              }
            </p>
          </div>

          <div className="flex-1 overflow-hidden">
            {!searchSession && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                    <ShoppingBag className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No recommendations yet</h3>
                  <p className="text-muted-foreground">
                    Upload an outfit photo to get personalized recommendations
                  </p>
                </div>
              </div>
            )}

            {(searchSession?.status === 'searching' || searchSession?.status === 'analyzing') && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {searchSession.status === 'analyzing' ? 'Analyzing outfit...' : 'Finding recommendations...'}
                  </h3>
                  <p className="text-muted-foreground">
                    This may take a few moments
                  </p>
                </div>
              </div>
            )}

            {searchSession?.status === 'error' && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <ShoppingBag className="w-12 h-12 text-destructive" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Something went wrong</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchSession.error || 'Unable to find recommendations. Please try again.'}
                  </p>
                  <Button
                    onClick={handleUploadNewOutfit}
                    variant="outline"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {searchSession?.status === 'completed' && searchSession.results && (
              <RecommendationsDisplay
                results={searchSession.results}
                backendData={searchSession.backendData}
                onSave={handleSaveItem}
                onRemove={handleRemoveItem}
                isItemSaved={(item: ClothingItem) => item.product_id ? isInWishlist(item.product_id) : false}
              />
            )}

            {searchSession?.status === 'completed' && searchSession.results.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                    <Search className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No items found</h3>
                  <p className="text-muted-foreground mb-4">
                    We couldn&apos;t find any matching items for this outfit. Try a different photo.
                  </p>
                  <Button onClick={handleUploadNewOutfit} variant="outline">
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Upload New Photo
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

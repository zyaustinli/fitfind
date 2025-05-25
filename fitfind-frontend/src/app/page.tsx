"use client";

import { useState, useCallback } from "react";
import { Sparkles, Search, AlertCircle, ShoppingBag, RefreshCw } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { ProductCard } from "@/components/ui/product-card";
import { RecommendationsDisplay } from "@/components/ui/recommendations-display";
import { Button } from "@/components/ui/button";
import { uploadOutfitImage, redoSearch, ApiError } from "@/lib/api";
import { transformBackendData, getDataSummary } from "@/lib/data-transform";
import type { UploadedImage, ClothingItem, SearchSession } from "@/types";

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [searchSession, setSearchSession] = useState<SearchSession | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [redoFeedback, setRedoFeedback] = useState("");

  const handleImageSelect = useCallback((image: UploadedImage) => {
    setUploadedImage(image);
    // Reset search session when new image is uploaded
    setSearchSession(null);
  }, []);

  const handleImageRemove = useCallback(() => {
    setUploadedImage(null);
    setSearchSession(null);
  }, []);

  const handleFindRecommendations = async () => {
    if (!uploadedImage) return;

    setIsSearching(true);
    
    try {
      // Create initial search session
      const initialSession: SearchSession = {
        id: Date.now().toString(),
        imageUrl: uploadedImage.preview,
        status: 'analyzing',
        queries: [],
        results: [],
        createdAt: new Date()
      };

      setSearchSession(initialSession);

      // Call the real backend API
      const response = await uploadOutfitImage(uploadedImage.file, {
        country: 'us', // You can make this configurable
        language: 'en'
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to analyze image');
      }

      // Transform backend data to frontend format
      const transformedResults = transformBackendData(response.cleaned_data);
      const summary = getDataSummary(response.cleaned_data);

      // Update search session with results
      setSearchSession({
        ...initialSession,
        status: 'completed',
        queries: response.search_queries,
        results: transformedResults,
        conversationContext: response.conversation_context,
        backendData: response.cleaned_data,
        fileId: response.file_id  // Store file_id for redo functionality
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

  const handleSaveItem = useCallback((item: ClothingItem) => {
    setSavedItems(prev => new Set([...prev, item.product_id || item.title || '']));
  }, []);

  const handleRemoveItem = useCallback((item: ClothingItem) => {
    setSavedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(item.product_id || item.title || '');
      return newSet;
    });
  }, []);

  const isItemSaved = useCallback((item: ClothingItem) => {
    return savedItems.has(item.product_id || item.title || '');
  }, [savedItems]);

  const handleRedoSearch = async () => {
    if (!searchSession?.conversationContext) return;

    setIsRedoing(true);
    
    try {
      const response = await redoSearch(
        searchSession.conversationContext,
        redoFeedback || undefined,
        {
          country: 'us',
          language: 'en',
          fileId: searchSession.fileId
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to redo search');
      }

      // Transform new results
      const transformedResults = transformBackendData(response.cleaned_data);

      // Update search session with new results
      setSearchSession(prev => prev ? {
        ...prev,
        queries: response.new_queries,
        results: transformedResults,
        conversationContext: response.conversation_context,
        backendData: response.cleaned_data
      } : null);

      // Clear feedback
      setRedoFeedback("");

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
              Let FitFind AI analyze your style and find similar items!
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <ImageUpload
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              uploadedImage={uploadedImage}
              disabled={isSearching}
            />

            {uploadedImage && !searchSession && (
              <div className="mt-6 text-center">
                <Button
                  onClick={handleFindRecommendations}
                  disabled={isSearching}
                  size="lg"
                  className="w-full max-w-xs bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Find Recommendations
                </Button>
              </div>
            )}

            {isSearching && (
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Analyzing your outfit...
                </div>
              </div>
            )}
          </div>

          {/* Improve Results Section */}
          {searchSession?.conversationContext && searchSession?.status === 'completed' && (
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-foreground">Improve Results</h4>
                <Button
                  onClick={handleRedoSearch}
                  disabled={isRedoing}
                  variant="outline"
                  size="sm"
                >
                  {isRedoing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Improving...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Improve Search
                    </>
                  )}
                </Button>
              </div>
              <textarea
                value={redoFeedback}
                onChange={(e) => setRedoFeedback(e.target.value)}
                placeholder="Describe what you're looking for to improve the search results... (optional)"
                className="w-full p-2 text-sm border rounded resize-none bg-background"
                rows={2}
                disabled={isRedoing}
              />
            </div>
          )}
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
                    {searchSession.status === 'analyzing' ? 'Analyzing your outfit...' : 'Finding similar items...'}
                  </h3>
                  <p className="text-muted-foreground">This might take a few moments</p>
                </div>
              </div>
            )}

            {searchSession?.status === 'error' && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <AlertCircle className="w-12 h-12 text-destructive" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Something went wrong</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchSession.error || "Failed to analyze your outfit. Please try again."}
                  </p>
                  <Button onClick={handleFindRecommendations} variant="outline">
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {searchSession?.status === 'completed' && searchSession.results.length > 0 && (
              <RecommendationsDisplay
                results={searchSession.results}
                backendData={searchSession.backendData}
                onSave={handleSaveItem}
                onRemove={handleRemoveItem}
                isItemSaved={isItemSaved}
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
                  <Button onClick={handleImageRemove} variant="outline">
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

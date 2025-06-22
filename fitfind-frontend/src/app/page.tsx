"use client";

import { useState, useCallback, useEffect } from "react";
import { Sparkles, Search, AlertCircle, ShoppingBag, RefreshCw, RotateCcw, Upload, ImageIcon, Link, Clock } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { RecommendationsDisplay } from "@/components/ui/recommendations-display";
import { ExtractionStatusIndicator } from "@/components/ui/direct-link-indicator";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { uploadOutfitImage, redoSearch, ApiError } from "@/lib/api";
import { transformBackendData } from "@/lib/data-transform";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/hooks/useWishlist";
import { cn } from "@/lib/utils";
import type { UploadedImage, ClothingItem, SearchSession, BackendUploadResponse } from "@/types";

interface ExtendedSearchSession extends SearchSession {
  extractionStatus?: {
    direct_links_extracted?: boolean;
    direct_links_extraction_time?: string;
  };
}

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [searchSession, setSearchSession] = useState<ExtendedSearchSession | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{
    isExtracting: boolean;
    message: string;
    stage: 'analyzing' | 'searching' | 'extracting' | 'saving' | 'complete';
  }>({
    isExtracting: false,
    message: '',
    stage: 'analyzing'
  });

  const { user } = useAuth();
  const { addItem, removeItem, isInWishlist } = useWishlist({});

  const handleImageSelect = useCallback((image: UploadedImage) => {
    setUploadedImage(image);
    setSearchSession(null);
    setExtractionProgress({ isExtracting: false, message: '', stage: 'analyzing' });
  }, []);

  const handleImageRemove = useCallback(() => {
    setUploadedImage(null);
    setSearchSession(null);
    setExtractionProgress({ isExtracting: false, message: '', stage: 'analyzing' });
  }, []);

  const handleUploadNewOutfit = useCallback(() => {
    setUploadedImage(null);
    setSearchSession(null);
    setExtractionProgress({ isExtracting: false, message: '', stage: 'analyzing' });
  }, []);

  const simulateExtractionProgress = useCallback(() => {
    const stages = [
      { stage: 'analyzing' as const, message: 'Analyzing your outfit...', duration: 1000 },
      { stage: 'searching' as const, message: 'Searching for similar items...', duration: 2000 },
      { stage: 'extracting' as const, message: 'Extracting direct retailer links...', duration: 3000 },
      { stage: 'saving' as const, message: 'Saving enhanced product data...', duration: 1000 },
      { stage: 'complete' as const, message: 'Enhancement complete!', duration: 500 },
    ];

    let currentStageIndex = 0;
    
    const advanceStage = () => {
      if (currentStageIndex < stages.length) {
        const currentStage = stages[currentStageIndex];
        setExtractionProgress({
          isExtracting: currentStage.stage !== 'complete',
          message: currentStage.message,
          stage: currentStage.stage
        });

        if (currentStage.stage !== 'complete') {
          setTimeout(() => {
            currentStageIndex++;
            advanceStage();
          }, currentStage.duration);
        }
      }
    };

    advanceStage();
  }, []);

  const handleFindRecommendations = async () => {
    if (!uploadedImage) return;

    setIsSearching(true);
    simulateExtractionProgress();
    
    try {
      const initialSession: ExtendedSearchSession = {
        id: Date.now().toString(),
        imageUrl: uploadedImage.preview,
        status: 'analyzing',
        queries: [],
        results: [],
        createdAt: new Date()
      };

      setSearchSession(initialSession);

      const response: BackendUploadResponse = await uploadOutfitImage(uploadedImage.file, {
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
        sessionId: response.session_id,
        extractionStatus: {
          direct_links_extracted: response.direct_links_extracted,
          direct_links_extraction_time: response.direct_links_extraction_time,
        }
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
      setExtractionProgress({ isExtracting: false, message: '', stage: 'complete' });
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
    setExtractionProgress({
      isExtracting: true,
      message: 'Improving search results...',
      stage: 'extracting'
    });
    
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
        backendData: response.cleaned_data,
        extractionStatus: {
          direct_links_extracted: response.direct_links_extracted,
          direct_links_extraction_time: response.direct_links_extraction_time,
        }
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
      setExtractionProgress({ isExtracting: false, message: '', stage: 'complete' });
    }
  };

  const getProgressIcon = () => {
    switch (extractionProgress.stage) {
      case 'analyzing':
        return <ImageIcon className="h-5 w-5 animate-pulse" />;
      case 'searching':
        return <Search className="h-5 w-5 animate-pulse" />;
      case 'extracting':
        return <Link className="h-5 w-5 animate-pulse" />;
      case 'saving':
        return <ShoppingBag className="h-5 w-5 animate-pulse" />;
      default:
        return <Clock className="h-5 w-5 animate-spin" />;
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
              Let FitFind AI analyze outfits and find similar items with direct retailer links!
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
                <p className="text-xs text-muted-foreground mt-2">
                  Includes direct retailer links extraction
                </p>
              </div>
            )}

            {/* Enhanced Loading State */}
            {(isSearching || extractionProgress.isExtracting) && (
              <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    {getProgressIcon()}
                    <span className="text-lg font-medium text-gray-800">
                      {extractionProgress.message || 'Processing...'}
                    </span>
                  </div>
                  
                  {/* Progress Steps */}
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                    <span className={cn(
                      'flex items-center gap-1',
                      extractionProgress.stage === 'analyzing' && 'text-blue-600 font-medium'
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        extractionProgress.stage === 'analyzing' ? 'bg-blue-600 animate-pulse' : 'bg-gray-300'
                      )} />
                      Analyze
                    </span>
                    <span className={cn(
                      'flex items-center gap-1',
                      extractionProgress.stage === 'searching' && 'text-blue-600 font-medium'
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        ['searching', 'extracting', 'saving', 'complete'].includes(extractionProgress.stage) 
                          ? extractionProgress.stage === 'searching' ? 'bg-blue-600 animate-pulse' : 'bg-green-500'
                          : 'bg-gray-300'
                      )} />
                      Search
                    </span>
                    <span className={cn(
                      'flex items-center gap-1',
                      extractionProgress.stage === 'extracting' && 'text-blue-600 font-medium'
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        ['extracting', 'saving', 'complete'].includes(extractionProgress.stage)
                          ? extractionProgress.stage === 'extracting' ? 'bg-blue-600 animate-pulse' : 'bg-green-500'
                          : 'bg-gray-300'
                      )} />
                      Extract Links
                    </span>
                    <span className={cn(
                      'flex items-center gap-1',
                      extractionProgress.stage === 'saving' && 'text-blue-600 font-medium'
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        ['saving', 'complete'].includes(extractionProgress.stage)
                          ? extractionProgress.stage === 'saving' ? 'bg-blue-600 animate-pulse' : 'bg-green-500'
                          : 'bg-gray-300'
                      )} />
                      Save
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 text-center">
                    This may take a few seconds as we extract direct retailer links...
                  </div>
                </Card>
              </div>
            )}

            {/* Success Message */}
            {searchSession?.status === 'completed' && (
              <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col gap-4">
                  <div className="text-green-700 text-sm font-medium">
                    ✨ Analysis complete! Found {searchSession.results?.length || 0} items
                  </div>
                  
                  {searchSession.extractionStatus && (
                    <div className="flex justify-center">
                      <ExtractionStatusIndicator
                        status={searchSession.extractionStatus.direct_links_extracted ? 'completed' : 'failed'}
                        extractedCount={searchSession.results?.filter(item => item.direct_links?.length).length || 0}
                        totalCount={searchSession.results?.length || 0}
                        size="sm"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleRedoSearch}
                      disabled={isRedoing}
                      variant="outline"
                      size="sm"
                      className="text-primary hover:bg-primary/5"
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-1", isRedoing && "animate-spin")} />
                      {isRedoing ? 'Improving...' : 'Improve Results'}
                    </Button>
                    <Button
                      onClick={handleUploadNewOutfit}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload New
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Error State */}
            {searchSession?.status === 'error' && (
              <div className="mt-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-700 text-sm mb-3">{searchSession.error}</p>
                  <Button
                    onClick={handleFindRecommendations}
                    disabled={isSearching}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 p-8 bg-muted/30">
        {searchSession?.status === 'completed' && searchSession.results && searchSession.results.length > 0 ? (
          <RecommendationsDisplay
            results={searchSession.results}
            backendData={searchSession.backendData}
            onSave={handleSaveItem}
            onRemove={handleRemoveItem}
            isItemSaved={(item) => item.product_id ? isInWishlist(item.product_id) : false}
            extractionMeta={searchSession.extractionStatus}
            showExtractionStatus={true}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="mb-8">
              <ShoppingBag className="h-24 w-24 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">
                Ready to Find Your Style?
              </h3>
              <p className="text-muted-foreground max-w-md">
                Upload an image of your outfit and discover similar items from top retailers with direct shopping links.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground max-w-2xl">
              <div className="flex flex-col items-center p-4 bg-white/50 rounded-lg border border-border/50">
                <ImageIcon className="h-8 w-8 text-blue-500 mb-2" />
                <div className="font-medium mb-1">AI Analysis</div>
                <div className="text-xs text-center">Identifies clothing items and style elements</div>
              </div>
              <div className="flex flex-col items-center p-4 bg-white/50 rounded-lg border border-border/50">
                <Search className="h-8 w-8 text-green-500 mb-2" />
                <div className="font-medium mb-1">Smart Search</div>
                <div className="text-xs text-center">Finds similar items across multiple retailers</div>
              </div>
              <div className="flex flex-col items-center p-4 bg-white/50 rounded-lg border border-border/50">
                <Link className="h-8 w-8 text-purple-500 mb-2" />
                <div className="font-medium mb-1">Direct Links</div>
                <div className="text-xs text-center">Shop directly at retailer websites</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

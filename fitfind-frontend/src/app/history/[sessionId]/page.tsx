"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Share2, Calendar, Clock, CheckCircle, Loader, AlertTriangle, ImageIcon, Trash2 } from "lucide-react";
import { cn, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecommendationsDisplay } from "@/components/ui/recommendations-display";
import { ConfirmDeleteDialog } from "@/components/history";
import { useAuth } from "@/contexts/AuthContext";
import { useHistoryContext, useHistoryEvents } from "@/contexts/HistoryContext";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useWishlist } from "@/hooks/useWishlist"; // Import the wishlist hook
import { useToast } from "@/components/ui/toast";
import type { SearchHistoryItem, ClothingItem, BackendCleanedData } from "@/types";
import { redoSearch } from "@/lib/api";

const statusConfig = {
  uploading: {
    icon: Loader,
    label: "Uploading",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  analyzing: {
    icon: Loader,
    label: "Analyzing",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  searching: {
    icon: Loader,
    label: "Searching",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10"
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    iconColor: "text-green-500",
    bgColor: "bg-green-500/10"
  },
  error: {
    icon: AlertTriangle,
    label: "Error",
    iconColor: "text-red-500",
    bgColor: "bg-red-500/10"
  }
};

export default function SearchSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const historyContext = useHistoryContext();
  
  const { 
    getSessionDetails, 
    deleteHistoryItem,
    isItemDeleting,
    canUndo,
    undoDelete
  } = useSearchHistory({
    enableUndo: false
  });

  const { addItem, removeItem, isInWishlist } = useWishlist({}); // Use the wishlist hook
  
  const [sessionItem, setSessionItem] = useState<SearchHistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const sessionId = params.sessionId as string;

  // Listen to global deletion events
  useHistoryEvents(['ITEM_DELETED'], (event) => {
    if (event.type === 'ITEM_DELETED' && sessionItem && event.historyId === sessionItem.id) {
      // This item was deleted from another page, navigate back
      toast({
        type: "info",
        title: "Item Deleted",
        description: "This search was deleted and is no longer available.",
        duration: 5000
      });
      
      setTimeout(() => {
        router.push('/history');
      }, 1000);
    }
  });

  // Load session details
  useEffect(() => {
    async function loadSessionDetails() {
      if (!user || !sessionId) return;

      setLoading(true);
      setError(null);

      try {
        // Try to get from current detail item first
        const currentItem = historyContext.getCurrentDetailItem();
        if (currentItem && currentItem.search_session_id === sessionId) {
          setSessionItem(currentItem);
          setLoading(false);
          return;
        }

        // Otherwise fetch details
        const details = await getSessionDetails(sessionId);
        if (details) {
          // Create a SearchHistoryItem from session details
          const historyItem: SearchHistoryItem = {
            id: details.id, // This might not be the history ID, but we'll use session ID
            user_id: details.user_id || '',
            search_session_id: details.id,
            created_at: details.created_at,
            search_sessions: details
          };
          
          setSessionItem(historyItem);
          historyContext.setCurrentDetailItem(historyItem);
        } else {
          setError('Search session not found or access denied');
        }
      } catch (err) {
        console.error('Error loading session details:', err);
        setError('Failed to load search session details');
      } finally {
        setLoading(false);
      }
    }

    loadSessionDetails();
  }, [user, sessionId, getSessionDetails, historyContext]);

  // Transform clothing items to ClothingItem format for RecommendationsDisplay
  const transformedResults: ClothingItem[] = useMemo(() => {
    if (!sessionItem?.search_sessions.clothing_items) return [];
    
    return sessionItem.search_sessions.clothing_items.flatMap(clothingItem => 
      clothingItem.products?.map(product => ({
        query: clothingItem.query,
        title: product.title,
        link: product.product_url,
        price: product.price?.toString() || null,
        extracted_price: product.price || null,
        source: product.source,
        rating: product.rating || null,
        reviews: product.review_count || null,
        thumbnail: product.image_url,
        product_id: product.external_id || product.id,
        shipping: product.delivery_info,
        tag: clothingItem.item_type,
      })) || []
    ) || [];
  }, [sessionItem]);

  // Create backend data structure for RecommendationsDisplay
  const backendData: BackendCleanedData | undefined = useMemo(() => {
    if (!sessionItem?.search_sessions.clothing_items || sessionItem.search_sessions.clothing_items.length === 0) return undefined;
    
    const session = sessionItem.search_sessions;
    if (!session.clothing_items) return undefined;
    
    return {
      clothing_items: session.clothing_items.map(clothingItem => ({
        query: clothingItem.query,
        item_type: clothingItem.item_type,
        total_products: clothingItem.total_products,
        price_range: clothingItem.price_range_min && clothingItem.price_range_max ? {
          min: clothingItem.price_range_min,
          max: clothingItem.price_range_max,
          average: clothingItem.price_range_average || 0
        } : null,
        products: clothingItem.products?.map(product => ({
          id: product.id,
          title: product.title,
          price: product.price?.toString() || null,
          price_numeric: product.price || null,
          old_price: product.old_price?.toString() || null,
          old_price_numeric: product.old_price || null,
          discount_percentage: product.discount_percentage?.toString() || null,
          image_url: product.image_url,
          product_url: product.product_url,
          source: product.source,
          source_icon: product.source_icon,
          rating: product.rating,
          review_count: product.review_count,
          delivery_info: product.delivery_info,
          tags: product.tags || []
        })) || []
      })),
      summary: {
        total_items: session.num_items_identified,
        total_products: session.num_products_found,
        has_errors: session.status === 'error',
        error_items: session.status === 'error' && session.error_message ? [{
          query: 'general',
          error: session.error_message
        }] : []
      }
    };
  }, [sessionItem]);

  const handleBackToHistory = () => {
    historyContext.setCurrentDetailItem(null);
    router.push('/history');
  };

  const handleShare = async () => {
    if (!sessionItem) return;
    
    try {
      await navigator.share({
        title: 'FitFind Search Results',
        text: `Check out these fashion recommendations from FitFind!`,
        url: window.location.href
      });
    } catch (err) {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast({
          type: "success",
          title: "Link Copied",
          description: "Share link copied to clipboard"
        });
      } catch (clipboardErr) {
        console.error('Failed to share or copy:', clipboardErr);
      }
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionItem) return;

    try {
      const result = await deleteHistoryItem(sessionItem.id);
      
      if (result.success) {
        // Show success message and navigate back
        toast({
          type: "success", 
          title: "Search Deleted",
          description: "The search has been removed from your history."
        });
        
        // Navigate back after a short delay
        setTimeout(() => {
          router.push('/history');
        }, 1000);
      } else {
        throw new Error(result.error || 'Failed to delete search');
      }
    } catch (error) {
      console.error('Error deleting search history item:', error);
      toast({
        type: "error",
        title: "Delete Failed", 
        description: error instanceof Error ? error.message : "Failed to delete search. Please try again."
      });
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const handleRedo = async () => {
    if (!sessionItem || !sessionItem.search_sessions.conversation_context || isRedoing) return;

    setIsRedoing(true);
    try {
      const response = await redoSearch(
        sessionItem.search_sessions.conversation_context,
        undefined,
        {
          country: sessionItem.search_sessions.country,
          language: sessionItem.search_sessions.language,
          fileId: sessionItem.search_sessions.file_id,
          sessionId: sessionItem.search_sessions.id
        }
      );

      if (response.success) {
        toast({
          type: "success",
          title: "Search Updated",
          description: "Your search has been redone with fresh results."
        });
        
        // Reload session details to get updated results
        const updatedDetails = await getSessionDetails(sessionId);
        if (updatedDetails) {
          const updatedItem: SearchHistoryItem = {
            ...sessionItem,
            search_sessions: updatedDetails
          };
          setSessionItem(updatedItem);
          historyContext.setCurrentDetailItem(updatedItem);
        }
      } else {
        throw new Error(response.error || 'Failed to redo search');
      }
    } catch (error) {
      console.error('Error redoing search:', error);
      toast({
        type: "error",
        title: "Redo Failed",
        description: error instanceof Error ? error.message : "Failed to redo search. Please try again."
      });
    } finally {
      setIsRedoing(false);
    }
  };

  const handleSaveProduct = async (product: ClothingItem) => {
    if (!user) {
      toast({
        type: "error",
        title: "Sign In Required",
        description: "Please sign in to save items to your wishlist."
      });
      return;
    }
    if (product.product_id) {
      await addItem(product.product_id);
    }
  };

  const handleRemoveProduct = async (product: ClothingItem) => {
    if (!user) return;
    if (product.product_id) {
      await removeItem(product.product_id);
    }
  };

  const isProductSaved = (product: ClothingItem) => {
    return product.product_id ? isInWishlist(product.product_id) : false;
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="h-full p-8 bg-gradient-to-br from-muted/30 to-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !sessionItem) {
    return (
      <div className="h-full p-8 bg-gradient-to-br from-muted/30 to-primary/5">
        <div className="max-w-7xl mx-auto">
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                {error || 'Search session not found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                The search session you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={handleBackToHistory} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to History
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const session = sessionItem.search_sessions;
  const statusInfo = statusConfig[session.status];
  const StatusIcon = statusInfo.icon;
  const createdAt = new Date(sessionItem.created_at);
  const timeAgo = formatDistanceToNow(createdAt);
  const isProcessing = session.status === 'uploading' || session.status === 'analyzing' || session.status === 'searching';
  const isDeleting = isItemDeleting(sessionItem.id);

  return (
    <div className="h-full flex">
      {/* Left Side - Image Display */}
      <div className="flex-1 p-8 border-r border-border bg-background">
        <div className="max-w-lg mx-auto h-full flex flex-col">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <Button 
                variant="ghost" 
                onClick={handleBackToHistory} 
                className="gap-2 hover:bg-muted/50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to History
              </Button>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                >
                  {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </Button>
                
                {session.status === 'completed' && session.conversation_context && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleRedo}
                    disabled={isRedoing}
                    className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                  >
                    {isRedoing ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Redo Search
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Badge variant="secondary" className={cn("gap-2", statusInfo.bgColor)}>
                <StatusIcon className={cn(
                  "w-3.5 h-3.5",
                  statusInfo.iconColor,
                  isProcessing && "animate-spin"
                )} />
                <span className={statusInfo.iconColor}>{statusInfo.label}</span>
              </Badge>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{timeAgo}</span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {createdAt.toLocaleDateString()} at {createdAt.toLocaleTimeString()}
              </span>
              <span>{session.num_items_identified} clothing items identified</span>
              <span>{session.num_products_found} products found</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Your Outfit</h1>
            <p className="text-muted-foreground">
              Original photo from your search session
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="relative">
              <div 
                className="relative rounded-xl overflow-hidden border-2 border-border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-lg"
              >
                {session.image_url && !imageError ? (
                  <>
                    <img
                      src={session.image_url}
                      alt={session.image_filename}
                      className={cn(
                        "w-full h-auto max-h-96 object-contain transition-all duration-300",
                        imageLoaded ? "opacity-100" : "opacity-0"
                      )}
                      onLoad={() => setImageLoaded(true)}
                      onError={() => setImageError(true)}
                    />
                    
                    {!imageLoaded && (
                      <div className="w-full h-96 flex items-center justify-center bg-muted/50">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-96 flex items-center justify-center bg-muted/50">
                    <div className="text-center">
                      <ImageIcon className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">Image not available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            

            {/* Error Display */}
            {session.status === 'error' && session.error_message && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900 mb-1">Search Error</div>
                    <div className="text-sm text-red-700">{session.error_message}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Recommendations */}
      <div className="flex-1 p-8 bg-gradient-to-br from-muted/30 to-primary/5">
        <div className="h-full flex flex-col">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-foreground mb-2">Your Style Recommendations</h2>
            <p className="text-muted-foreground">
              {transformedResults.length > 0
                ? `Found ${transformedResults.length} similar items across ${session.num_items_identified} clothing categories`
                : "No recommendations found for this search session"
              }
            </p>
          </div>

          <div className="flex-1 overflow-hidden">
            {session.status === 'completed' && transformedResults.length > 0 ? (
              <RecommendationsDisplay
                results={transformedResults}
                backendData={backendData}
                onSave={handleSaveProduct}
                onRemove={handleRemoveProduct}
                isItemSaved={isProductSaved}
              />
            ) : session.status === 'error' ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <AlertTriangle className="w-12 h-12 text-red-500" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Search Failed</h3>
                  <p className="text-muted-foreground mb-4">
                    This search session encountered an error and no results are available.
                  </p>
                  {session.conversation_context && (
                    <Button
                      onClick={handleRedo}
                      disabled={isRedoing}
                      variant="outline"
                      className="gap-2"
                    >
                      {isRedoing ? (
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            ) : isProcessing ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    {session.status === 'analyzing' ? 'Analyzing outfit...' : 
                     session.status === 'searching' ? 'Finding recommendations...' : 
                     'Processing...'}
                  </h3>
                  <p className="text-muted-foreground">
                    Please wait while we process your search
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                    <ImageIcon className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">No Results</h3>
                  <p className="text-muted-foreground">
                    This search session didn't produce any recommendations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDeleteDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        item={sessionItem}
        onConfirm={handleConfirmDelete}
        loading={isDeleting}
      />
    </div>
  );
} 
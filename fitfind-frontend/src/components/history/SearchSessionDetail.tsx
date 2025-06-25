"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, RotateCcw, Download, Share2, ImageIcon, X, AlertTriangle, Calendar, Clock, CheckCircle, Loader, Trash2 } from "lucide-react";
import { cn, formatDistanceToNow } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecommendationsDisplay } from "@/components/ui/recommendations-display";
import type { SearchHistoryItem, ClothingItem, BackendCleanedData } from "@/types";

interface SearchSessionDetailProps {
  item: SearchHistoryItem;
  onBack: () => void;
  onRedo?: (item: SearchHistoryItem) => void;
  onDelete?: (item: SearchHistoryItem) => void;
  onSaveProduct?: (product: ClothingItem) => void;
  onRemoveProduct?: (product: ClothingItem) => void;
  isProductSaved?: (product: ClothingItem) => boolean;
  className?: string;
}

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
    iconColor: "text-[#6b7f3a]",
    bgColor: "bg-[#6b7f3a]/10"
  },
  error: {
    icon: AlertTriangle,
    label: "Error",
    iconColor: "text-red-500",
    bgColor: "bg-red-500/10"
  }
};

export function SearchSessionDetail({ 
  item, 
  onBack, 
  onRedo, 
  onDelete,
  onSaveProduct, 
  onRemoveProduct, 
  isProductSaved,
  className 
}: SearchSessionDetailProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const session = item.search_sessions;
  const statusInfo = statusConfig[session.status];
  const StatusIcon = statusInfo.icon;
  
  const createdAt = new Date(item.created_at);
  const timeAgo = formatDistanceToNow(createdAt);

  // Transform clothing items to ClothingItem format for RecommendationsDisplay
  const transformedResults: ClothingItem[] = useMemo(() => {
    return session.clothing_items?.flatMap(clothingItem => 
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
  }, [session.clothing_items]);

  // Create backend data structure for RecommendationsDisplay
  const backendData: BackendCleanedData | undefined = useMemo(() => {
    if (!session.clothing_items || session.clothing_items.length === 0) return undefined;
    
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
  }, [session]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Search Session: ${session.image_filename}`,
          text: `Found ${session.num_products_found} products from ${session.num_items_identified} clothing items`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleDownload = () => {
    const data = {
      session: session,
      search_date: item.created_at,
      products: transformedResults
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `search-session-${session.id}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleRedoSearch = async () => {
    if (!onRedo || isRedoing) return;
    setIsRedoing(true);
    try {
      await onRedo(item);
    } finally {
      setIsRedoing(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(item);
      // The parent component should handle navigation back to history
    } finally {
      setIsDeleting(false);
    }
  };

  const handleImageClick = () => {
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const isProcessing = session.status === 'uploading' || session.status === 'analyzing' || session.status === 'searching';

  return (
    <>
      <div className={cn("h-full flex flex-col", className)}>
        {/* Header */}
        <div className="flex-shrink-0 p-6 border-b border-border bg-background/80 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={onBack} 
                className="gap-2 hover:bg-muted/50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to History
              </Button>
              
              <div className="flex items-center gap-3">
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
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
                <Share2 className="w-4 h-4" />
                Share
              </Button>
              
              {onDelete && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDelete}
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
              )}
              
              {session.status === 'completed' && session.conversation_context && (
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleRedoSearch}
                  disabled={isRedoing}
                  className="gap-2 bg-gradient-to-r from-primary to-[#6b7f3a] hover:from-primary/90 hover:to-[#6b7f3a]/90"
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
          
          <div className="mt-4">
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {createdAt.toLocaleDateString()} at {createdAt.toLocaleTimeString()}
              </span>
              <span>{session.num_items_identified} clothing items identified</span>
              <span>{session.num_products_found} products found</span>
            </div>
          </div>
        </div>

        {/* Main Content - Split Layout */}
        <div className="flex-1 flex min-h-0">
          {/* Left Side - Image Display */}
          <div className="flex-1 p-8 border-r border-border bg-background overflow-y-auto">
            <div className="max-w-lg mx-auto h-full flex flex-col">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground mb-2">Your Outfit</h2>
                <p className="text-muted-foreground">
                  Original photo from your search session
                </p>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                <div className="relative">
                  <div 
                    className="relative rounded-xl overflow-hidden border-2 border-border bg-card transition-all duration-200 cursor-pointer hover:border-primary/50 hover:shadow-lg"
                    onClick={handleImageClick}
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
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                          <div className="opacity-0 hover:opacity-100 transition-opacity duration-200 text-white text-sm font-medium bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
                            Click to expand
                          </div>
                        </div>
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
                  
                  <div className="mt-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      {imageLoaded ? 'Click to view full size' : 'Loading image...'}
                    </p>
                  </div>
                </div>

                {/* Search Queries */}
                {session.search_queries && session.search_queries.length > 0 && (
                  <div className="mt-8 p-6 bg-muted/30 rounded-xl border">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Search Queries Used</h3>
                    <div className="flex flex-wrap gap-2">
                      {session.search_queries.map((query, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {query}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

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
          <div className="flex-1 p-8 bg-gradient-to-br from-muted/30 to-primary/5 overflow-hidden flex flex-col">
            <div className="flex flex-col h-full">
              <div className="text-center mb-8 flex-shrink-0">
                <h2 className="text-3xl font-bold text-foreground mb-2">Your Style Recommendations</h2>
                <p className="text-muted-foreground">
                  {transformedResults.length > 0
                    ? `Found ${transformedResults.length} similar items across ${session.num_items_identified} clothing categories`
                    : "No recommendations found for this search session"
                  }
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {session.status === 'completed' && transformedResults.length > 0 ? (
                  <RecommendationsDisplay
                    results={transformedResults}
                    backendData={backendData}
                    onSave={onSaveProduct}
                    onRemove={onRemoveProduct}
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
                          onClick={handleRedoSearch}
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
        </div>
      </div>

      {/* Image Modal */}
      {isModalOpen && session.image_url && !imageError && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={handleModalClose}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={handleModalClose}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="h-8 w-8" />
            </button>
            <img
              src={session.image_url}
              alt={`${session.image_filename} - expanded view`}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-lg">
              <p className="font-medium">{session.image_filename}</p>
              <p className="text-sm opacity-80">{createdAt.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 
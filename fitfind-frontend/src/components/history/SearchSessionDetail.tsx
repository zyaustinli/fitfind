"use client";

import { useState } from "react";
import { ArrowLeft, Calendar, Clock, Search, ShoppingBag, RotateCcw, Download, Share2, ImageIcon, AlertCircle, CheckCircle, Loader, Star, ExternalLink } from "lucide-react";
import { cn, formatDistanceToNow, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductCard } from "@/components/ui/product-card";
import type { SearchHistoryItem, ClothingItem } from "@/types";

interface SearchSessionDetailProps {
  item: SearchHistoryItem;
  onBack: () => void;
  onRedo?: (item: SearchHistoryItem) => void;
  onSaveProduct?: (product: ClothingItem) => void;
  onRemoveProduct?: (product: ClothingItem) => void;
  isProductSaved?: (product: ClothingItem) => boolean;
  className?: string;
}

const statusConfig = {
  uploading: {
    icon: Loader,
    label: "Uploading",
    variant: "secondary" as const,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  analyzing: {
    icon: Loader,
    label: "Analyzing",
    variant: "secondary" as const,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  searching: {
    icon: Search,
    label: "Searching",
    variant: "secondary" as const,
    color: "text-blue-600",
    bgColor: "bg-blue-50"
  },
  completed: {
    icon: CheckCircle,
    label: "Completed",
    variant: "default" as const,
    color: "text-green-600",
    bgColor: "bg-green-50"
  },
  error: {
    icon: AlertCircle,
    label: "Error",
    variant: "destructive" as const,
    color: "text-red-600",
    bgColor: "bg-red-50"
  }
};

export function SearchSessionDetail({ 
  item, 
  onBack, 
  onRedo, 
  onSaveProduct, 
  onRemoveProduct, 
  isProductSaved,
  className 
}: SearchSessionDetailProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'results'>('overview');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const session = item.search_sessions;
  const statusInfo = statusConfig[session.status];
  const StatusIcon = statusInfo.icon;
  
  const createdAt = new Date(item.created_at);
  const timeAgo = formatDistanceToNow(createdAt);

  // Transform clothing items to ClothingItem format for ProductCard
  const allProducts: ClothingItem[] = session.clothing_items?.flatMap(clothingItem => 
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
      // Fallback to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleDownload = () => {
    const data = {
      session: session,
      search_date: item.created_at,
      products: allProducts
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `search-session-${session.id}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to History
        </Button>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
          {session.status === 'completed' && session.conversation_context && onRedo && (
            <Button variant="default" size="sm" onClick={() => onRedo(item)} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Redo Search
            </Button>
          )}
        </div>
      </div>

      {/* Session Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={statusInfo.variant} className="text-sm">
                    <StatusIcon className={cn("w-4 h-4 mr-2", session.status === 'analyzing' || session.status === 'uploading' ? "animate-spin" : "")} />
                    {statusInfo.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {timeAgo}
                  </span>
                </div>
                
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  {session.image_filename}
                </h1>
                
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {createdAt.toLocaleDateString()} at {createdAt.toLocaleTimeString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShoppingBag className="w-4 h-4" />
                    {session.num_items_identified} items identified
                  </span>
                  <span className="flex items-center gap-1">
                    <Search className="w-4 h-4" />
                    {session.num_products_found} products found
                  </span>
                </div>
              </div>
            </div>

            {/* Search Queries */}
            {session.search_queries && session.search_queries.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-foreground mb-2">Search Queries</h3>
                <div className="flex flex-wrap gap-2">
                  {session.search_queries.map((query, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {query}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {session.status === 'error' && session.error_message && (
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-destructive mb-1">Error</div>
                    <div className="text-sm text-destructive">
                      {session.error_message}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Image Preview */}
        <div className="space-y-4">
          <div className="aspect-square rounded-lg overflow-hidden bg-muted">
            {session.image_url && !imageError ? (
              <>
                <img
                  src={session.image_url}
                  alt={session.image_filename}
                  className={cn(
                    "w-full h-full object-cover transition-opacity duration-300",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                {!imageLoaded && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-16 h-16 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-foreground">{session.num_items_identified}</div>
              <div className="text-xs text-muted-foreground">Items</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <div className="text-2xl font-bold text-foreground">{session.num_products_found}</div>
              <div className="text-xs text-muted-foreground">Products</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          <button
            onClick={() => setSelectedTab('overview')}
            className={cn(
              "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
              selectedTab === 'overview'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setSelectedTab('results')}
            className={cn(
              "py-2 px-1 border-b-2 font-medium text-sm transition-colors",
              selectedTab === 'results'
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            )}
          >
            Results ({allProducts.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Clothing Items Summary */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Identified Items</h3>
            {session.clothing_items && session.clothing_items.length > 0 ? (
              <div className="space-y-3">
                {session.clothing_items.map((clothingItem, index) => (
                  <div key={index} className="p-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-foreground">{clothingItem.item_type}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {clothingItem.total_products} products
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Search: "{clothingItem.query}"
                    </div>
                    {clothingItem.price_range_average && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Avg Price: </span>
                        <span className="font-medium text-primary">
                          ${clothingItem.price_range_average.toFixed(0)}
                        </span>
                        {clothingItem.price_range_min && clothingItem.price_range_max && (
                          <span className="text-muted-foreground ml-2">
                            (${clothingItem.price_range_min} - ${clothingItem.price_range_max})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No clothing items identified
              </div>
            )}
          </div>

          {/* Search Analytics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Search Analytics</h3>
            <div className="space-y-3">
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="text-sm text-muted-foreground mb-1">File Info</div>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Name: </span>
                    <span className="font-medium">{session.image_filename}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Country: </span>
                    <span className="font-medium">{session.country.toUpperCase()}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Language: </span>
                    <span className="font-medium">{session.language.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="text-sm text-muted-foreground mb-1">Session Details</div>
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Session ID: </span>
                    <span className="font-mono text-xs">{session.id}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">File ID: </span>
                    <span className="font-mono text-xs">{session.file_id}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Created: </span>
                    <span className="font-medium">{createdAt.toLocaleString()}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Updated: </span>
                    <span className="font-medium">{new Date(session.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'results' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Search Results ({allProducts.length} products)
            </h3>
          </div>
          
          {allProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {allProducts.map((product, index) => (
                <ProductCard
                  key={`${product.product_id}-${index}`}
                  item={product}
                  onSave={onSaveProduct}
                  onRemove={onRemoveProduct}
                  isSaved={isProductSaved?.(product) || false}
                />
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Products Found</h3>
              <p className="text-muted-foreground">
                This search session didn't find any matching products.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 
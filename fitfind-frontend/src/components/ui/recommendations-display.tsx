"use client";

import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { ProductCard } from "./product-card";
import { ExtractionStatusIndicator } from "./direct-link-indicator";
import { groupProductsByType, getExtractionStatus, getDirectLinksStats } from "@/lib/data-transform";
import { Button } from "./button";
import { Card } from "./card";
import { Link, Store, TrendingUp, AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClothingItem, BackendCleanedData } from "@/types";

interface RecommendationsDisplayProps {
  results: ClothingItem[];
  backendData?: BackendCleanedData;
  onSave?: (item: ClothingItem) => void;
  onRemove?: (item: ClothingItem) => void;
  isItemSaved?: (item: ClothingItem) => boolean;
  extractionMeta?: {
    direct_links_extracted?: boolean;
    direct_links_extraction_time?: string;
  };
  showExtractionStatus?: boolean;
}

export function RecommendationsDisplay({
  results,
  backendData,
  onSave,
  onRemove,
  isItemSaved,
  extractionMeta,
  showExtractionStatus = true
}: RecommendationsDisplayProps) {
  // Group products by clothing type using backend data if available
  const groupedProducts = useMemo(() => {
    if (backendData) {
      return groupProductsByType(backendData);
    }
    
    // Fallback: group by query if backend data is not available
    const grouped: Record<string, {
      items: ClothingItem[];
      priceRange: { min: number; max: number; average: number } | null;
      query: string;
    }> = {};
    
    results.forEach(item => {
      const key = item.query || 'unknown';
      if (!grouped[key]) {
        grouped[key] = {
          items: [],
          priceRange: null,
          query: key
        };
      }
      grouped[key].items.push(item);
    });
    
    return grouped;
  }, [results, backendData]);

  // Calculate extraction status and statistics
  const extractionStatus = useMemo(() => {
    if (!backendData) return null;
    return getExtractionStatus(backendData, extractionMeta);
  }, [backendData, extractionMeta]);

  const directLinksStats = useMemo(() => {
    if (!backendData) return null;
    return getDirectLinksStats(backendData);
  }, [backendData]);

  const clothingTypes = Object.keys(groupedProducts);
  
  if (clothingTypes.length === 0) {
    return null;
  }

  // Capitalize and format clothing type names
  const formatClothingType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/[-_]/g, ' ');
  };

  // Get the first clothing type as default
  const defaultTab = clothingTypes[0];

  return (
    <div className="h-full flex flex-col">
      {/* Extraction Status Header */}
      {showExtractionStatus && extractionStatus && directLinksStats && (
        <div className="flex-shrink-0 mb-6">
          <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h4 className="font-semibold text-gray-900">Direct Links Enhancement</h4>
                <ExtractionStatusIndicator
                  status={extractionStatus.status}
                  extractedCount={extractionStatus.extractedCount}
                  totalCount={extractionStatus.totalCount}
                  size="sm"
                />
              </div>
              
              {/* Success Rate */}
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700">
                  {directLinksStats.extractionSuccessRate.toFixed(0)}% Success Rate
                </span>
              </div>
            </div>

            {/* Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">{directLinksStats.totalDirectLinks}</div>
                  <div className="text-gray-600 text-xs">Direct Links</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <div className="font-medium text-gray-900">{directLinksStats.productsWithDirectLinks}</div>
                  <div className="text-gray-600 text-xs">Enhanced Products</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-purple-600" />
                <div>
                  <div className="font-medium text-gray-900">{directLinksStats.topRetailers.length}</div>
                  <div className="text-gray-600 text-xs">Unique Retailers</div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-gray-600" />
                <div>
                  <div className="font-medium text-gray-900">
                    {directLinksStats.totalProducts - directLinksStats.productsWithDirectLinks}
                  </div>
                  <div className="text-gray-600 text-xs">Google Shopping</div>
                </div>
              </div>
            </div>

            {/* Top Retailers */}
            {directLinksStats.topRetailers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Top Retailers:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {directLinksStats.topRetailers.slice(0, 5).map((retailer, index) => (
                    <span
                      key={retailer.retailer}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        index === 0 
                          ? "bg-blue-100 text-blue-800 border border-blue-200" 
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      )}
                    >
                      {retailer.retailer}
                      <span className="text-xs opacity-75">({retailer.count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
        {/* Tabs Navigation */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">
              Found {backendData ? backendData.summary.total_items : clothingTypes.length} clothing {(backendData ? backendData.summary.total_items : clothingTypes.length) === 1 ? 'item' : 'items'}
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Link className="h-4 w-4" />
                <span>
                  {directLinksStats ? directLinksStats.productsWithDirectLinks : 0} direct links
                </span>
              </div>
              <div>
                {backendData ? backendData.summary.total_products : results.length} total products
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {clothingTypes.map(type => {
              const group = groupedProducts[type];
              const groupDirectLinks = group.items.filter(item => 
                item.direct_links && item.direct_links.length > 0
              ).length;
              
              return (
                <TabsTrigger 
                  key={type} 
                  value={type}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background hover:bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary transition-all"
                >
                  <span>{formatClothingType(type)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                      {group.items.length}
                    </span>
                    {groupDirectLinks > 0 && (
                      <div className="flex items-center gap-1">
                        <Link className="h-3 w-3 text-green-600 data-[state=active]:text-primary-foreground" />
                        <span className="text-xs text-green-600 data-[state=active]:text-primary-foreground">
                          {groupDirectLinks}
                        </span>
                      </div>
                    )}
                  </div>
                </TabsTrigger>
              );
            })}
          </div>
        </div>

        {/* Tabs Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {clothingTypes.map(type => {
            const group = groupedProducts[type];
            const groupStats = {
              total: group.items.length,
              withDirectLinks: group.items.filter(item => 
                item.direct_links && item.direct_links.length > 0
              ).length,
              totalDirectLinks: group.items.reduce((sum, item) => 
                sum + (item.direct_links?.length || 0), 0
              ),
            };

            return (
              <TabsContent 
                key={type} 
                value={type} 
                className="h-full flex flex-col m-0 p-0 data-[state=inactive]:hidden"
              >
                {/* Section Header */}
                <div className="flex-shrink-0 mb-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">
                      {group.query}
                    </h4>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {groupStats.withDirectLinks > 0 && (
                        <div className="flex items-center gap-1">
                          <Link className="h-4 w-4 text-green-600" />
                          <span className="text-green-700 font-medium">
                            {groupStats.withDirectLinks}/{groupStats.total} enhanced
                          </span>
                          <span className="text-xs text-gray-500">
                            ({groupStats.totalDirectLinks} links)
                          </span>
                        </div>
                      )}
                      <span>
                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress bar for direct links coverage */}
                  {groupStats.total > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Direct Links Coverage</span>
                        <span>{Math.round((groupStats.withDirectLinks / groupStats.total) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(groupStats.withDirectLinks / groupStats.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Products Grid */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
                    {group.items.map((item, index) => (
                      <ProductCard
                        key={`${item.product_id || item.title}-${index}`}
                        item={item}
                        onSave={onSave}
                        onRemove={onRemove}
                        isSaved={isItemSaved ? isItemSaved(item) : false}
                        hideSearchQuery={true}
                        showDirectLinksIndicator={true}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
} 
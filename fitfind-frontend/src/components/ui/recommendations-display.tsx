"use client";

import { useMemo, memo, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { ProductCard } from "./product-card";
import { ProductGridSkeleton } from "./skeleton";
import { groupProductsByType } from "@/lib/data-transform";
import { Button } from "./button";
import { Card } from "./card";
import { Link } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClothingItem, BackendCleanedData } from "@/types";

interface RecommendationsDisplayProps {
  results: ClothingItem[];
  backendData?: BackendCleanedData;
  onSave?: (item: ClothingItem) => void;
  onRemove?: (item: ClothingItem) => void;
  isItemSaved?: (item: ClothingItem) => boolean;
}

const RecommendationsDisplay = memo(function RecommendationsDisplay({
  results,
  backendData,
  onSave,
  onRemove,
  isItemSaved
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

  // Create a key that changes when the data changes to force re-render
  const componentKey = useMemo(() => {
    return `tabs-${clothingTypes.join('-')}-${results.length}`;
  }, [clothingTypes, results.length]);

  return (
    <div className="h-full flex flex-col">
      <Tabs key={componentKey} defaultValue={defaultTab} className="h-full flex flex-col">
        {/* Tabs Navigation */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">
              Found {backendData ? backendData.summary.total_items : clothingTypes.length} clothing {(backendData ? backendData.summary.total_items : clothingTypes.length) === 1 ? 'item' : 'items'}
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div>
                {backendData ? backendData.summary.total_products : results.length} total products
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {clothingTypes.map(type => {
              const group = groupedProducts[type];
              
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
                      <span>
                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </div>
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
                        isSaved={item.is_saved || false}
                        hideSearchQuery={true}
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
});

export { RecommendationsDisplay };
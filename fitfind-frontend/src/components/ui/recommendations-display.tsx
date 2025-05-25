"use client";

import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { ProductCard } from "./product-card";
import { groupProductsByType } from "@/lib/data-transform";
import type { ClothingItem, BackendCleanedData } from "@/types";

interface RecommendationsDisplayProps {
  results: ClothingItem[];
  backendData?: BackendCleanedData;
  onSave?: (item: ClothingItem) => void;
  onRemove?: (item: ClothingItem) => void;
  isItemSaved?: (item: ClothingItem) => boolean;
}

export function RecommendationsDisplay({
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

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue={defaultTab} className="h-full flex flex-col">
        {/* Tabs Navigation */}
        <div className="flex-shrink-0 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">
              Found {clothingTypes.length} clothing {clothingTypes.length === 1 ? 'item' : 'items'}
            </h3>
            <div className="text-sm text-muted-foreground">
              {results.length} total products
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
                  {formatClothingType(type)}
                  <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full data-[state=active]:bg-primary-foreground/20 data-[state=active]:text-primary-foreground">
                    {group.items.length}
                  </span>
                </TabsTrigger>
              );
            })}
          </div>
        </div>

        {/* Tabs Content */}
        <div className="flex-1 overflow-hidden">
          {clothingTypes.map(type => {
            const group = groupedProducts[type];
            return (
              <TabsContent 
                key={type} 
                value={type} 
                className="h-full flex flex-col"
              >
                {/* Section Header */}
                <div className="flex-shrink-0 mb-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground">
                      {group.query}
                    </h4>
                    <span className="text-sm text-muted-foreground">
                      {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                    </span>
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
                        isSaved={isItemSaved ? isItemSaved(item) : false}
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
} 
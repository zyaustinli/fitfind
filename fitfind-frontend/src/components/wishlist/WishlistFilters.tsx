"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown, 
  DollarSign,
  Tag,
  Store,
  SortAsc,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { WishlistFilters, WishlistItemDetailed } from "@/types";

interface WishlistFiltersProps {
  filters: WishlistFilters;
  items: WishlistItemDetailed[];
  onFiltersChange: (filters: Partial<WishlistFilters>) => void;
  onReset: () => void;
  className?: string;
}

interface PriceRange {
  min: number;
  max: number;
}

export function WishlistFilters({
  filters,
  items,
  onFiltersChange,
  onReset,
  className
}: WishlistFiltersProps) {
  const [priceRange, setPriceRange] = useState<PriceRange>({
    min: filters.priceRange?.min || 0,
    max: filters.priceRange?.max || 1000
  });
  
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Calculate available filters from items
  const availableFilters = useMemo(() => {
    const sources = new Set<string>();
    const tags = new Set<string>();
    let minPrice = Infinity;
    let maxPrice = 0;

    items.forEach(item => {
      // Sources
      sources.add(item.products.source);
      
      // Tags
      item.tags.forEach(tag => tags.add(tag));
      item.products.tags.forEach(tag => tags.add(tag));
      
      // Price range
      if (item.products.price) {
        minPrice = Math.min(minPrice, item.products.price);
        maxPrice = Math.max(maxPrice, item.products.price);
      }
    });

    return {
      sources: Array.from(sources).sort(),
      tags: Array.from(tags).sort(),
      priceRange: {
        min: minPrice === Infinity ? 0 : Math.floor(minPrice),
        max: maxPrice === 0 ? 1000 : Math.ceil(maxPrice)
      }
    };
  }, [items]);

  // Update price range when available range changes
  useEffect(() => {
    if (!filters.priceRange) {
      setPriceRange(availableFilters.priceRange);
    }
  }, [availableFilters.priceRange, filters.priceRange]);

  const handlePriceRangeChange = useCallback((min: number, max: number) => {
    setPriceRange({ min, max });
    onFiltersChange({ 
      priceRange: { min, max }
    });
  }, [onFiltersChange]);

  const handleSourceToggle = useCallback((source: string) => {
    const currentSources = filters.sources || [];
    const newSources = currentSources.includes(source)
      ? currentSources.filter(s => s !== source)
      : [...currentSources, source];
    
    onFiltersChange({ 
      sources: newSources.length > 0 ? newSources : undefined 
    });
  }, [filters.sources, onFiltersChange]);

  const handleTagToggle = useCallback((tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    
    onFiltersChange({ 
      tags: newTags.length > 0 ? newTags : undefined 
    });
  }, [filters.tags, onFiltersChange]);

  const hasActiveFilters = useMemo(() => {
    return !!(
      filters.priceRange ||
      (filters.sources && filters.sources.length > 0) ||
      (filters.tags && filters.tags.length > 0)
    );
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.priceRange) count++;
    if (filters.sources?.length) count++;
    if (filters.tags?.length) count++;
    return count;
  }, [filters]);

  const sortOptions = [
    { value: 'newest', label: 'Newest First', icon: Clock },
    { value: 'oldest', label: 'Oldest First', icon: Clock },
    { value: 'price_low', label: 'Price: Low to High', icon: TrendingUp },
    { value: 'price_high', label: 'Price: High to Low', icon: TrendingUp },
    { value: 'title', label: 'Alphabetical', icon: SortAsc },
  ];

  return (
    <div className={cn(
      "rounded-xl border border-border/50 bg-gradient-to-br from-background/80 to-muted/20 backdrop-blur-sm overflow-hidden",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-lg flex items-center justify-center">
            <Filter className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Advanced Filters</h3>
            <p className="text-sm text-muted-foreground">
              {activeFilterCount > 0 
                ? `${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`
                : 'Refine your collection'
              }
            </p>
          </div>
        </div>
        
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="border-primary/20 hover:border-primary/40 hover:bg-primary/5"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset All
          </Button>
        )}
      </div>

      {/* Content Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sort Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <SortAsc className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Sort Order</span>
          </div>
          
          <div className="space-y-2">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onFiltersChange({ sortBy: option.value as any })}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 text-left",
                  filters.sortBy === option.value
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-background/50 border-border/50 hover:border-primary/20 hover:bg-primary/5"
                )}
              >
                <option.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{option.label}</span>
                {filters.sortBy === option.value && (
                  <Sparkles className="w-4 h-4 ml-auto text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Price Range</span>
          </div>
          
          <div className="space-y-4">
            <div className="bg-background/50 rounded-lg p-4 border border-border/50">
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Min: ${priceRange.min}</span>
                  <span className="text-muted-foreground">Max: ${priceRange.max}</span>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <input
                      type="range"
                      min={availableFilters.priceRange.min}
                      max={availableFilters.priceRange.max}
                      value={priceRange.min}
                      onChange={(e) => handlePriceRangeChange(Number(e.target.value), priceRange.max)}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div>
                    <input
                      type="range"
                      min={availableFilters.priceRange.min}
                      max={availableFilters.priceRange.max}
                      value={priceRange.max}
                      onChange={(e) => handlePriceRangeChange(priceRange.min, Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
                
                <div className="text-center">
                  <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                    ${priceRange.min} - ${priceRange.max}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sources & Tags Section */}
        <div className="space-y-6">
          {/* Sources */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Sources</span>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {availableFilters.sources.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg text-center">
                  No sources available
                </div>
              ) : (
                availableFilters.sources.map((source) => (
                  <button
                    key={source}
                    onClick={() => handleSourceToggle(source)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 text-left text-sm",
                      filters.sources?.includes(source)
                        ? "bg-primary/10 border border-primary/30 text-primary"
                        : "bg-background/50 hover:bg-primary/5 border border-transparent"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center",
                      filters.sources?.includes(source)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-border"
                    )}>
                      {filters.sources?.includes(source) && (
                        <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                      )}
                    </div>
                    <span className="truncate">{source}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground">Tags</span>
            </div>
            
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {availableFilters.tags.length === 0 ? (
                <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg text-center">
                  No tags available
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableFilters.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleTagToggle(tag)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
                        filters.tags?.includes(tag)
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary"
                      )}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
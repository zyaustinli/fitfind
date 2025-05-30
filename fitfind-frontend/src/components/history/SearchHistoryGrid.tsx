"use client";

import { useEffect, useRef, useCallback } from "react";
import { Search, ShoppingBag, AlertCircle, Loader } from "lucide-react";
import { SearchHistoryCard } from "./SearchHistoryCard";
import { Button } from "@/components/ui/button";
import type { SearchHistoryItem } from "@/types";
import { cn } from "@/lib/utils";

interface SearchHistoryGridProps {
  items: SearchHistoryItem[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onViewItem: (item: SearchHistoryItem) => void;
  onRedoSearch: (item: SearchHistoryItem) => void;
  onDeleteSearch: (item: SearchHistoryItem) => void;
  className?: string;
}

export function SearchHistoryGrid({
  items,
  loading,
  hasMore,
  onLoadMore,
  onViewItem,
  onRedoSearch,
  onDeleteSearch,
  className
}: SearchHistoryGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Intersection observer for infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && hasMore && !loading) {
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore]);

  useEffect(() => {
    const option = {
      root: null,
      rootMargin: "20px",
      threshold: 0
    };
    
    const observer = new IntersectionObserver(handleObserver, option);
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);

    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [handleObserver]);

  if (items.length === 0 && !loading) {
    return (
      <div className={cn("text-center py-16", className)}>
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6 mx-auto">
          <Search className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No search results found</h3>
        <p className="text-muted-foreground">
          Try adjusting your filters or search terms
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((item) => (
          <SearchHistoryCard
            key={item.id}
            item={item}
            onView={onViewItem}
            onRedo={onRedoSearch}
            onDelete={onDeleteSearch}
            className="h-fit"
          />
        ))}
      </div>

      {/* Loading indicator for infinite scroll */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader className="w-4 h-4 animate-spin" />
              Loading more searches...
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={onLoadMore}
              className="gap-2"
            >
              Load More
            </Button>
          )}
        </div>
      )}

      {/* End of results indicator */}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          You've reached the end of your search history
        </div>
      )}
    </div>
  );
} 
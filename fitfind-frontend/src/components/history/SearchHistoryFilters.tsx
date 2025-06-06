"use client";

import { useState } from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SearchHistoryFilters } from "@/types";

interface SearchHistoryFiltersProps {
  filters?: SearchHistoryFilters;
  onFiltersChange?: (filters: Partial<SearchHistoryFilters>) => void;
  onReset?: () => void;
  resultCount?: number;
  totalCount?: number;
  className?: string;
}

export function SearchHistoryFilters({ 
  filters = { sortBy: 'newest' },
  onFiltersChange,
  onReset,
  resultCount,
  totalCount,
  className 
}: SearchHistoryFiltersProps) {
  const [searchQuery, setSearchQuery] = useState(filters.searchQuery || '');

  const hasActiveFilters = !!(filters.searchQuery);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange?.({ searchQuery: searchQuery || undefined });
  };

  const handleSearchClear = () => {
    setSearchQuery('');
    onFiltersChange?.({ searchQuery: undefined });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clothing items (e.g., black tshirt, denim jeans)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-2 text-muted-foreground"
          >
            <RotateCcw className="w-4 h-4" />
            Clear
          </Button>
        )}

        {/* Total Count Display */}
        {totalCount !== undefined && (
          <div className="text-sm text-muted-foreground">
            {hasActiveFilters && resultCount !== undefined ? (
              <>
                {resultCount} of {totalCount} {totalCount === 1 ? 'search' : 'searches'}
              </>
            ) : (
              <>
                {totalCount} {totalCount === 1 ? 'search' : 'searches'}
              </>
            )}
          </div>
        )}
      </div>

      {/* Active Search Filter Badge */}
      {filters.searchQuery && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1 text-xs">
            <Search className="w-3 h-3" />
            "{filters.searchQuery}"
            <button
              onClick={handleSearchClear}
              className="hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        </div>
      )}
      
      {/* Info Note */}
    </div>
  );
} 
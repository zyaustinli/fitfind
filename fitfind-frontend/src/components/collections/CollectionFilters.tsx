"use client";

import { useState } from "react";
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  SortAsc, 
  SortDesc,
  Eye,
  EyeOff,
  X,
  Calendar,
  Hash,
  Type
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CollectionFiltersState } from "@/types";

interface CollectionFiltersProps {
  filters: CollectionFiltersState;
  onFiltersChange: (filters: Partial<CollectionFiltersState>) => void;
  onResetFilters: () => void;
  totalCount?: number;
  className?: string;
}

export function CollectionFilters({
  filters,
  onFiltersChange,
  onResetFilters,
  totalCount,
  className
}: CollectionFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const hasActiveFilters = Boolean(
    filters.searchQuery || 
    filters.isPrivate !== undefined ||
    filters.sortBy !== 'newest'
  );

  const handleSearchChange = (value: string) => {
    onFiltersChange({ searchQuery: value || undefined });
  };

  const handleSortChange = (sortBy: CollectionFiltersState['sortBy']) => {
    onFiltersChange({ sortBy });
  };

  const handleViewModeChange = (viewMode: CollectionFiltersState['viewMode']) => {
    onFiltersChange({ viewMode });
  };

  const handlePrivacyFilter = (isPrivate?: boolean) => {
    onFiltersChange({ isPrivate });
  };

  const getSortLabel = (sortBy: CollectionFiltersState['sortBy']) => {
    switch (sortBy) {
      case 'newest': return 'Newest First';
      case 'oldest': return 'Oldest First';
      case 'name': return 'Name A-Z';
      case 'item_count': return 'Most Items';
      case 'last_updated': return 'Recently Updated';
      default: return 'Newest First';
    }
  };

  const getSortIcon = (sortBy: CollectionFiltersState['sortBy']) => {
    switch (sortBy) {
      case 'newest': return <Calendar className="h-4 w-4" />;
      case 'oldest': return <Calendar className="h-4 w-4" />;
      case 'name': return <Type className="h-4 w-4" />;
      case 'item_count': return <Hash className="h-4 w-4" />;
      case 'last_updated': return <Calendar className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Main Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            value={filters.searchQuery || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
          {filters.searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSearchChange('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex border border-border rounded-lg p-1">
          <Button
            variant={filters.viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('grid')}
            className="h-8 px-3"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={filters.viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleViewModeChange('list')}
            className="h-8 px-3"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        {/* Advanced Filters Toggle */}
        <Button
          variant={showAdvanced ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
              {[filters.searchQuery, filters.isPrivate !== undefined, filters.sortBy !== 'newest'].filter(Boolean).length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Sort Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort by</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'name', label: 'Name' },
                  { value: 'item_count', label: 'Items' },
                  { value: 'last_updated', label: 'Updated' }
                ].map(option => (
                  <Button
                    key={option.value}
                    variant={filters.sortBy === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleSortChange(option.value as CollectionFiltersState['sortBy'])}
                    className="justify-start gap-2"
                  >
                    {getSortIcon(option.value as CollectionFiltersState['sortBy'])}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Privacy Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Privacy</label>
              <div className="flex gap-2">
                <Button
                  variant={filters.isPrivate === undefined ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePrivacyFilter(undefined)}
                  className="gap-2"
                >
                  All Collections
                </Button>
                <Button
                  variant={filters.isPrivate === false ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePrivacyFilter(false)}
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Public
                </Button>
                <Button
                  variant={filters.isPrivate === true ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePrivacyFilter(true)}
                  className="gap-2"
                >
                  <EyeOff className="h-4 w-4" />
                  Private
                </Button>
              </div>
            </div>

            {/* Filter Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {totalCount !== undefined && (
                  <>
                    {totalCount} collection{totalCount !== 1 ? 's' : ''} 
                    {hasActiveFilters && ' (filtered)'}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onResetFilters}
                    className="gap-2"
                  >
                    <X className="h-3 w-3" />
                    Reset
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvanced(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && !showAdvanced && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Filters:</span>
          
          {filters.searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: "{filters.searchQuery}"
              <button onClick={() => handleSearchChange('')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.isPrivate !== undefined && (
            <Badge variant="secondary" className="gap-1">
              {filters.isPrivate ? 'Private' : 'Public'}
              <button onClick={() => handlePrivacyFilter(undefined)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {filters.sortBy !== 'newest' && (
            <Badge variant="secondary" className="gap-1">
              Sort: {getSortLabel(filters.sortBy)}
              <button onClick={() => handleSortChange('newest')}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
} 
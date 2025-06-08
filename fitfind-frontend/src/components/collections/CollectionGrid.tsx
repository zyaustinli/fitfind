"use client";

import { CollectionCard } from "./CollectionCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, Images, Loader2 } from "lucide-react";
import type { Collection, CollectionFiltersState } from "@/types";

interface CollectionGridProps {
  collections: Collection[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onCollectionClick?: (collection: Collection) => void;
  onCreateCollection?: () => void;
  onEditCollection?: (collection: Collection) => void;
  onDeleteCollection?: (collection: Collection) => void;
  onShareCollection?: (collection: Collection) => void;
  selectedCollections?: Set<string>;
  onSelectionChange?: (collection: Collection, selected: boolean) => void;
  showSelection?: boolean;
  filters: CollectionFiltersState;
  className?: string;
}

export function CollectionGrid({
  collections,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onCollectionClick,
  onCreateCollection,
  onEditCollection,
  onDeleteCollection,
  onShareCollection,
  selectedCollections = new Set(),
  onSelectionChange,
  showSelection = false,
  filters,
  className
}: CollectionGridProps) {
  const isEmpty = collections.length === 0 && !isLoading;

  if (isEmpty) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Images className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No collections yet
          </h3>
          <p className="text-muted-foreground mb-6">
            Create your first collection to organize your saved items. Collections help you group related items together.
          </p>
          {onCreateCollection && (
            <Button onClick={onCreateCollection} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Collection
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Grid Container */}
      <div className={cn(
        "grid gap-6",
        filters.viewMode === 'grid' 
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
          : "grid-cols-1"
      )}>
        {/* Create Collection Card (only in grid view) */}
        {filters.viewMode === 'grid' && onCreateCollection && (
          <Card 
            className="group relative overflow-hidden transition-all hover:shadow-lg cursor-pointer border-dashed border-2 border-muted-foreground/25 hover:border-primary/50"
            onClick={onCreateCollection}
          >
            <div className="aspect-video bg-muted/50 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-background border border-border rounded-full flex items-center justify-center mx-auto mb-2 group-hover:border-primary transition-colors">
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Create Collection
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Collection Cards */}
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            onClick={onCollectionClick}
            onEdit={onEditCollection}
            onDelete={onDeleteCollection}
            onShare={onShareCollection}
            isSelected={selectedCollections.has(collection.id)}
            onSelect={onSelectionChange}
            showCheckbox={showSelection}
            viewMode={filters.viewMode}
          />
        ))}

        {/* Loading placeholder cards */}
        {isLoading && (
          <>
            {Array.from({ length: 8 }).map((_, index) => (
              <Card key={`loading-${index}`} className="overflow-hidden">
                {filters.viewMode === 'grid' ? (
                  <>
                    <div className="aspect-video bg-muted animate-pulse" />
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                        <div className="flex justify-between">
                          <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                          <div className="h-3 bg-muted rounded w-12 animate-pulse" />
                        </div>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <div className="flex gap-4 p-4">
                    <div className="w-20 h-20 bg-muted rounded-lg animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="flex gap-4">
                        <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                        <div className="h-3 bg-muted rounded w-12 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}
      </div>

      {/* Create Collection Button (list view) */}
      {filters.viewMode === 'list' && onCreateCollection && collections.length > 0 && (
        <Card 
          className="group relative overflow-hidden transition-all hover:shadow-md cursor-pointer border-dashed border-2 border-muted-foreground/25 hover:border-primary/50"
          onClick={onCreateCollection}
        >
          <div className="flex items-center gap-4 p-6">
            <div className="w-12 h-12 bg-background border border-border rounded-full flex items-center justify-center group-hover:border-primary transition-colors">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div>
              <h3 className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                Create New Collection
              </h3>
              <p className="text-sm text-muted-foreground">
                Organize your saved items into collections
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Load More Button */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-6">
          <Button 
            variant="outline" 
            onClick={onLoadMore}
            className="gap-2"
          >
            Load More Collections
          </Button>
        </div>
      )}

      {/* Loading More Indicator */}
      {isLoading && collections.length > 0 && (
        <div className="flex justify-center items-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading more collections...</span>
        </div>
      )}
    </div>
  );
} 
"use client";

import Link from "next/link";
import { FolderHeart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Collection } from "@/types";

interface CollectionCardProps {
  collection: Collection;
  className?: string;
}

export function CollectionCard({ collection, className = "" }: CollectionCardProps) {
  const itemCount = collection.item_count || 0;
  
  return (
    <Link href={`/collections/${collection.id}`} className={className}>
      <div className="group relative bg-background/50 border border-border/50 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl cursor-pointer h-80">
        {/* Cover Image */}
        <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 to-[#6b7f3a]/10 flex items-center justify-center relative overflow-hidden">
          {collection.cover_image_url ? (
            <img 
              src={collection.cover_image_url} 
              alt={collection.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="relative">
              <FolderHeart className="w-12 h-12 text-primary opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-[#6b7f3a]/5 rounded-full blur-xl"></div>
            </div>
          )}
          
          {/* Item Count Badge */}
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </Badge>
          </div>


        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">
            {collection.name}
          </h3>
          {collection.description && (
            <p className="text-muted-foreground text-sm line-clamp-2 flex-1">
              {collection.description}
            </p>
          )}
        </div>

        {/* Hover Indicator */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary to-[#6b7f3a] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
      </div>
    </Link>
  );
} 
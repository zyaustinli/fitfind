"use client";

import { Heart, Search, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WishlistEmptyProps {
  onStartShopping?: () => void;
  className?: string;
}

export function WishlistEmpty({ onStartShopping, className }: WishlistEmptyProps) {
  const handleStartShopping = () => {
    if (onStartShopping) {
      onStartShopping();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      {/* Icon with gradient background */}
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-full flex items-center justify-center">
          <Heart className="w-12 h-12 text-primary" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-full flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>
      </div>

      {/* Main message */}
      <h3 className="text-2xl font-semibold text-foreground mb-4">
        Your wishlist is waiting
      </h3>
      
      <p className="text-muted-foreground mb-8 max-w-md leading-relaxed">
        Start exploring and save items you love. Build your perfect collection of fashion finds and never lose track of that must-have piece again.
      </p>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button
          onClick={handleStartShopping}
          className="flex-1 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          size="lg"
        >
          <Search className="w-4 h-4 mr-2" />
          Discover Items
        </Button>
        
        <Button
          variant="outline"
          onClick={() => window.location.href = '/history'}
          className="flex-1"
          size="lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Browse History
        </Button>
      </div>

      {/* Tips */}
      <div className="mt-12 max-w-2xl">
        <h4 className="text-sm font-medium text-foreground mb-4">💡 Pro Tips</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="font-medium mb-1">Upload Images</div>
            <div>Take photos of outfits you love and let AI find similar items</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="font-medium mb-1">Add Notes</div>
            <div>Save personal notes and tags to organize your wishlist</div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="font-medium mb-1">Share Items</div>
            <div>Share your favorite finds with friends and get their opinions</div>
          </div>
        </div>
      </div>
    </div>
  );
} 
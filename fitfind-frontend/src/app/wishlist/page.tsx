"use client";

import { Heart, ShoppingBag, Search } from "lucide-react";

export default function WishlistPage() {
  return (
    <div className="h-full p-8 bg-gradient-to-br from-muted/30 to-primary/5">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Wishlist</h1>
          <p className="text-muted-foreground">
            Save and organize your favorite fashion finds
          </p>
        </div>

        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
              <Heart className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Your wishlist is empty</h3>
            <p className="text-muted-foreground mb-4">
              Start searching for outfits and save items you love
            </p>
            <a 
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Search className="h-4 w-4" />
              Discover Items
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 
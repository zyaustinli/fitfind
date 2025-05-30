"use client";

import React from 'react';
import { useSearchHistory, useWishlist } from '@/hooks';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Demonstration component showing how to use both useSearchHistory and useWishlist hooks
 * This serves as both documentation and a test component.
 */
export function HooksDemo() {
  const { user } = useAuth();
  
  // Initialize search history hook
  const {
    history,
    loading: historyLoading,
    error: historyError,
    filteredHistory,
    isEmpty: historyIsEmpty,
    totalCount: historyTotal,
    refresh: refreshHistory,
    setFilters: setHistoryFilters,
  } = useSearchHistory({
    autoFetch: true,
    initialLimit: 10
  });

  // Initialize wishlist hook
  const {
    wishlist,
    loading: wishlistLoading,
    error: wishlistError,
    filteredWishlist,
    isEmpty: wishlistIsEmpty,
    totalCount: wishlistTotal,
    addItem,
    removeItem,
    isInWishlist,
    refresh: refreshWishlist,
    setFilters: setWishlistFilters,
  } = useWishlist({
    autoFetch: true,
    initialLimit: 10
  });

  if (!user) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Hooks Demo</h2>
        <p className="text-muted-foreground">Please log in to see the hooks in action.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">State Management Hooks Demo</h2>
        <p className="text-muted-foreground">
          Demonstrating the useSearchHistory and useWishlist hooks implementation.
        </p>
      </div>

      {/* Search History Section */}
      <section className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Search History Hook</h3>
          <button
            onClick={refreshHistory}
            disabled={historyLoading.isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {historyLoading.isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Items:</span> {historyTotal}
            </div>
            <div>
              <span className="font-medium">Filtered:</span> {filteredHistory.length}
            </div>
            <div>
              <span className="font-medium">Loading:</span> {historyLoading.isLoading ? 'Yes' : 'No'}
            </div>
            <div>
              <span className="font-medium">Has Error:</span> {historyError.hasError ? 'Yes' : 'No'}
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <h4 className="font-medium">Filters:</h4>
            <div className="flex gap-2 flex-wrap">
              <select
                onChange={(e) => setHistoryFilters({ sortBy: e.target.value as any })}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="most_items">Most Items</option>
                <option value="most_products">Most Products</option>
              </select>
              <input
                type="text"
                placeholder="Search clothing items..."
                onChange={(e) => setHistoryFilters({ searchQuery: e.target.value || undefined })}
                className="px-3 py-1 border rounded text-sm"
              />
            </div>
          </div>

          {/* Results */}
          <div className="border rounded p-4 bg-gray-50 min-h-[100px]">
            {historyLoading.isLoading && (
              <div className="text-center text-muted-foreground">
                {historyLoading.message || 'Loading...'}
              </div>
            )}
            
            {historyError.hasError && (
              <div className="text-red-600 text-center">
                Error: {historyError.message}
              </div>
            )}
            
            {!historyLoading.isLoading && !historyError.hasError && historyIsEmpty && (
              <div className="text-center text-muted-foreground">
                No search history found. Start searching to see results here!
              </div>
            )}
            
            {!historyLoading.isLoading && !historyError.hasError && !historyIsEmpty && (
              <div className="space-y-2">
                <h5 className="font-medium">Recent Searches:</h5>
                {filteredHistory.slice(0, 3).map((item) => (
                  <div key={item.id} className="text-sm p-2 bg-white rounded border">
                    <div className="font-medium">{item.search_sessions.image_filename}</div>
                    <div className="text-muted-foreground">
                      {item.search_sessions.num_items_identified} items, {item.search_sessions.num_products_found} products
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {filteredHistory.length > 3 && (
                  <div className="text-sm text-muted-foreground">
                    ...and {filteredHistory.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Wishlist Section */}
      <section className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Wishlist Hook</h3>
          <button
            onClick={refreshWishlist}
            disabled={wishlistLoading.isLoading}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {wishlistLoading.isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Total Items:</span> {wishlistTotal}
            </div>
            <div>
              <span className="font-medium">Filtered:</span> {filteredWishlist.length}
            </div>
            <div>
              <span className="font-medium">Loading:</span> {wishlistLoading.isLoading ? 'Yes' : 'No'}
            </div>
            <div>
              <span className="font-medium">Has Error:</span> {wishlistError.hasError ? 'Yes' : 'No'}
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <h4 className="font-medium">Filters:</h4>
            <div className="flex gap-2 flex-wrap">
              <select
                onChange={(e) => setWishlistFilters({ sortBy: e.target.value as any })}
                className="px-3 py-1 border rounded text-sm"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="rating">Rating: High to Low</option>
                <option value="title">Title: A to Z</option>
              </select>
              <input
                type="text"
                placeholder="Search products..."
                onChange={(e) => setWishlistFilters({ searchQuery: e.target.value || undefined })}
                className="px-3 py-1 border rounded text-sm"
              />
            </div>
          </div>

          {/* Demo Actions */}
          <div className="space-y-2">
            <h4 className="font-medium">Test Actions:</h4>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => addItem('demo-product-1', 'Added from demo')}
                className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
              >
                Add Demo Item
              </button>
              <button
                onClick={() => removeItem('demo-product-1')}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
              >
                Remove Demo Item
              </button>
              <div className="text-sm self-center">
                Demo item is {isInWishlist('demo-product-1') ? 'in' : 'not in'} wishlist
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="border rounded p-4 bg-gray-50 min-h-[100px]">
            {wishlistLoading.isLoading && (
              <div className="text-center text-muted-foreground">
                {wishlistLoading.message || 'Loading...'}
              </div>
            )}
            
            {wishlistError.hasError && (
              <div className="text-red-600 text-center">
                Error: {wishlistError.message}
              </div>
            )}
            
            {!wishlistLoading.isLoading && !wishlistError.hasError && wishlistIsEmpty && (
              <div className="text-center text-muted-foreground">
                Your wishlist is empty. Add some items to see them here!
              </div>
            )}
            
            {!wishlistLoading.isLoading && !wishlistError.hasError && !wishlistIsEmpty && (
              <div className="space-y-2">
                <h5 className="font-medium">Wishlist Items:</h5>
                {filteredWishlist.slice(0, 3).map((item) => (
                  <div key={item.id} className="text-sm p-2 bg-white rounded border">
                    <div className="font-medium">{item.products.title}</div>
                    <div className="text-muted-foreground">
                      {item.products.price ? `$${item.products.price}` : 'Price not available'} • {item.products.source}
                    </div>
                    {item.notes && (
                      <div className="text-xs text-muted-foreground">
                        Note: {item.notes}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Added: {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
                {filteredWishlist.length > 3 && (
                  <div className="text-sm text-muted-foreground">
                    ...and {filteredWishlist.length - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Implementation Summary */}
      <section className="border rounded-lg p-6 bg-blue-50">
        <h3 className="text-xl font-semibold mb-4">Implementation Status</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>✅ useSearchHistory hook - Complete with pagination, filtering, and error handling</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>✅ useWishlist hook - Complete with CRUD operations and optimistic updates</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>✅ TypeScript types - Comprehensive interface definitions</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>✅ API integration - All endpoints implemented and tested</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span>✅ Authentication integration - Seamless user context handling</span>
          </div>
        </div>
      </section>
    </div>
  );
} 
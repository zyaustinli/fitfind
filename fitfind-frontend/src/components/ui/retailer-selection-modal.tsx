"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, ArrowRight, Clock, AlertCircle } from "lucide-react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { cn } from "@/lib/utils";
import { formatRetailerName } from "@/lib/data-transform";
import type { RetailerSelectionModalProps, RetailerSelectionOption } from "@/types";

export function RetailerSelectionModal({
  isOpen,
  onClose,
  product,
  retailers,
  onSelect,
  isLoading = false
}: RetailerSelectionModalProps) {
  const [selectedRetailer, setSelectedRetailer] = useState<RetailerSelectionOption | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Reset selection when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedRetailer(null);
      setIsNavigating(false);
    }
  }, [isOpen]);

  const handleRetailerSelect = async (retailer: RetailerSelectionOption) => {
    setSelectedRetailer(retailer);
    setIsNavigating(true);
    
    try {
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Call the onSelect callback
      onSelect(retailer);
      
      // Open the retailer URL
      window.open(retailer.directLink.retailer_url, '_blank', 'noopener,noreferrer');
      
      // Close modal after successful navigation
      onClose();
    } catch (error) {
      console.error('Error navigating to retailer:', error);
      setIsNavigating(false);
    }
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Choose Your Retailer
              </h2>
              <p className="text-sm text-gray-600 line-clamp-2">
                {product.title || 'Select where you\'d like to shop for this item'}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <div className="text-xs text-gray-500">
                  {retailers.length} retailer{retailers.length !== 1 ? 's' : ''} available
                </div>
                {product.price && (
                  <>
                    <div className="w-1 h-1 bg-gray-300 rounded-full" />
                    <div className="text-xs text-gray-500">
                      Starting from {product.price}
                    </div>
                  </>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 h-auto"
              disabled={isNavigating}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close modal</span>
            </Button>
          </div>

          {/* Content */}
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Clock className="h-8 w-8 text-gray-400 animate-pulse mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Loading retailers...</p>
                </div>
              </div>
            ) : retailers.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 mb-2">No retailers available</p>
                  <p className="text-xs text-gray-500">Direct links could not be found for this product</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide">
                {retailers.map((retailer, index) => {
                  const isSelected = selectedRetailer?.directLink.id === retailer.directLink.id;
                  const isDisabled = isNavigating && !isSelected;

                  return (
                    <button
                      key={retailer.directLink.id}
                      onClick={() => handleRetailerSelect(retailer)}
                      disabled={isDisabled}
                      className={cn(
                        'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
                        'hover:border-green-300 hover:bg-green-50/50 focus:outline-none focus:ring-2 focus:ring-[#556b2f] focus:ring-offset-2',
                        isSelected && isNavigating 
                          ? 'border-[#556b2f] bg-green-50 ring-2 ring-[#556b2f] ring-offset-2' 
                          : 'border-gray-200 bg-white',
                        isDisabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate mb-1">
                            {retailer.displayName}
                          </h3>
                          <p className="text-sm text-gray-500 truncate">
                            {formatUrl(retailer.directLink.retailer_url)}
                          </p>
                        </div>

                        {/* Action Indicator */}
                        <div className="flex items-center gap-2 ml-4">
                          {isSelected && isNavigating ? (
                            <div className="flex items-center gap-2 text-[#556b2f]">
                              <Clock className="h-4 w-4 animate-pulse" />
                              <span className="text-sm font-medium">Opening...</span>
                            </div>
                          ) : (
                            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-[#556b2f] transition-colors" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 bg-gray-50 border-t border-gray-100">
            <div className="text-xs text-gray-500">
              All links are verified and secure
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isNavigating}
              >
                Cancel
              </Button>
              {product.link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.open(product.link!, '_blank', 'noopener,noreferrer');
                    onClose();
                  }}
                  disabled={isNavigating}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Google Shopping
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
} 
"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, Star, Shield, Store, ArrowRight, Clock, AlertCircle } from "lucide-react";
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

  const getTrustBadge = (trustScore: number) => {
    if (trustScore >= 80) {
      return {
        icon: Shield,
        text: 'Trusted',
        color: 'text-green-600 bg-green-50 border-green-200',
      };
    } else if (trustScore >= 60) {
      return {
        icon: Star,
        text: 'Verified',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
      };
    }
    return null;
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
        <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Choose Your Preferred Retailer
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
                  const trustBadge = getTrustBadge(retailer.trustScore || 0);
                  const isSelected = selectedRetailer?.directLink.id === retailer.directLink.id;
                  const isDisabled = isNavigating && !isSelected;

                  return (
                    <button
                      key={retailer.directLink.id}
                      onClick={() => handleRetailerSelect(retailer)}
                      disabled={isDisabled}
                      className={cn(
                        'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
                        'hover:border-blue-300 hover:bg-blue-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                        isSelected && isNavigating 
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2' 
                          : 'border-gray-200 bg-white',
                        isDisabled && 'opacity-50 cursor-not-allowed',
                        retailer.isRecommended && !isSelected && 'ring-1 ring-green-200 border-green-300'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {/* Retailer Icon */}
                          <div className={cn(
                            'flex items-center justify-center w-10 h-10 rounded-lg',
                            retailer.isRecommended ? 'bg-green-100' : 'bg-gray-100'
                          )}>
                            <Store className={cn(
                              'h-5 w-5',
                              retailer.isRecommended ? 'text-green-600' : 'text-gray-600'
                            )} />
                          </div>

                          {/* Retailer Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900 truncate">
                                {retailer.displayName}
                              </h3>
                              {retailer.isRecommended && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                  Recommended
                                </span>
                              )}
                              {trustBadge && (
                                <span className={cn(
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                                  trustBadge.color
                                )}>
                                  <trustBadge.icon className="h-3 w-3" />
                                  {trustBadge.text}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 truncate">
                              {formatUrl(retailer.directLink.retailer_url)}
                            </p>
                            {retailer.trustScore && (
                              <div className="flex items-center gap-1 mt-1">
                                <div className="flex">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={cn(
                                        'h-3 w-3',
                                        i < Math.floor(retailer.trustScore! / 20) 
                                          ? 'text-yellow-400 fill-current' 
                                          : 'text-gray-300'
                                      )}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-500 ml-1">
                                  Trust Score: {retailer.trustScore}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Indicator */}
                        <div className="flex items-center gap-2">
                          {isSelected && isNavigating ? (
                            <div className="flex items-center gap-2 text-blue-600">
                              <Clock className="h-4 w-4 animate-pulse" />
                              <span className="text-sm font-medium">Opening...</span>
                            </div>
                          ) : (
                            <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
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
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="h-4 w-4" />
              <span>All links are verified and secure</span>
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
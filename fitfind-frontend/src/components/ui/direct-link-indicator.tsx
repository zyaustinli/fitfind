"use client";

import { Link, ExternalLink, Store, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DirectLinksIndicatorProps, ClothingItem } from "@/types";

export function DirectLinksIndicator({ 
  product, 
  showCount = true, 
  size = 'md', 
  variant = 'badge' 
}: DirectLinksIndicatorProps) {
  const directLinks = product.direct_links || [];
  const activeLinks = directLinks.filter(link => link.is_active);
  const linkCount = activeLinks.length;

  // Size configurations
  const sizeClasses = {
    sm: {
      badge: 'px-1.5 py-0.5 text-xs',
      icon: 'h-3 w-3',
      text: 'text-xs',
    },
    md: {
      badge: 'px-2 py-1 text-xs',
      icon: 'h-4 w-4',
      text: 'text-sm',
    },
    lg: {
      badge: 'px-3 py-1.5 text-sm',
      icon: 'h-5 w-5',
      text: 'text-base',
    },
  };

  // Determine status and styling
  const getStatusConfig = () => {
    if (linkCount === 0) {
      return {
        status: 'none',
        icon: ExternalLink,
        text: 'Google Shopping',
        bgColor: 'bg-gray-100 text-gray-600',
        iconColor: 'text-gray-500',
        borderColor: 'border-gray-200',
      };
    } else if (linkCount === 1) {
      return {
        status: 'single',
        icon: Store,
        text: 'Direct Link',
        bgColor: 'bg-green-100 text-green-800',
        iconColor: 'text-green-600',
        borderColor: 'border-green-200',
      };
    } else {
      return {
        status: 'multiple',
        icon: Link,
        text: `${linkCount} Retailers`,
        bgColor: 'bg-blue-100 text-blue-800',
        iconColor: 'text-blue-600',
        borderColor: 'border-blue-200',
      };
    }
  };

  const statusConfig = getStatusConfig();
  const { badge: badgeSize, icon: iconSize, text: textSize } = sizeClasses[size];
  const IconComponent = statusConfig.icon;

  // Badge variant
  if (variant === 'badge') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full font-medium transition-colors',
          badgeSize,
          statusConfig.bgColor,
          statusConfig.borderColor,
          'border'
        )}
        title={
          linkCount === 0 
            ? 'Google Shopping link only' 
            : linkCount === 1 
              ? 'Direct retailer link available' 
              : `${linkCount} direct retailer links available`
        }
      >
        <IconComponent className={cn(iconSize, statusConfig.iconColor)} />
        {showCount && <span>{statusConfig.text}</span>}
      </span>
    );
  }

  // Icon only variant
  if (variant === 'icon') {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full p-1',
          statusConfig.bgColor
        )}
        title={
          linkCount === 0 
            ? 'Google Shopping link only' 
            : linkCount === 1 
              ? 'Direct retailer link available' 
              : `${linkCount} direct retailer links available`
        }
      >
        <IconComponent className={cn(iconSize, statusConfig.iconColor)} />
        {showCount && linkCount > 1 && (
          <span 
            className={cn(
              'ml-1 min-w-[1rem] text-center',
              textSize,
              statusConfig.iconColor
            )}
          >
            {linkCount}
          </span>
        )}
      </div>
    );
  }

  // Text variant
  if (variant === 'text') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1',
          textSize,
          statusConfig.iconColor
        )}
        title={
          linkCount === 0 
            ? 'Google Shopping link only' 
            : linkCount === 1 
              ? 'Direct retailer link available' 
              : `${linkCount} direct retailer links available`
        }
      >
        <IconComponent className={iconSize} />
        {showCount && <span>{statusConfig.text}</span>}
      </span>
    );
  }

  return null;
}

// Extraction Status Indicator Component
export function ExtractionStatusIndicator({ 
  status, 
  extractedCount, 
  totalCount, 
  size = 'md' 
}: {
  status: 'pending' | 'extracting' | 'completed' | 'failed' | 'partial';
  extractedCount: number;
  totalCount: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: { icon: 'h-3 w-3', text: 'text-xs', badge: 'px-1.5 py-0.5' },
    md: { icon: 'h-4 w-4', text: 'text-sm', badge: 'px-2 py-1' },
    lg: { icon: 'h-5 w-5', text: 'text-base', badge: 'px-3 py-1.5' },
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: Clock,
          text: 'Extraction Pending',
          bgColor: 'bg-yellow-100 text-yellow-800',
          iconColor: 'text-yellow-600',
          animate: false,
        };
      case 'extracting':
        return {
          icon: Clock,
          text: 'Extracting Links...',
          bgColor: 'bg-blue-100 text-blue-800',
          iconColor: 'text-blue-600',
          animate: true,
        };
      case 'completed':
        return {
          icon: CheckCircle,
          text: `${extractedCount}/${totalCount} Products Enhanced`,
          bgColor: 'bg-green-100 text-green-800',
          iconColor: 'text-green-600',
          animate: false,
        };
      case 'failed':
        return {
          icon: XCircle,
          text: 'Extraction Failed',
          bgColor: 'bg-red-100 text-red-800',
          iconColor: 'text-red-600',
          animate: false,
        };
      case 'partial':
        return {
          icon: CheckCircle,
          text: `${extractedCount}/${totalCount} Products Enhanced`,
          bgColor: 'bg-orange-100 text-orange-800',
          iconColor: 'text-orange-600',
          animate: false,
        };
      default:
        return {
          icon: Clock,
          text: 'Unknown Status',
          bgColor: 'bg-gray-100 text-gray-800',
          iconColor: 'text-gray-600',
          animate: false,
        };
    }
  };

  const statusConfig = getStatusConfig();
  const { icon: iconSize, text: textSize, badge: badgeSize } = sizeClasses[size];
  const IconComponent = statusConfig.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        badgeSize,
        textSize,
        statusConfig.bgColor
      )}
    >
      <IconComponent 
        className={cn(
          iconSize, 
          statusConfig.iconColor,
          statusConfig.animate && 'animate-pulse'
        )} 
      />
      <span>{statusConfig.text}</span>
    </span>
  );
}

// Compact retailer count badge
export function RetailerCountBadge({ 
  count, 
  variant = 'default' 
}: { 
  count: number; 
  variant?: 'default' | 'compact' | 'detailed' 
}) {
  if (count === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center justify-center w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full">
        {count > 99 ? '99+' : count}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
        <Store className="h-3 w-3" />
        <span>{count} {count === 1 ? 'retailer' : 'retailers'}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 bg-blue-500 text-white text-xs font-medium rounded-full">
      {count > 99 ? '99+' : count}
    </div>
  );
} 
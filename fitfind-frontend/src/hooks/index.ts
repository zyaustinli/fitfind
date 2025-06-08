// State management hooks for FitFind
export { useSearchHistory } from './useSearchHistory';
export { useWishlist } from './useWishlist';
export { useCollections } from './useCollections';
export { useSaveItem, useBulkSaveItem } from './useSaveItem';
export { useCollectionItems } from './useCollectionItems';
export { useStableFetch } from './useStableFetch';
export { usePageVisibility } from './usePageVisibility';
export { useNetwork } from './useNetwork';

// Re-export types for convenience
export type {
  UseSearchHistoryReturn,
  UseSearchHistoryOptions,
} from './useSearchHistory';

export type {
  UseWishlistReturn,
  UseWishlistOptions,
} from './useWishlist';

export type {
  UseCollectionsReturn,
  UseCollectionsOptions,
} from './useCollections';

export type {
  UseSaveItemReturn,
  UseSaveItemOptions,
  UseBulkSaveItemReturn,
  UseBulkSaveItemOptions,
} from './useSaveItem';

export type {
  UseCollectionItemsReturn,
  UseCollectionItemsOptions,
} from './useCollectionItems'; 
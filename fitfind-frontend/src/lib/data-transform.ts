import { 
  BackendUploadResponse,
  BackendRedoResponse, 
  BackendClothingItem, 
  BackendProduct,
  ClothingItem,
  Product
} from '@/types';

// Transform backend product to frontend product
export function transformProduct(backendProduct: BackendProduct): Product {
  return {
    id: backendProduct.id,
    product_id: backendProduct.id,
    title: backendProduct.title,
    price: backendProduct.price,
    price_numeric: backendProduct.price_numeric,
    old_price: backendProduct.old_price,
    old_price_numeric: backendProduct.old_price_numeric,
    discount_percentage: backendProduct.discount_percentage,
    image_url: backendProduct.image_url,
    product_url: backendProduct.product_url,
    source: backendProduct.source,
    source_icon: backendProduct.source_icon,
    rating: backendProduct.rating,
    review_count: backendProduct.review_count,
    delivery_info: backendProduct.delivery_info,
    tags: backendProduct.tags,
    is_saved: backendProduct.is_saved,
  };
}

// Transform backend clothing item to frontend clothing item
export function transformClothingItem(backendItem: BackendClothingItem): ClothingItem {
  return {
    id: backendItem.query, // Use query as ID for frontend
    query: backendItem.query,
    item_type: backendItem.item_type,
    products: backendItem.products.map(transformProduct),
    total_products: backendItem.total_products,
    price_range: backendItem.price_range,
  };
}

// Transform backend upload response to frontend format
export function transformBackendData(response: BackendUploadResponse | BackendRedoResponse): ClothingItem[] {
  return response.cleaned_data.clothing_items.map(transformClothingItem);
}

// Group products by their clothing type - overloaded for both legacy and new backend data
export function groupProductsByType(clothingItems: ClothingItem[]): Record<string, ClothingItem[]>;
export function groupProductsByType(data: BackendCleanedData): Record<string, {
  items: ClothingItem[];
  priceRange: { min: number; max: number; average: number } | null;
  query: string;
}>;
export function groupProductsByType(input: ClothingItem[] | BackendCleanedData): any {
  // Handle legacy ClothingItem[] format
  if (Array.isArray(input)) {
    return input.reduce((acc, item) => {
      const type = item.item_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(item);
      return acc;
    }, {} as Record<string, ClothingItem[]>);
  }
  
  // Handle new BackendCleanedData format
  const data = input as BackendCleanedData;
  const grouped: Record<string, {
    items: ClothingItem[];
    priceRange: { min: number; max: number; average: number } | null;
    query: string;
  }> = {};

  data.clothing_items.forEach(clothingItem => {
    const type = clothingItem.item_type;
    
    // Convert backend products to frontend ClothingItem format
    const items: ClothingItem[] = clothingItem.products.map(product => {
      const item: ClothingItem = {
        query: clothingItem.query,
        title: product.title,
        link: product.product_url,
        price: product.price,
        extracted_price: product.price_numeric,
        source: product.source,
        rating: product.rating,
        reviews: product.review_count,
        thumbnail: product.image_url,
        product_id: product.id,
        is_saved: product.is_saved,
        shipping: product.delivery_info,
        tag: product.tags?.join(', ') || null
      };
      
      
      return item;
    });

    if (!grouped[type]) {
      grouped[type] = {
        items: [],
        priceRange: clothingItem.price_range,
        query: clothingItem.query
      };
    }
    
    grouped[type].items.push(...items);
  });

  return grouped;
}
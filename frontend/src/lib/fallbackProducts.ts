export type ProductSummary = { brand: string; description?: string; id: number | string; image: string; name: string; price: string; priceValue?: number; slug?: string; stock: number };

// Empty by design: failed API reads must not expose invented catalog data.
export const fallbackProducts: ProductSummary[] = [];

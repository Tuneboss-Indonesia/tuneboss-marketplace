/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface Window {
  showToast?: (title: string, desc: string) => void;
  isOtpVerified?: (email: string) => boolean;
  openOtpDialog?: (email: string, onComplete: () => void, isReopen?: boolean) => void;
  updateCheckoutBtn?: () => void;
  toggleCartItemSelection?: (id: string) => void;
  loadShippingOptions?: (location: string) => void;
  checkAuthStatus?: () => Promise<void> | void;
  openAuthDialog?: (mode?: string) => void;
}

interface CartItem {
  id: string;
  name: string;
  brand?: string;
  price: number;
  quantity: number;
  max?: number;
  image?: string;
  selected?: boolean;
}

interface LocationItem {
  display_name: string;
  lat?: string;
  lon?: string;
}

interface LeafletEvent {
  target: {
    getLatLng: () => { lat: number; lng: number };
  };
}

type LeafletMarker = any;
type LeafletMap = any;

interface Leaflet {
  map: (el: string | HTMLElement) => any;
  marker: (coords: [number, number], options?: Record<string, unknown>) => any;
  tileLayer: (url: string, options?: Record<string, unknown>) => { addTo: (map: any) => void };
}

interface Window {
  L?: Leaflet;
  scheduleBrowserLanguageSync?: () => void;
  removeCartItem: (id: string) => void;
  toggleAllCartItems: (selected: boolean) => void;
  setCartItemQuantity: (id: string, qtyStr: string) => void;
  updateCartItemQuantity: (id: string, delta: number) => void;
}

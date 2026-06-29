/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface Window {
  showToast?: (title: string, desc: string) => void;
  isOtpVerified?: (email: string) => boolean;
  openOtpDialog?: (email: string, onComplete: () => void, isReopen?: boolean) => void;
  updateCheckoutBtn?: () => void;
  toggleCartItemSelection?: (id: string) => void;
  loadShippingOptions?: (location: string) => void;
  checkAuthStatus?: () => void;
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

interface LeafletMarker {
  setLatLng: (coords: [number, number]) => this;
  on: (event: string, callback: (e: LeafletEvent) => void) => this;
  addTo: (map: unknown) => this;
}

interface LeafletMap {
  invalidateSize: () => void;
  setView: (coords: [number, number], zoom: number) => this;
}

interface Leaflet {
  map: (el: string | HTMLElement) => LeafletMap;
  marker: (coords: [number, number], options?: Record<string, unknown>) => LeafletMarker;
  tileLayer: (url: string, options?: Record<string, unknown>) => { addTo: (map: unknown) => void };
}

interface Window {
  L?: Leaflet;
  scheduleBrowserLanguageSync?: () => void;
  removeCartItem: (id: string) => void;
  toggleAllCartItems: (selected: boolean) => void;
  setCartItemQuantity: (id: string, qtyStr: string) => void;
  updateCartItemQuantity: (id: string, delta: number) => void;
}

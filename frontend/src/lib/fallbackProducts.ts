export type ProductSummary = { brand: string; description?: string; id: number | string; image: string; name: string; price: string; priceValue?: number; slug?: string; stock: number };

export const fallbackProducts: ProductSummary[] = [
  { id: 1, brand: "Honda", name: "Motorcycle ECU", price: "Rp. 599.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 14 },
  { id: 2, brand: "Yamaha", name: "ECU Flash Kit", price: "Rp. 299.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 20 },
  { id: 3, brand: "Kawasaki", name: "Race Tuning Pack", price: "Rp. 449.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 8 },
  { id: 4, brand: "Suzuki", name: "Street Tune Pack", price: "Rp. 349.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 16 },
  { id: 5, brand: "Honda", name: "Quickshifter Module", price: "Rp. 249.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 11 },
  { id: 6, brand: "Yamaha", name: "Launch Control", price: "Rp. 399.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 7 },
  { id: 7, brand: "Kawasaki", name: "Data Logger", price: "Rp. 199.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 18 },
  { id: 8, brand: "Suzuki", name: "Wiring Harness", price: "Rp. 149.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 25 },
  { id: 9, brand: "Honda", name: "Fuel Controller", price: "Rp. 329.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 12 },
  { id: 10, brand: "Yamaha", name: "Ignition Module", price: "Rp. 279.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 13 },
  { id: 11, brand: "Kawasaki", name: "Pit Limiter", price: "Rp. 189.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 9 },
  { id: 12, brand: "Suzuki", name: "Race Harness", price: "Rp. 229.000", image: "/images/tuneboss-motorcycle-ecu.png", stock: 10 },
];

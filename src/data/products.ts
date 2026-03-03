export interface Product {
  id: string;
  name: string;
  description: string;
  type: "varejo" | "atacado" | "ambos";
  icon: string;
  active: boolean;
  priceText?: string; // "R$ X,XX" or "Consulte no WhatsApp"
}

export interface WholesaleTier {
  productId: string;
  minQty: number;
  priceText: string;
}

// Mock products — will be replaced by Supabase data
export const products: Product[] = [
  {
    id: "galao-20l",
    name: "Galão de Água Mineral 20L",
    description: "Água mineral natural de procedência garantida. Ideal para residências e escritórios.",
    type: "ambos",
    icon: "droplets",
    active: true,
    priceText: "Consulte no WhatsApp",
  },
  {
    id: "agua-gas",
    name: "Água com Gás",
    description: "Água mineral gaseificada para quem prefere com gás.",
    type: "varejo",
    icon: "sparkles",
    active: true,
    priceText: "Consulte no WhatsApp",
  },
  {
    id: "suporte",
    name: "Suporte para Galão",
    description: "Suporte prático e resistente para galões de 20L.",
    type: "varejo",
    icon: "archive",
    active: true,
    priceText: "Consulte no WhatsApp",
  },
  {
    id: "bomba",
    name: "Bomba Manual/Automática",
    description: "Bomba para facilitar o uso do galão no dia a dia.",
    type: "varejo",
    icon: "zap",
    active: true,
    priceText: "Consulte no WhatsApp",
  },
];

// Mock wholesale tiers — will be replaced by Supabase data
export const wholesaleTiers: WholesaleTier[] = [
  { productId: "galao-20l", minQty: 10, priceText: "Consulte" },
  { productId: "galao-20l", minQty: 50, priceText: "Consulte" },
  { productId: "galao-20l", minQty: 100, priceText: "Consulte" },
];

export function getRetailProducts() {
  return products.filter((p) => p.active && (p.type === "varejo" || p.type === "ambos"));
}

export function getWholesaleProducts() {
  return products.filter((p) => p.active && (p.type === "atacado" || p.type === "ambos"));
}

export function getTiersForProduct(productId: string) {
  return wholesaleTiers.filter((t) => t.productId === productId);
}

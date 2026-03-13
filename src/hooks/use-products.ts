import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DbProduct = Tables<"products"> & { category_id?: string | null };
export type DbTier = Tables<"wholesale_price_tiers">;

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("created_at");
      if (error) throw error;
      return data as DbProduct[];
    },
  });
}

export function useWholesaleProducts() {
  return useQuery({
    queryKey: ["wholesale-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .in("type", ["atacado", "ambos"])
        .order("created_at");
      if (error) throw error;
      return data as DbProduct[];
    },
  });
}

export function useRetailProducts() {
  return useQuery({
    queryKey: ["retail-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .in("type", ["varejo", "ambos"])
        .order("created_at");
      if (error) throw error;
      return data as DbProduct[];
    },
  });
}

export function useTiers(productId?: string) {
  return useQuery({
    queryKey: ["tiers", productId],
    queryFn: async () => {
      let q = supabase.from("wholesale_price_tiers").select("*").order("min_qty");
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q;
      if (error) throw error;
      return data as DbTier[];
    },
  });
}

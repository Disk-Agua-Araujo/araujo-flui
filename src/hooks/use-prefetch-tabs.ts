import { useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/services/admin-api";

export function usePrefetchTabs() {
  const queryClient = useQueryClient();

  const prefetchOrders = () => {
    queryClient.prefetchQuery({
      queryKey: ["admin-orders-initial"],
      queryFn: () => adminApi.listOrders({ page: 1, pageSize: 20 }),
    });
  };

  const prefetchCustomers = () => {
    queryClient.prefetchQuery({
      queryKey: ["admin-customers"],
      queryFn: () => adminApi.listCustomers(),
    });
  };

  const prefetchProducts = () => {
    queryClient.prefetchQuery({
      queryKey: ["admin-products"],
      queryFn: () => adminApi.listProducts(),
    });
  };

  return { prefetchOrders, prefetchCustomers, prefetchProducts };
}

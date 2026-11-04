import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertProduct } from "@shared/schema";

export function useClientProducts(clientId: number) {
  return useQuery({
    queryKey: [api.products.list.path, clientId],
    queryFn: async () => {
      const url = buildUrl(api.products.list.path, { clientId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return api.products.list.responses[200].parse(await res.json());
    },
    enabled: !!clientId,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      data,
    }: {
      clientId: number;
      data: Omit<InsertProduct, "clientId">;
    }) => {
      const url = buildUrl(api.products.create.path, { clientId });
      const res = await fetch(url, {
        method: api.products.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create product");
      return api.products.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [api.products.list.path, variables.clientId],
      });
    },
  });
}

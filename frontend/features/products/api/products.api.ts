import { api } from "@/lib/axios";
import { Product } from "../types/product";

export const getProducts = async (): Promise<Product[]> => {
  return (await api.get("/products")).data;
};

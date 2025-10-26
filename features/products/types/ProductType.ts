export type ProductType = {
  image?: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  code: string;
  status?: "موجود" | "منتهي" | "قليل";
  stockAlert?: number;
};

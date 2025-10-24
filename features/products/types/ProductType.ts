export type ProductType = {
  image: string;
  name: string;
  code: string;
  price: number;
  category: string;
  stock: number;
  status: "موجود" | "منتهي" | "قليل";
};

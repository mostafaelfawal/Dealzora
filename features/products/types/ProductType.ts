export type ProductType = {
  id?: string;
  image: string;
  name: string;
  price: number;
  category: string;
  code: string;
  stock?: number | undefined;
  stockAlert?: number | undefined;
};

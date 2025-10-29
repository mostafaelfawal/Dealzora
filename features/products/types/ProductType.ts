export interface ProductType {
  id?: string;
  image: string;
  name: string;
  price: number;
  categories: string;
  code: string;
  stock?: number | undefined;
  stockAlert?: number | undefined;
};

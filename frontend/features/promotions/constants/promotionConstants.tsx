import {
  IconGift,
  IconPercentage,
  IconTag,
  ReactNode,
} from "@tabler/icons-react";
import { PromoKind, PromoScope } from "../types/promotion";

export const KINDS: {
  id: PromoKind;
  label: string;
  icon: ReactNode;
  hint: string;
}[] = [
  {
    id: "buy_get",
    label: "اشترِ واحصل",
    icon: <IconGift />,
    hint: "مثل: اشترِ 2 واحصل على 1 مجاناً",
  },
  {
    id: "percent",
    label: "خصم بنسبة",
    icon: <IconPercentage />,
    hint: "مثل: خصم 10% على الصنف",
  },
  {
    id: "amount",
    label: "خصم مبلغ",
    icon: <IconTag />,
    hint: "مثل: خصم 5 جنيهات على كل قطعة",
  },
];

export const SCOPES: { id: PromoScope; label: string }[] = [
  { id: "products", label: "أصناف أختارها" },
  { id: "category", label: "قسم كامل" },
  { id: "all", label: "كل المحل" },
];

export const BUY_GET_PRESETS = [
  [1, 1],
  [2, 1],
  [3, 1],
  [5, 1],
] as const;
export const PERCENT_PRESETS = [5, 10, 15, 20, 25, 50];

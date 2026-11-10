/** مقاسات ملصقات طابعات الباركود (عرض × ارتفاع بالمليمتر). الأفقي: العرض أكبر. */
export const LABEL_SIZES = [
  { value: "40x25", label: "40 × 25 مم (الأشهر)", width: 40, height: 25 },
  { value: "38x25", label: "38 × 25 مم", width: 38, height: 25 },
  { value: "50x25", label: "50 × 25 مم", width: 50, height: 25 },
  { value: "50x30", label: "50 × 30 مم", width: 50, height: 30 },
  { value: "58x40", label: "58 × 40 مم", width: 58, height: 40 },
  { value: "30x20", label: "30 × 20 مم (صغير)", width: 30, height: 20 },
] as const;

export type LabelSizeKey = (typeof LABEL_SIZES)[number]["value"];

export const DEFAULT_LABEL_SIZE: LabelSizeKey = "40x25";

export const LABEL_COPIES_MAX = 500;

export interface LabelPrefs {
  size: LabelSizeKey;
  showName: boolean;
  showPrice: boolean;
  showShop: boolean;
}

export const DEFAULT_LABEL_PREFS: LabelPrefs = {
  size: DEFAULT_LABEL_SIZE,
  showName: true,
  showPrice: true,
  showShop: false,
};

export function getLabelSize(key: LabelSizeKey) {
  return LABEL_SIZES.find((s) => s.value === key) ?? LABEL_SIZES[0];
}

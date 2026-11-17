import { formatPiastres } from "@/lib/format";

import { AppText, type AppTextProps } from "./AppText";

/** عملة العرض. التطبيق لا يعرف عملة المحل بعد (إعداد في البرنامج المكتبي): الجنيه افتراضياً. */
export const CURRENCY = "ج.م";

interface Props extends Omit<AppTextProps, "children"> {
  /** بالقروش (integer). */
  amount: number;
  hideCurrency?: boolean;
}

/** مبلغ بالقروش ← «1,250.00 ج.م» في سطر واحد يصغر ليتسع (الشاشات 360px). */
export function Money({ amount, hideCurrency, ...rest }: Props) {
  return (
    <AppText
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.6}
      {...rest}
    >
      {formatPiastres(amount)}
      {hideCurrency ? "" : ` ${CURRENCY}`}
    </AppText>
  );
}

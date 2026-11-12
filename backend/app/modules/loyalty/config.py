"""إعداد نقاط الولاء للمحل (يُحفظ في app_settings كـ JSON).

    الكسب:     كل earn_amount قرش مدفوع = نقطة واحدة          (1000 = كل 10 جنيه نقطة)
    الاستبدال: كل redeem_points نقطة = redeem_value قرش خصم   (100 نقطة = 500 = 5 جنيه)

الاستبدال بالباقات فقط (مضاعفات redeem_points) فيبقى الحساب أعداداً صحيحة بلا كسور،
ونفس الحساب حرفياً في الكاشير (frontend/lib/loyalty.ts).
"""

from pydantic import BaseModel, ConfigDict, Field


class LoyaltyConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    earn_amount: int = Field(1000, ge=1, le=100_000_000)
    redeem_points: int = Field(100, ge=1, le=1_000_000)
    redeem_value: int = Field(500, ge=1, le=100_000_000)
    # أقصى نسبة من الفاتورة تُدفع بالنقاط (الباقي فلوس).
    max_redeem_percent: int = Field(50, ge=1, le=100)


def earned_points(cfg: LoyaltyConfig, paid: int) -> int:
    """النقاط المكتسبة من مبلغ مدفوع (قروش)."""
    if not cfg.enabled or paid <= 0:
        return 0
    return paid // cfg.earn_amount


def redeem_discount(cfg: LoyaltyConfig, points: int) -> int:
    """قيمة خصم عدد نقاط (مضاعف لـ redeem_points) بالقروش."""
    return points // cfg.redeem_points * cfg.redeem_value


def max_redeemable(cfg: LoyaltyConfig, balance: int, base_amount: int) -> int:
    """أقصى نقاط يمكن استبدالها: من رصيد العميل، ولا يتجاوز خصمها النسبة من الفاتورة."""
    if not cfg.enabled or balance < cfg.redeem_points or base_amount <= 0:
        return 0
    cap_value = base_amount * cfg.max_redeem_percent // 100
    blocks = min(balance // cfg.redeem_points, cap_value // cfg.redeem_value)
    return max(blocks, 0) * cfg.redeem_points

"""قواعد التحقق القابلة لإعادة الاستخدام."""

from typing import Annotated

from pydantic import AfterValidator

from .constants import MAX_SHOP_NAME_LEN, MIN_SHOP_NAME_LEN


def _clean_shop_name(value: str) -> str:
    value = " ".join(value.split())
    if not (MIN_SHOP_NAME_LEN <= len(value) <= MAX_SHOP_NAME_LEN):
        raise ValueError(
            f"اسم المحل من {MIN_SHOP_NAME_LEN} إلى {MAX_SHOP_NAME_LEN} حرفاً"
        )
    return value


ShopName = Annotated[str, AfterValidator(_clean_shop_name)]

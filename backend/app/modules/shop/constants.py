"""ثوابت موديول المحل."""

from enum import StrEnum

MIN_SHOP_NAME_LEN = 2
MAX_SHOP_NAME_LEN = 100
ENTITY_SHOP = "shop"


class ShopError(StrEnum):
    ALREADY_EXISTS = "shop_exists"


ERROR_MESSAGES: dict[ShopError, str] = {
    ShopError.ALREADY_EXISTS: "بيانات المحل موجودة بالفعل",
}
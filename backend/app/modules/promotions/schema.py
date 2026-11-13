"""Pydantic schemas للعروض. المال بالقروش والكميات × 1000."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.core.validation import required_text

from .constants import MAX_NAME_LEN, MAX_PRODUCTS, PromoKind, PromoScope, PromoStatus

Name = required_text("اسم العرض", MAX_NAME_LEN)


class PromotionIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Name
    kind: PromoKind
    value: int = Field(0, ge=0, le=1_000_000_000)  # نسبة أو قروش
    buy_qty: int | None = Field(None, ge=1, le=1000)
    get_qty: int | None = Field(None, ge=1, le=1000)
    min_qty: int | None = Field(None, ge=1, le=1_000_000_000)
    scope: PromoScope = PromoScope.PRODUCTS
    category_id: str | None = Field(None, max_length=36)
    product_ids: list[str] = Field(default_factory=list, max_length=MAX_PRODUCTS)
    starts_on: date | None = None
    ends_on: date | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def _rules(self):
        if self.kind is PromoKind.PERCENT and not 1 <= self.value <= 100:
            raise ValueError("نسبة الخصم من 1 إلى 100")
        if self.kind is PromoKind.AMOUNT and self.value <= 0:
            raise ValueError("أدخل مبلغ الخصم")
        if self.kind is PromoKind.BUY_GET:
            if not self.buy_qty or not self.get_qty:
                raise ValueError("حدد كمية الشراء وكمية الهدية المجانية")
            self.value = 0
            self.min_qty = None
        else:
            self.buy_qty = self.get_qty = None
        if self.scope is PromoScope.CATEGORY and not self.category_id:
            raise ValueError("اختر القسم")
        if self.scope is PromoScope.PRODUCTS and not self.product_ids:
            raise ValueError("اختر صنفاً واحداً على الأقل")
        if self.scope is not PromoScope.CATEGORY:
            self.category_id = None
        if self.scope is not PromoScope.PRODUCTS:
            self.product_ids = []
        self.product_ids = list(dict.fromkeys(self.product_ids))
        if self.starts_on and self.ends_on and self.starts_on > self.ends_on:
            raise ValueError("تاريخ البداية بعد تاريخ النهاية")
        return self


class PromotionUpdate(PromotionIn):
    base_version: int = Field(ge=1)


class PromotionOut(BaseModel):
    id: str
    name: str
    kind: PromoKind
    value: int
    buy_qty: int | None
    get_qty: int | None
    min_qty: int | None
    scope: PromoScope
    category_id: str | None
    category_name: str | None
    product_ids: list[str]
    product_names: list[str]
    starts_on: date | None
    ends_on: date | None
    is_active: bool
    status: PromoStatus
    version: int
    created_at: datetime


class PromotionsSummaryOut(BaseModel):
    active: int
    scheduled: int
    expired: int
    paused: int

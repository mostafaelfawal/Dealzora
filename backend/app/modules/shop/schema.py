"""Pydantic schemas."""

from pydantic import BaseModel, ConfigDict

from .schema_validation import ShopName


class ShopOut(BaseModel):
    name: str | None  # None = لم يُعدّ النظام بعد


class ShopUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ShopName

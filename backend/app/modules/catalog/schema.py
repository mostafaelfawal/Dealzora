"""Pydantic schemas للأقسام ووحدات القياس."""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.core.text import collapse_spaces

from .constants import MAX_CATEGORY_NAME_LEN, MAX_UNIT_LEN


def _name_cleaner(label: str, max_len: int):
    def clean(value: str) -> str:
        value = collapse_spaces(value)
        if not value:
            raise ValueError(f"اسم {label} مطلوب")
        if len(value) > max_len:
            raise ValueError(f"اسم {label} أطول من {max_len} حرفاً")
        return value

    return clean


CategoryName = Annotated[str, AfterValidator(_name_cleaner("القسم", MAX_CATEGORY_NAME_LEN))]
MeasureUnitName = Annotated[str, AfterValidator(_name_cleaner("الوحدة", MAX_UNIT_LEN))]
BaseVersion = Annotated[int, Field(ge=1)]


# ================= الأقسام =================
class CategoryCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: CategoryName


class CategoryUpdate(CategoryCreate):
    base_version: BaseVersion


class CategoryOut(BaseModel):
    id: str
    name: str
    product_count: int
    version: int


# ================= الوحدات =================
class MeasureUnitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: MeasureUnitName
    allow_decimal: bool = False


class MeasureUnitUpdate(MeasureUnitCreate):
    base_version: BaseVersion


class MeasureUnitOut(BaseModel):
    id: str
    name: str
    allow_decimal: bool
    product_count: int
    version: int

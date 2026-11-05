"""ترقيم الصفحات: استعلام موحّد + استجابة عامة Page[T]."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from .constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

T = TypeVar("T")


def page_size_field(default: int = DEFAULT_PAGE_SIZE, **kwargs):
    """للموديولات التي تحتاج حجماً افتراضياً مختلفاً (أو alias مثل limit)."""
    return Field(default, ge=1, le=MAX_PAGE_SIZE, **kwargs)


class PageQuery(BaseModel):
    """وراثة هذا الكلاس تعطي page/page_size؛ أضف فوقه فلاتر الموديول."""

    model_config = ConfigDict(extra="forbid")

    page: int = Field(1, ge=1)
    page_size: int = page_size_field()


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def make_page(items: list, total: int, query: PageQuery) -> Page:
    return Page(items=items, total=total, page=query.page, page_size=query.page_size)
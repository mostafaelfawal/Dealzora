"""العمليات الجماعية: schemas مشتركة + منفّذ يعزل كل عنصر في معاملة مستقلة."""

from collections.abc import Callable

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .constants import MAX_BULK_ITEMS
from .errors import AppError


class BulkItemIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    base_version: int = Field(ge=1)


class BulkIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[BulkItemIn] = Field(min_length=1, max_length=MAX_BULK_ITEMS)


class BulkFailureOut(BaseModel):
    id: str
    code: str
    message: str


class BulkResultOut(BaseModel):
    succeeded: list[str]
    failed: list[BulkFailureOut]


def run_bulk(
    session: Session, data: BulkIn, action: Callable[[BulkItemIn], None]
) -> BulkResultOut:
    """ينفّذ action لكل عنصر (يتجاهل المكرر)، وفشل عنصر لا يوقف الباقي."""
    succeeded: list[str] = []
    failed: list[BulkFailureOut] = []
    seen: set[str] = set()
    for item in data.items:
        if item.id in seen:
            continue
        seen.add(item.id)
        try:
            action(item)
            succeeded.append(item.id)
        except AppError as exc:
            session.rollback()
            failed.append(BulkFailureOut(id=item.id, code=exc.code, message=exc.message))
    return BulkResultOut(succeeded=succeeded, failed=failed)
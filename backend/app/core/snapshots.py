"""لقطات الكيانات للـ Audit والـ Outbox، والفرق بين لقطتين."""

from datetime import date
from typing import Any


def jsonable(value: Any) -> Any:
    """date/datetime → نص ISO (datetime هي subclass من date)."""
    return value.isoformat() if isinstance(value, date) else value


def take_snapshot(obj: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    return {f: jsonable(getattr(obj, f)) for f in fields}


def diff_snapshots(
    before: dict[str, Any], after: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    return {
        key: {"from": before.get(key), "to": after.get(key)}
        for key in after
        if before.get(key) != after.get(key)
    }
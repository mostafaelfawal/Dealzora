"""دوال وقت مشتركة. (utcnow نفسها في core/base.py)"""

from datetime import datetime, timezone


def aware(value: datetime) -> datetime:
    """SQLite يرجّع datetime بلا منطقة زمنية؛ نعتبرها UTC."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
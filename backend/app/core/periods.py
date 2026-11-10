"""فترات التقارير بيوم الجهاز المحلي (نفس منطق المصروفات والخزنة والواجهة)."""

from datetime import date, datetime, time, timedelta, timezone


def local_today() -> date:
    from app.core.base import frozen_now

    frozen = frozen_now.get()
    return frozen.astimezone().date() if frozen else date.today()


def day_bounds_utc(day_from: date, day_to: date) -> tuple[datetime, datetime]:
    """[بداية اليوم الأول، بداية اليوم التالي للأخير) بتوقيت UTC، لمقارنة created_at."""
    start = datetime.combine(day_from, time.min).astimezone(timezone.utc)
    end = datetime.combine(day_to + timedelta(days=1), time.min).astimezone(timezone.utc)
    return start, end


def iter_days(day_from: date, day_to: date):
    day = day_from
    while day <= day_to:
        yield day
        day += timedelta(days=1)

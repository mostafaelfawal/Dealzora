"""حدود الطلبات في الذاكرة.

- _Window (نافذة منزلقة): /auth والمتجر، حدود صغيرة ودقيقة.
- _FixedWindow (عدّاد لكل دقيقة): الحد العام لكل IP على كل المسارات. رقمان فقط لكل IP، فلا تكبر
  الذاكرة مهما كثرت الطلبات أثناء هجوم.

يكفي لحماية /auth من التخمين والإغراق. كل worker له عدّاده، فالحد الفعلي = الحد × عدد الـ workers،
وهذا مقبول هنا (أسرار الفروع 256 بت وأكواد الربط 60 بت: التخمين مستحيل عملياً مع أي حد معقول).
"""

import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from .config import get_settings
from .errors import AppError


class TooManyRequests(AppError):
    status_code = 429


class _Window:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, period: float = 60.0) -> float | None:
        """None = مسموح. غير ذلك = ثوانٍ حتى يُسمح."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and now - hits[0] >= period:
                hits.popleft()
            if len(hits) >= limit:
                return period - (now - hits[0])
            hits.append(now)
            if len(self._hits) > 50_000:  # حماية الذاكرة من IPs كثيرة جداً
                self._hits = defaultdict(deque, {k: v for k, v in self._hits.items() if v})
            return None


class _FixedWindow:
    def __init__(self) -> None:
        self._counts: dict[str, list[float]] = {}  # key -> [بداية النافذة، العدد]
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, period: float = 60.0) -> float | None:
        """None = مسموح. غير ذلك = ثوانٍ حتى يُسمح."""
        now = time.monotonic()
        with self._lock:
            entry = self._counts.get(key)
            if entry is None or now - entry[0] >= period:
                if len(self._counts) > 100_000:  # حماية الذاكرة: نحذف النوافذ المنتهية
                    self._counts = {k: v for k, v in self._counts.items() if now - v[0] < period}
                self._counts[key] = [now, 1]
                return None
            if entry[1] >= limit:
                return period - (now - entry[0])
            entry[1] += 1
            return None


_auth_window = _Window()
_global_window = _FixedWindow()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limit_global(ip: str) -> float | None:
    """الحد العام (من الـ middleware). None = مسموح، وإلا ثوانٍ حتى يُسمح."""
    limit = get_settings().rate_per_min
    return _global_window.hit(f"all:{ip}", limit) if limit else None


def reset() -> None:
    """للاختبارات."""
    global _auth_window, _global_window
    _auth_window = _Window()
    _global_window = _FixedWindow()


def limit_auth(request: Request) -> None:
    wait = _auth_window.hit(f"auth:{client_ip(request)}", get_settings().auth_rate_per_min)
    if wait is not None:
        raise TooManyRequests(
            "rate_limited",
            "محاولات كثيرة. انتظر دقيقة وحاول مرة أخرى",
            {"retry_after": int(wait) + 1},
        )

"""حد للطلبات لكل IP (نافذة منزلقة في الذاكرة).

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


_auth_window = _Window()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def limit_auth(request: Request) -> None:
    wait = _auth_window.hit(f"auth:{client_ip(request)}", get_settings().auth_rate_per_min)
    if wait is not None:
        raise TooManyRequests(
            "rate_limited",
            "محاولات كثيرة. انتظر دقيقة وحاول مرة أخرى",
            {"retry_after": int(wait) + 1},
        )

"""مخزون الأصناف المعروضة في المتجر الإلكتروني: يرفعه فرع التجهيز مع المزامنة.

- السيرفر يحدد هل هذا الفرع هو فرع التجهيز، وما الأصناف المعروضة (فرع آخر يأخذ قائمة فارغة).
- يُرفع رصيد هذه الأصناف فقط (لا مخزون المحل كاملاً)، وبقراءة فقط: لا شيء يُضاف لمسار البيع.
- يُرفع ما تغيّر فقط (بصمة)، ومرة كل STORE_REFRESH_SECONDS على الأقل حتى لو لم يتغيّر شيء.
- سيرفر أقدم بلا المتجر (404) = نتوقف عن السؤال STORE_RETRY_SECONDS.
"""

import hashlib
import json
import logging
import time
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog_sync import PRODUCT
from .client import RemoteError, SyncAuthLost, SyncClient, SyncUnavailable
from .model import CatalogLink

STORE_EVERY_SECONDS = 90
STORE_REFRESH_SECONDS = 30 * 60
STORE_RETRY_SECONDS = 6 * 3600
CHUNK = 2000

log = logging.getLogger("branch_sync")


def stock_for(session: Session, gids: list[str]) -> list[dict[str, Any]]:
    from app.modules.products.model import Product

    out: list[dict[str, Any]] = []
    for i in range(0, len(gids), 500):
        rows = session.execute(
            select(CatalogLink.gid, Product.stock_qty)
            .join(Product, Product.id == CatalogLink.local_id)
            .where(CatalogLink.kind == PRODUCT, CatalogLink.gid.in_(gids[i : i + 500]), Product.deleted_at.is_(None))
        ).all()
        out += [{"gid": gid, "qty": int(qty or 0)} for gid, qty in rows]
    out.sort(key=lambda x: x["gid"])
    return out


def push(session: Session, cfg: dict, client: SyncClient) -> dict | None:
    """يرجّع إعدادات الربط بعد تحديث مفاتيح المتجر (للحفظ)، أو None لو لا شيء تغيّر."""
    now = time.time()
    if float(cfg.get("store_retry_at") or 0) > now:
        return None
    if now - float(cfg.get("store_last_at") or 0) < STORE_EVERY_SECONDS:
        return None
    try:
        gids = (client.call("GET", "/store/stock-request") or {}).get("gids") or []
    except RemoteError as exc:
        if exc.status_code == 404:
            return {**cfg, "store_retry_at": now + STORE_RETRY_SECONDS}
        return None
    except (SyncUnavailable, SyncAuthLost):
        return None
    if not gids:
        return {**cfg, "store_last_at": now, "store_digest": None}
    try:
        items = stock_for(session, [str(g) for g in gids][:20_000])
    except Exception:  # noqa: BLE001 — فشل القراءة لا يوقف المزامنة
        session.rollback()
        log.warning("store stock collect failed", exc_info=True)
        return None
    session.commit()  # لا معاملة مفتوحة أثناء الشبكة
    digest = hashlib.sha256(json.dumps(items, separators=(",", ":")).encode()).hexdigest()[:16]
    fresh = now - float(cfg.get("store_sent_at") or 0) < STORE_REFRESH_SECONDS
    if digest == cfg.get("store_digest") and fresh:
        return {**cfg, "store_last_at": now}
    try:
        for i in range(0, max(len(items), 1), CHUNK):
            client.call("POST", "/store/stock", {"items": items[i : i + CHUNK]})
    except (SyncUnavailable, SyncAuthLost, RemoteError):
        return None  # يُعاد في الدورة التالية
    return {**cfg, "store_last_at": now, "store_sent_at": now, "store_digest": digest}

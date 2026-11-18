"""المتجر الإلكتروني: البرنامج وسيط آمن بين شاشة المالك وسيرفر الفروع.

- بيانات المتجر وطلباته على سيرفر الفروع (المتجر يعمل والجهاز مغلق). هنا لا يُخزَّن شيء غير ما في
  سجل العمليات المحلي.
- الإدارة من الجهاز الرئيسي للمالك فقط (نفس قاعدة إدارة الفروع)، وبخطة «سلسلة»، والسيرفر يتحقق
  من الاثنين مرة ثانية.
- المعرّفات في المسارات تُفحص قبل إرسالها (لا حقن مسارات)، والصور يُتحقق من حجمها ونوعها هنا وعلى السيرفر.
"""

import base64
import binascii
import re
from typing import Any

from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.errors import BadRequestError, NotFoundError
from app.core.security import Actor
from app.modules.branch_sync.service import BranchSyncService

from .schemas import BulkIn, ImageIn, NoteIn, ProductPatchIn, StatusIn, StoreIn

_ID_RE = re.compile(r"^[0-9A-Za-z-]{8,64}$")
MAX_IMAGE_BYTES = 600_000
_MAGIC = {
    "image/jpeg": lambda b: b[:3] == b"\xff\xd8\xff",
    "image/png": lambda b: b[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda b: len(b) > 12 and b[:4] == b"RIFF" and b[8:12] == b"WEBP",
}


def _safe(value: str, what: str = "السجل") -> str:
    if not value or not _ID_RE.match(value):
        raise NotFoundError("not_found", f"{what} غير موجود")
    return value


class StoreService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor
        self.sync = BranchSyncService(session, actor)

    def _call(self, method: str, path: str, body: Any = None, params: dict | None = None) -> Any:
        return self.sync._admin_client().call(method, f"/shop/store{path}", body, params)  # noqa: SLF001

    def _audit(self, action: str, entity_id: str, changes: dict) -> None:
        record_audit(self.session, self.actor, entity="online_store", entity_id=entity_id[:64] or "-",
                     action=action, changes=changes)  # fmt: skip
        self.session.commit()

    # ---------- الإعدادات ----------
    def state(self) -> dict:
        out = self._call("GET", "")
        store = out.get("store") if isinstance(out, dict) else None
        cfg = self.sync.config() or {}
        # معاينة الصور في البرنامج: من سيرفر الفروع مباشرة (نفس المسار العام).
        out["image_base"] = (
            f"{cfg['server_url'].rstrip('/')}/v1/store/public/{store['slug']}/images/"
            if store and cfg.get("server_url") else None
        )
        return out

    def save(self, data: StoreIn) -> dict:
        out = self._call("PUT", "", data.model_dump(mode="json"))
        self._audit("store_saved", out.get("slug", ""), {"slug": out.get("slug"), "published": out.get("is_published"),
                                                          "accepting_orders": out.get("accepting_orders")})  # fmt: skip
        return out

    def slug_check(self, slug: str) -> dict:
        return self._call("GET", "/slug", params={"slug": slug[:60]})

    def upload_image(self, data: ImageIn) -> dict:
        try:
            raw = base64.b64decode(data.data, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise BadRequestError("image_invalid", "ملف الصورة تالف") from exc
        if len(raw) > MAX_IMAGE_BYTES:
            raise BadRequestError("image_too_large", "الصورة كبيرة جداً بعد الضغط. اختر صورة أصغر")
        if not _MAGIC[data.content_type](raw):
            raise BadRequestError("image_invalid", "الملف ليس صورة صالحة")
        return self._call("POST", "/images", data.model_dump(mode="json"))

    # ---------- الأصناف ----------
    def products(self, params: dict) -> dict:
        return self._call("GET", "/products", params=params)

    def update_product(self, gid: str, data: ProductPatchIn) -> dict:
        return self._call("PATCH", f"/products/{_safe(gid, 'الصنف')}", data.model_dump(mode="json", exclude_unset=True))

    def bulk(self, data: BulkIn) -> dict:
        out = self._call("POST", "/products/bulk", data.model_dump(mode="json"))
        self._audit("store_products_bulk", "-", {"published": data.is_published, "count": out.get("changed", 0)})
        return out

    # ---------- الطلبات ----------
    def orders(self, params: dict) -> dict:
        return self._call("GET", "/orders", params=params)

    def order(self, order_id: str) -> dict:
        return self._call("GET", f"/orders/{_safe(order_id, 'الطلب')}")

    def set_status(self, order_id: str, data: StatusIn) -> dict:
        out = self._call("POST", f"/orders/{_safe(order_id, 'الطلب')}/status", data.model_dump(mode="json", exclude_unset=True))
        self._audit("store_order_status", order_id, {"number": out.get("number"), "status": data.status,
                                                      **({"reason": data.reason} if data.reason else {})})  # fmt: skip
        return out

    def set_note(self, order_id: str, data: NoteIn) -> dict:
        return self._call("PUT", f"/orders/{_safe(order_id, 'الطلب')}/note", data.model_dump(mode="json"))

    def summary(self, utc_offset_minutes: int) -> dict:
        return self._call("GET", "/summary", params={"utc_offset_minutes": utc_offset_minutes})

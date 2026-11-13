"""ربط الفرع بسيرفر المزامنة + تحويلات المخزون بين الفروع.

ترتيب العمليات يضمن ألا يضيع مخزون مع انقطاع النت:
- الإرسال/الموافقة: نخصم المخزون محلياً ونحفظ العملية «معلّقة» (commit)، ثم نرسل للسيرفر.
  نجح ← تُمسح المعلّقة. انقطع النت ← تبقى وتُعاد تلقائياً (السيرفر يتجاهل التكرار بالـ id).
  رفض السيرفر نهائياً (فرع موقوف…) ← نرجّع المخزون كما كان بالضبط.
- الاستلام: نسجّله على السيرفر أولاً (قابل للإعادة)، ثم نضيف للمخزون مرة واحدة فقط (stock_in_applied).
- الإلغاء: السيرفر أولاً، ثم نرجّع المخزون الخارج مرة واحدة فقط (stock_reversed).

مطابقة الصنف بين الفرعين: المعرّف العام من مزامنة الكتالوج ← نفس الـ id ← الباركود ← الاسم
بالضبط، وإلا يختار المستخدم الصنف المقابل يدوياً.
"""

import json
import threading
import time
from collections import defaultdict
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import uuid7, utcnow
from app.core.constants import QTY_SCALE
from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.core.plan import Feature, ensure_feature
from app.core.security import Actor
from app.modules.batches.engine import BatchIn
from app.modules.batches.model import BatchMove, ProductBatch
from app.modules.products.model import Product
from app.modules.products.service import ProductService
from app.modules.products.types import MovementType
from app.modules.settings.constants import SettingKey
from app.modules.settings.service import SettingsService

from .client import (
    RemoteError,
    SyncAuthLost,
    SyncClient,
    SyncUnavailable,
    forget_token,
    is_transient,
    normalize_server_url,
)
from .catalog_sync import CatalogSync, catalog_status, global_product_id, local_product_id
from .model import BranchTransfer
from .schemas import (
    ApproveIn,
    BranchPatchIn,
    ConnectIn,
    NewBranchIn,
    ReceiveIn,
    RegisterShopIn,
    RejectIn,
    RequestIn,
    SendIn,
)

REF = "branch_transfer"
ENTITY = "branch_transfer"
_SUMMARY_TTL = 20.0
_summary_cache: dict[str, tuple[float, dict]] = {}  # لكل فرع
_summary_lock = threading.Lock()
# آخر قائمة فروع معروفة: الإرسال يعمل حتى لو السيرفر غير متاح لحظتها (يُعلَّق ويُعاد).
_branches_cache: dict[str, list[dict]] = {}


class NotConnected(ConflictError):
    def __init__(self) -> None:
        super().__init__("branch_not_connected", "هذا الجهاز غير مربوط بسيرفر الفروع. اربطه من الإعدادات")


class BranchSyncService:
    def __init__(self, session: Session, actor: Actor) -> None:
        self.session = session
        self.actor = actor
        self.settings = SettingsService(session)
        self.products = ProductService(session, actor)

    # ================= الإعداد والربط =================
    def config(self) -> dict | None:
        raw = self.settings.get(SettingKey.BRANCH_SYNC)
        if not raw:
            return None
        try:
            cfg = json.loads(raw)
        except ValueError:
            return None
        return cfg if cfg.get("branch_id") and cfg.get("secret") else None

    def _client(self) -> tuple[SyncClient, dict]:
        cfg = self.config()
        if cfg is None:
            raise NotConnected()
        return SyncClient(cfg["server_url"], cfg["branch_id"], cfg["secret"]), cfg

    def status(self, check: bool = False) -> dict:
        cfg = self.config()
        pending = self.session.scalar(
            select(func.count()).select_from(BranchTransfer).where(BranchTransfer.pending.is_not(None))
        ) or 0
        if cfg is None:
            return {"connected": False, "pending": pending}
        out = {
            "connected": True,
            "server_url": cfg["server_url"],
            "branch_id": cfg["branch_id"],
            "branch_name": cfg.get("branch_name"),
            "branch_code": cfg.get("branch_code"),
            "shop_name": cfg.get("shop_name"),
            "paired_at": cfg.get("paired_at"),
            "is_admin": bool(cfg.get("is_admin")),
            "pending": pending,
        }
        if check:
            client, _ = self._client()
            out["reachable"] = client.health()
        return out

    def connect(self, data: ConnectIn) -> dict:
        ensure_feature(Feature.BRANCHES)
        url = normalize_server_url(data.server_url)
        creds = SyncClient(url).pair(data.code)
        return self._save_connection(url, creds, admin=False)

    def register(self, data: RegisterShopIn) -> dict:
        """المالك يسجّل محله بنفسه بمفتاح الترخيص: هذا الجهاز يصبح الفرع الرئيسي الذي يدير الفروع."""
        ensure_feature(Feature.BRANCHES)
        if self.config() is not None:
            raise ConflictError("branch_already_connected", "هذا الجهاز مربوط بالفعل. افصله أولاً")
        url = normalize_server_url(data.server_url)
        creds = SyncClient(url).register({
            "license_key": data.license_key.strip(), "branch_name": data.branch_name.strip(),
            "branch_code": data.branch_code, "recover": data.recover,
        })  # fmt: skip
        action = "shop_recover" if data.recover else "shop_register"
        return self._save_connection(url, creds, admin=True, action=action)

    def _save_connection(self, url: str, creds: dict, *, admin: bool, action: str = "branch_connect") -> dict:
        cfg = {
            "server_url": url,
            "branch_id": creds["branch_id"],
            "secret": creds["secret"],
            "branch_name": creds.get("branch_name"),
            "branch_code": creds.get("branch_code"),
            "shop_id": creds.get("shop_id"),
            "shop_name": creds.get("shop_name"),
            "paired_at": utcnow().isoformat(),
            "is_admin": admin,
        }
        forget_token(creds["branch_id"])
        self.settings.set_local(self.actor, SettingKey.BRANCH_SYNC, json.dumps(cfg, ensure_ascii=False))
        record_audit(
            self.session, self.actor, entity="branch_sync", entity_id=creds["branch_id"],
            action=action,
            changes={"server_url": url, "branch": cfg["branch_name"], "shop": cfg["shop_name"]},
        )  # fmt: skip
        self.session.commit()
        return self.status()

    def disconnect(self) -> dict:
        cfg = self.config()
        if cfg is None:
            return self.status()
        forget_token(cfg["branch_id"])
        self.settings.set_local(self.actor, SettingKey.BRANCH_SYNC, "")
        record_audit(
            self.session, self.actor, entity="branch_sync", entity_id=cfg["branch_id"],
            action="branch_disconnect", changes={"server_url": cfg["server_url"]},
        )  # fmt: skip
        self.session.commit()
        return self.status()

    def branches(self) -> list[dict]:
        client, cfg = self._client()
        rows = client.call("GET", "/branches")
        _branches_cache[cfg["branch_id"]] = rows
        return rows

    # ================= قراءة التحويلات =================
    def list_transfers(self, direction: str, status: str | None, page: int, page_size: int) -> dict:
        self.retry_pending()
        client, _ = self._client()
        data = client.call(
            "GET",
            "/transfers",
            params={"direction": direction, "status": status, "page": page, "page_size": page_size},
        )
        data["items"] = [self._decorate(t) for t in data["items"]]
        data["pending_local"] = self._pending_rows()
        return data

    def get_transfer(self, transfer_id: str) -> dict:
        client, _ = self._client()
        return self._decorate(client.call("GET", f"/transfers/{transfer_id}"))

    def summary(self) -> dict:
        """عدّاد الشاشة: وارد في الطريق + طلبات تنتظر ردّي + معلّق محلياً. مخزّن مؤقتاً 20 ثانية."""
        cfg = self.config()
        if cfg is None:
            return {"connected": False, "incoming": 0, "requests": 0, "pending": 0, "online": False}
        key = cfg["branch_id"]
        with _summary_lock:
            hit = _summary_cache.get(key)
            if hit is not None and time.monotonic() - hit[0] < _SUMMARY_TTL:
                return hit[1]
        pending = len(self._pending_rows())
        try:
            self.retry_pending()
            client, _ = self._client()
            incoming = client.call("GET", "/transfers", params={"direction": "in", "status": "sent", "page_size": 1})
            requests = client.call(
                "GET", "/transfers", params={"direction": "out", "status": "requested", "page_size": 1}
            )
            data = {
                "connected": True,
                "online": True,
                "incoming": incoming["total"],
                "requests": requests["total"],
                "pending": len(self._pending_rows()),
            }
        except (SyncUnavailable, SyncAuthLost) as exc:
            data = {
                "connected": True,
                "online": False,
                "unpaired": isinstance(exc, SyncAuthLost),
                "incoming": 0,
                "requests": 0,
                "pending": pending,
            }
        with _summary_lock:
            _summary_cache[key] = (time.monotonic(), data)
        return data

    # ================= إرسال مباشر =================
    def send(self, data: SendIn) -> dict:
        ensure_feature(Feature.BRANCHES)
        client, cfg = self._client()
        target = self._branch(client, data.to_branch_id)
        transfer_id = uuid7()
        out_lines = self._stock_out(
            transfer_id, [(l.product_id, l.qty) for l in data.lines], f"تحويل إلى {target['name']}"
        )
        body = {
            "id": transfer_id,
            "to_branch_id": data.to_branch_id,
            "lines": [self._server_line(l) for l in out_lines],
            "note": data.note,
            "sent_by": self._user_name(),
        }
        row = BranchTransfer(
            id=transfer_id,
            direction="out",
            other_branch_id=data.to_branch_id,
            other_branch_name=target["name"],
            status="pending",
            pending={"op": "create", "body": body},
            stock_out_applied=True,
            out_lines=out_lines,
            created_by=self.actor.user_id,
        )
        self.session.add(row)
        self._audit(row, "transfer_send", {"to": target["name"], "lines": len(out_lines)})
        self.session.commit()  # المخزون اتخصم والعملية محفوظة قبل أي اتصال
        return self._flush_one(client, row)

    # ================= الطلبات =================
    def request(self, data: RequestIn) -> dict:
        ensure_feature(Feature.BRANCHES)
        client, _ = self._client()
        source = self._branch(client, data.from_branch_id)
        lines = []
        for item in data.lines:
            product = self._product(item.product_id)
            self._check_fraction(product, item.qty)
            lines.append(
                {"product_id": product.id, "barcode": product.barcode, "name": product.name,
                 "unit": product.unit, "qty": item.qty}
            )  # fmt: skip
        transfer_id = uuid7()
        result = client.call(
            "POST",
            "/transfers/requests",
            {"id": transfer_id, "from_branch_id": source["id"], "lines": lines,
             "note": data.note, "requested_by": self._user_name()},
        )  # fmt: skip
        row = BranchTransfer(
            id=transfer_id, direction="in", number=result["number"],
            other_branch_id=source["id"], other_branch_name=source["name"],
            status=result["status"], payload=result, created_by=self.actor.user_id,
        )  # fmt: skip
        self.session.add(row)
        self._audit(row, "transfer_request", {"from": source["name"], "lines": len(lines)})
        self.session.commit()
        return self._decorate(result)

    def approve(self, transfer_id: str, data: ApproveIn) -> dict:
        ensure_feature(Feature.BRANCHES)
        client, _ = self._client()
        remote = client.call("GET", f"/transfers/{transfer_id}")
        if remote["from_branch_id"] != self._branch_id():
            raise ConflictError("transfer_not_yours", "الموافقة من الفرع المطلوب منه فقط")
        if remote["status"] != "requested":
            raise ConflictError("transfer_not_requested", "الطلب لم يعد في انتظار الرد")
        if self.session.get(BranchTransfer, transfer_id) is not None:
            raise ConflictError("transfer_in_progress", "هذا الطلب قيد الإرسال بالفعل")

        lines_by_id = {l["id"]: l for l in remote["lines"]}
        picks: list[tuple[str, str, int]] = []  # (line_id, product_id, qty)
        for item in data.lines:
            line = lines_by_id.get(item.line_id)
            if line is None:
                raise BadRequestError("transfer_line_unknown", "سطر غير موجود في الطلب")
            if item.qty > (line.get("qty_requested") or line["qty_sent"]):
                raise BadRequestError("transfer_over_request", f"الكمية أكبر من المطلوب في «{line['name']}»")
            if item.qty == 0:
                continue
            product = self._resolve(line, item.product_id)
            picks.append((line["id"], product.id, item.qty))
        if not picks:
            raise BadRequestError("transfer_empty", "لا توجد كميات للإرسال. استخدم الرفض بدلاً من ذلك")

        out_lines = self._stock_out(
            transfer_id, [(pid, qty) for _, pid, qty in picks], f"تحويل لطلب {remote['to_branch_name']}"
        )
        # سطر الطلب الواحد قد يخرج من أكثر من دفعة: نرسل أقرب صلاحية وإجمالي الكمية والتكلفة.
        by_product: dict[str, list[dict]] = defaultdict(list)
        for l in out_lines:
            by_product[l["product_id"]].append(l)
        sent: dict[str, dict] = {}
        for line_id, pid, qty in picks:
            parts = by_product[pid]
            expiries = [p["expiry_date"] for p in parts if p.get("expiry_date")]
            sent[line_id] = {
                "line_id": line_id,
                "qty": qty,
                "unit_cost": parts[0]["unit_cost"] if parts else 0,
                "batch_no": next((p["batch_no"] for p in parts if p.get("batch_no")), None),
                "expiry_date": min(expiries) if expiries else None,
            }
        body = {
            "lines": [sent.get(l["id"], {"line_id": l["id"], "qty": 0}) for l in remote["lines"]],
            "note": data.note,
            "sent_by": self._user_name(),
        }
        row = BranchTransfer(
            id=transfer_id, direction="out", number=remote["number"],
            other_branch_id=remote["to_branch_id"], other_branch_name=remote["to_branch_name"],
            status="pending", pending={"op": "approve", "body": body},
            stock_out_applied=True, out_lines=out_lines,
            mapping={line_id: pid for line_id, pid, _ in picks}, created_by=self.actor.user_id,
        )  # fmt: skip
        self.session.add(row)
        self._audit(row, "transfer_approve", {"to": remote["to_branch_name"], "lines": len(picks)})
        self.session.commit()
        return self._flush_one(client, row)

    def reject(self, transfer_id: str, data: RejectIn) -> dict:
        client, _ = self._client()
        result = client.call("POST", f"/transfers/{transfer_id}/reject", {"reason": data.reason})
        self._remember(result, direction="out", action="transfer_reject")
        return self._decorate(result)

    def withdraw(self, transfer_id: str) -> dict:
        client, _ = self._client()
        result = client.call("POST", f"/transfers/{transfer_id}/withdraw")
        self._remember(result, direction="in", action="transfer_withdraw")
        return self._decorate(result)

    # ================= الإلغاء والاستلام =================
    def cancel(self, transfer_id: str) -> dict:
        client, _ = self._client()
        row = self.session.get(BranchTransfer, transfer_id)
        if row is not None and row.pending is not None and row.status in ("pending", "failed"):
            # لم يصل للسيرفر أصلاً: نلغيه محلياً ونرجّع المخزون.
            self._reverse(row, "إلغاء تحويل لم يُرسل")
            row.pending = None
            row.status = "cancelled"
            self._audit(row, "transfer_cancel", {"local_only": True})
            self.session.commit()
            return {"id": row.id, "status": "cancelled", "local": self._local(row)}
        result = client.call("POST", f"/transfers/{transfer_id}/cancel")
        row = self._remember(result, direction="out", action="transfer_cancel")
        self._reverse(row, f"إلغاء تحويل #{result['number']} إلى {result['to_branch_name']}")
        self.session.commit()
        return self._decorate(result)

    def receive(self, transfer_id: str, data: ReceiveIn) -> dict:
        ensure_feature(Feature.BRANCHES)
        client, _ = self._client()
        remote = client.call("GET", f"/transfers/{transfer_id}")
        if remote["to_branch_id"] != self._branch_id():
            raise ConflictError("transfer_not_yours", "الاستلام من الفرع المستلم فقط")
        if remote["status"] not in ("sent", "received", "partial"):
            raise ConflictError("transfer_not_in_transit", "التحويل ليس في الطريق")

        given = {l.line_id: l for l in data.lines}
        mapping: dict[str, str] = {}
        qtys: dict[str, int] = {}
        for line in remote["lines"]:
            item = given.get(line["id"])
            qty = item.qty_received if item else line["qty_sent"]
            if qty > line["qty_sent"]:
                raise BadRequestError("transfer_over_receive", f"المستلم أكبر من المرسل في «{line['name']}»")
            qtys[line["id"]] = qty
            if qty > 0:
                product = self._resolve(line, item.product_id if item else None)
                self._check_fraction(product, qty)
                mapping[line["id"]] = product.id

        # السيرفر أولاً (لو استُلم من قبل يرجع نفس النتيجة)، ثم المخزون مرة واحدة فقط.
        if remote["status"] == "sent":
            remote = client.call(
                "POST",
                f"/transfers/{transfer_id}/receive",
                {"lines": [{"line_id": k, "qty_received": v} for k, v in qtys.items()], "note": data.note,
                 "received_by": self._user_name()},
            )  # fmt: skip
        row = self._remember(remote, direction="in", action=None)
        if not row.stock_in_applied:
            for line in remote["lines"]:
                qty = line.get("qty_received") or 0
                if qty <= 0:
                    continue
                product = self.products.get_for_update(mapping.get(line["id"]) or self._resolve(line, None).id)
                cost = line.get("unit_cost") or 0
                if cost > 0:
                    self.products.apply_purchase_prices(
                        product, received_qty=qty, unit_cost=cost, new_sale_price=None, ref_id=transfer_id
                    )
                self.products.move_stock(
                    product, MovementType.TRANSFER_IN, qty, unit_cost=cost or None,
                    note=f"تحويل وارد #{remote['number']} من {remote['from_branch_name']}",
                    ref_type=REF, ref_id=transfer_id,
                    batch_in=BatchIn(line.get("batch_no"), _date(line.get("expiry_date"))),
                )  # fmt: skip
            row.stock_in_applied = True
            row.mapping = mapping
            self._audit(
                row, "transfer_receive",
                {"from": remote["from_branch_name"], "status": remote["status"],
                 "shortage_cost": remote.get("shortage_cost", 0)},
            )  # fmt: skip
        self.session.commit()
        self._invalidate_summary()
        return self._decorate(remote)

    # ================= إدارة فروع المحل (المالك من الفرع الرئيسي) =================
    def _admin_client(self) -> SyncClient:
        client, cfg = self._client()
        if not cfg.get("is_admin"):
            raise ConflictError("not_admin_branch", "إدارة الفروع من الجهاز الرئيسي للمالك فقط")
        return client

    def shop_info(self) -> dict:
        client, _ = self._client()
        return client.call("GET", "/shop")

    def admin_branches(self) -> list[dict]:
        return self._admin_client().call("GET", "/shop/branches")

    def admin_create_branch(self, data: NewBranchIn) -> dict:
        out = self._admin_client().call("POST", "/shop/branches", {"name": data.name.strip(), "code": data.code})
        self._audit_admin("branch_created", {"name": data.name, "code": data.code.upper()})
        return out

    def admin_pairing_code(self, branch_id: str) -> dict:
        out = self._admin_client().call("POST", f"/shop/branches/{_safe_id(branch_id)}/pairing-code")
        self._audit_admin("pairing_code_created", {"branch": out.get("branch_name")})
        return out

    def admin_update(self, branch_id: str, data: BranchPatchIn) -> dict:
        body = data.model_dump(exclude_none=True)
        out = self._admin_client().call("PATCH", f"/shop/branches/{_safe_id(branch_id)}", body)
        self._audit_admin("branch_updated", {"branch": out.get("name"), **body})
        return out

    def admin_revoke(self, branch_id: str) -> dict:
        out = self._admin_client().call("POST", f"/shop/branches/{_safe_id(branch_id)}/revoke")
        self._audit_admin("device_revoked", {"branch": out.get("name")})
        return out

    def renew_license(self, license_key: str) -> dict:
        out = self._admin_client().call("POST", "/shop/license", {"license_key": license_key.strip()})
        self._audit_admin("license_renewed", {"expires_at": out.get("license_expires_at")})
        return out

    def _audit_admin(self, action: str, changes: dict) -> None:
        record_audit(self.session, self.actor, entity="branch_sync", entity_id=self._branch_id() or "-",
                     action=action, changes=changes)  # fmt: skip
        self.session.commit()

    # ================= مزامنة الأصناف والعملاء =================
    def catalog(self) -> dict:
        return {"connected": self.config() is not None, **catalog_status(self.session)}

    def sync_now(self) -> dict:
        """دورة مزامنة: الكتالوج (سحب ثم رفع) + إعادة التحويلات المعلّقة. تستدعيها الواجهة دورياً."""
        cfg = self.config()
        if cfg is None:
            return {"connected": False}
        ensure_feature(Feature.BRANCHES)
        client = SyncClient(cfg["server_url"], cfg["branch_id"], cfg["secret"])
        result = CatalogSync(self.session, self.actor, client, cfg["branch_id"]).run()
        sent = 0
        if result.get("ok"):
            try:
                sent = self.retry_pending()
            except (SyncUnavailable, SyncAuthLost, RemoteError):
                pass
        return {"result": {**result, "transfers_sent": sent}, **self.catalog()}

    # ================= إعادة المعلّق =================
    def retry_pending(self) -> int:
        rows = list(
            self.session.scalars(select(BranchTransfer).where(BranchTransfer.pending.is_not(None))).all()
        )
        if not rows:
            return 0
        client, _ = self._client()
        done = 0
        for row in rows:
            try:
                self._flush_one(client, row, raise_definitive=False)
                done += row.pending is None
            except (SyncUnavailable, SyncAuthLost):
                break  # السيرفر غير متاح: نحاول في المرة القادمة
        return done

    # ================= داخلي =================
    def _flush_one(self, client: SyncClient, row: BranchTransfer, raise_definitive: bool = True) -> dict:
        op = row.pending or {}
        try:
            if op.get("op") == "create":
                result = client.call("POST", "/transfers", op["body"])
            elif op.get("op") == "approve":
                result = client.call("POST", f"/transfers/{row.id}/approve", op["body"])
            else:
                return {"id": row.id, "status": row.status, "local": self._local(row)}
        except Exception as exc:
            if is_transient(exc) or isinstance(exc, SyncAuthLost):
                row.last_error = getattr(exc, "message", str(exc))
                self.session.commit()
                self._invalidate_summary()
                return {"id": row.id, "status": "pending", "local": self._local(row), "queued": True,
                        "message": "خُصم من المخزون، وسيُرسل إلى الفرع فور عودة سيرفر الفروع"}  # fmt: skip
            if isinstance(exc, RemoteError):
                # رفض نهائي (فرع موقوف، طلب اتسحب…): نرجّع المخزون كما كان بالضبط.
                self._reverse(row, f"إرسال تحويل لم يكتمل: {exc.message}")
                row.pending = None
                row.status = "failed"
                row.last_error = exc.message
                self.session.commit()
                self._invalidate_summary()
                if raise_definitive:
                    raise
                return {"id": row.id, "status": "failed", "local": self._local(row)}
            raise
        row.pending = None
        row.last_error = None
        row.status = result["status"]
        row.number = result["number"]
        row.payload = result
        self.session.commit()
        self._invalidate_summary()
        return self._decorate(result)

    def _stock_out(self, transfer_id: str, items: list[tuple[str, int]], note: str) -> list[dict]:
        """يخصم المخزون (الصالح فقط، الأقرب انتهاءً أولاً) ويرجّع الأسطر كما خرجت بدفعاتها."""
        merged: dict[str, int] = defaultdict(int)
        for pid, qty in items:
            merged[pid] += qty
        out: list[dict] = []
        for pid, qty in merged.items():
            product = self._product(pid)
            self._check_fraction(product, qty)
            if product.stock_qty < qty:
                raise ConflictError(
                    "transfer_insufficient_stock",
                    f"رصيد «{product.name}» أقل من المطلوب تحويله",
                    {"product": product.name, "available": product.stock_qty},
                )
            movement = self.products.move_stock(
                product, MovementType.TRANSFER_OUT, -qty, unit_cost=product.cost_price,
                note=note, ref_type=REF, ref_id=transfer_id,
            )  # fmt: skip
            base = {"product_id": global_product_id(self.session, product.id), "barcode": product.barcode, "name": product.name,
                    "unit": product.unit, "unit_cost": product.cost_price}  # fmt: skip
            if product.track_expiry:
                self.session.flush()
                parts = self.session.execute(
                    select(BatchMove.qty, ProductBatch.batch_no, ProductBatch.expiry_date)
                    .join(ProductBatch, ProductBatch.id == BatchMove.batch_id)
                    .where(BatchMove.movement_id == movement.id)
                ).all()
                taken = 0
                for move_qty, batch_no, expiry in parts:
                    out.append({**base, "qty": -move_qty, "batch_no": batch_no,
                                "expiry_date": expiry.isoformat() if expiry else None})  # fmt: skip
                    taken += -move_qty
                if taken < qty:  # جزء بلا دفعة (رصيد قديم سالب)
                    out.append({**base, "qty": qty - taken, "batch_no": None, "expiry_date": None})
            else:
                out.append({**base, "qty": qty, "batch_no": None, "expiry_date": None})
        return out

    def _reverse(self, row: BranchTransfer | None, note: str) -> None:
        """يرجّع ما خرج من مخزوننا بنفس الكميات والصلاحيات، مرة واحدة فقط."""
        if row is None or not row.stock_out_applied or row.stock_reversed:
            return
        for line in row.out_lines or []:
            product = self.products.get_for_update(line["product_id"])
            self.products.move_stock(
                product, MovementType.TRANSFER_IN, line["qty"], unit_cost=line.get("unit_cost") or None,
                note=note, ref_type=REF, ref_id=row.id,
                batch_in=BatchIn(line.get("batch_no"), _date(line.get("expiry_date"))),
            )  # fmt: skip
        row.stock_reversed = True

    def _remember(self, remote: dict, *, direction: str, action: str | None) -> BranchTransfer:
        row = self.session.get(BranchTransfer, remote["id"])
        other_id = remote["to_branch_id"] if direction == "out" else remote["from_branch_id"]
        other_name = remote["to_branch_name"] if direction == "out" else remote["from_branch_name"]
        if row is None:
            row = BranchTransfer(
                id=remote["id"], direction=direction, other_branch_id=other_id,
                other_branch_name=other_name, status=remote["status"], created_by=self.actor.user_id,
            )  # fmt: skip
            self.session.add(row)
        row.status = remote["status"]
        row.number = remote["number"]
        row.payload = remote
        if action:
            self._audit(row, action, {"other": other_name, "status": remote["status"]})
            self.session.commit()
            self._invalidate_summary()
        return row

    def _decorate(self, t: dict) -> dict:
        """يضيف لكل تحويل: حالته المحلية، ودوري فيه، ومطابقة أسطره بأصناف هذا الفرع."""
        me = self._branch_id()
        row = self.session.get(BranchTransfer, t["id"])
        t = dict(t)
        t["role"] = "sender" if t.get("from_branch_id") == me else "receiver"
        t["local"] = self._local(row)
        mapping = (row.mapping if row else None) or {}
        lines = []
        for line in t.get("lines", []):
            product = None
            if mapping.get(line["id"]):
                product = self.session.get(Product, mapping[line["id"]])
            if product is None:
                product = self._match(line)
            lines.append(
                {**line, "match": None if product is None else {
                    "product_id": product.id, "name": product.name, "unit": product.unit,
                    "stock": product.stock_qty, "allow_decimal": product.allow_decimal,
                }}
            )  # fmt: skip
        t["lines"] = lines
        return t

    @staticmethod
    def _local(row: BranchTransfer | None) -> dict | None:
        if row is None:
            return None
        return {
            "pending": row.pending is not None,
            "last_error": row.last_error,
            "stock_out_applied": row.stock_out_applied,
            "stock_in_applied": row.stock_in_applied,
            "stock_reversed": row.stock_reversed,
            "status": row.status,
        }

    def _pending_rows(self) -> list[dict]:
        rows = self.session.scalars(
            select(BranchTransfer).where(BranchTransfer.pending.is_not(None)).order_by(BranchTransfer.created_at)
        ).all()
        return [
            {"id": r.id, "to_branch_name": r.other_branch_name, "op": (r.pending or {}).get("op"),
             "last_error": r.last_error, "lines": len(r.out_lines or []), "created_at": r.created_at}
            for r in rows
        ]  # fmt: skip

    def _match(self, line: dict) -> Product | None:
        mapped = local_product_id(self.session, line.get("product_id"))
        product = self.session.get(Product, mapped or line.get("product_id"))
        if product is not None and product.deleted_at is None:
            return product
        if line.get("barcode"):
            found = self.products.repo.find_by_barcode(line["barcode"])
            if found is not None:
                return found[0]
        name = (line.get("name") or "").strip()
        if name:
            rows = self.session.scalars(
                select(Product).where(Product.name == name, Product.deleted_at.is_(None)).limit(2)
            ).all()
            if len(rows) == 1:
                return rows[0]
        return None

    def _resolve(self, line: dict, product_id: str | None) -> Product:
        product = self._product(product_id) if product_id else self._match(line)
        if product is None:
            raise BadRequestError(
                "transfer_unmapped",
                f"الصنف «{line['name']}» غير موجود في هذا الفرع. اختر الصنف المقابل له",
                {"line_id": line["id"], "name": line["name"]},
            )
        return product

    def _product(self, product_id: str) -> Product:
        try:
            return self.products.get_for_update(product_id)
        except NotFoundError as exc:
            raise NotFoundError("product_not_found", "صنف غير موجود في هذا الفرع") from exc

    @staticmethod
    def _check_fraction(product: Product, qty: int) -> None:
        if not product.allow_decimal and qty % QTY_SCALE:
            raise BadRequestError("fraction_not_allowed", f"«{product.name}» لا يقبل كسوراً")

    def _branch(self, client: SyncClient, branch_id: str) -> dict:
        try:
            rows = self.branches()
        except SyncUnavailable:
            rows = _branches_cache.get(self._branch_id() or "")
            if rows is None:
                raise
        branch = next((b for b in rows if b["id"] == branch_id), None)
        if branch is None or branch.get("is_me"):
            raise BadRequestError("branch_not_found", "الفرع غير موجود")
        if not branch.get("is_active"):
            raise BadRequestError("branch_disabled", "الفرع موقوف")
        return branch

    def _branch_id(self) -> str | None:
        cfg = self.config()
        return cfg["branch_id"] if cfg else None

    def _user_name(self) -> str | None:
        from app.modules.users.model import User  # متأخر: لا دوران

        user = self.session.get(User, self.actor.user_id)
        return (getattr(user, "full_name", None) or getattr(user, "username", None)) if user else None

    def _audit(self, row: BranchTransfer, action: str, changes: dict) -> None:
        record_audit(
            self.session, self.actor, entity=ENTITY, entity_id=row.id, action=action,
            changes={"number": row.number, **changes},
        )  # fmt: skip

    @staticmethod
    def _server_line(line: dict) -> dict:
        return {k: line[k] for k in ("product_id", "barcode", "name", "unit", "qty", "unit_cost",
                                     "batch_no", "expiry_date")}  # fmt: skip

    @staticmethod
    def _invalidate_summary() -> None:
        with _summary_lock:
            _summary_cache.clear()


def _date(value: str | None) -> date | None:
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def _safe_id(value: str) -> str:
    """معرّف فرع في مسار URL: حروف وأرقام وشرطات فقط (لا حقن مسارات)."""
    if not value or len(value) > 64 or not all(ch.isalnum() or ch == "-" for ch in value):
        raise BadRequestError("branch_not_found", "الفرع غير موجود")
    return value

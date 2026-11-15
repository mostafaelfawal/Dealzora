"""تطبيق الهاتف (المالك ومديرو الفروع). مسارات منفصلة عن الفروع، وتوكن الهاتف لا يصلح لمسارات الفروع والعكس.

  POST /mobile/v1/auth/login         {code, username, password, device_id, device_name, platform} ← توكنات
  POST /mobile/v1/auth/refresh       {refresh_token} ← توكنات جديدة (والقديم يتوقف)
  POST /mobile/v1/auth/logout        هذا الهاتف
  POST /mobile/v1/auth/logout-all    كل هواتف هذا الحساب
  GET  /mobile/v1/me                 الحساب وفروعه المسموحة
  GET  /mobile/v1/sessions           هواتف هذا الحساب المسجّلة
  GET  /mobile/v1/branches           الفروع المسموحة: الحالة (متصل/متأخر/منقطع)، آخر ظهور، تأخر المزامنة
  GET  /mobile/v1/branches/{id}      فرع مسموح (غير المسند = 404)
  GET  /mobile/v1/summary?date_from=&date_to=[&branch_id=]
                                     ملخص الفترة لكل فرع ومجمّع + اتجاه يومي + مقارنة (نفس تقرير الفروع)
  GET  /mobile/v1/transfers?status=&needs_action=&branch_id=&page=   تحويلات الفروع المسموحة
  GET  /mobile/v1/transfers/{id}                                     التحويل وأصنافه وموافقة الهاتف عليه
  POST /mobile/v1/transfers/{id}/approve {version, lines?, note?}    موافقة ينفّذها جهاز الفرع (خصم ومخزون وتكلفة)
  POST /mobile/v1/transfers/{id}/reject  {version, reason}           رفض مباشر (لا يحرّك مخزوناً)
  POST /mobile/v1/transfers/{id}/approval/cancel                     إلغاء موافقة لم يأخذها الفرع بعد

كل المسارات (عدا login/refresh/logout) تفرض خطة «سلسلة» على السيرفر: plan_upgrade_required (403).
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select, update

from ..audit import record
from ..db import SessionDep, utcnow
from ..errors import NotFound
from ..mobile_security import MobileOwnerDep, MobileSessionDep, MobileUserDep
from ..models import MobileSession, Notification
from ..ratelimit import client_ip, limit_auth
from ..schemas import (
    BranchExpiringOut,
    BranchShortagesOut,
    CatalogProductOut,
    MobileApproveIn,
    MobileBranchOut,
    MobileDeviceOut,
    MobileLoginIn,
    MobileRefreshIn,
    MobileRejectIn,
    MobileSessionOut,
    MobileShopSessionOut,
    MobileStaffOut,
    MobileSummaryOut,
    MobileTokensOut,
    MobileTransferListOut,
    MobileTransferOut,
    MobileTransferRequestIn,
    MobileUserOut,
    NotificationListOut,
    NotificationOut,
    NotificationPrefsIn,
    NotificationPrefsOut,
    NotificationReadIn,
    PairingCodeOut,
    PriceUpdateIn,
    PushTokenIn,
    RecordOut,
    ReportConfigBody,
    TopSellerOut,
    TransferStatus,
)
from ..services import branch_reports as reports7
from ..services import mobile_admin as admin
from ..services import mobile_auth as svc
from ..services import mobile_reports as reports
from ..services import notifications as notify
from ..services import transfer_commands as transfers

PREFIX = "/mobile/v1"

router = APIRouter(tags=["mobile"])


@router.post("/auth/login", response_model=MobileTokensOut, dependencies=[Depends(limit_auth)])
def login(data: MobileLoginIn, request: Request, session: SessionDep):
    return svc.login(session, data, ip=client_ip(request))


@router.post("/auth/refresh", response_model=MobileTokensOut, dependencies=[Depends(limit_auth)])
def refresh(data: MobileRefreshIn, request: Request, session: SessionDep):
    return svc.refresh(session, data.refresh_token, ip=client_ip(request))


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(ms: MobileSessionDep, request: Request, session: SessionDep):
    svc.logout(session, ms, ip=client_ip(request))


@router.post("/auth/logout-all")
def logout_all(ms: MobileSessionDep, request: Request, session: SessionDep) -> dict[str, int]:
    return {"revoked": svc.logout_all(session, ms, ip=client_ip(request))}


@router.get("/me", response_model=MobileUserOut)
def me(user: MobileUserDep):
    return MobileUserOut(account_id=user.account_id, username=user.username, role=user.role,  # type: ignore[arg-type]
                         shop_id=user.shop_id, shop_name=user.shop_name, branch_ids=list(user.branch_ids))  # fmt: skip


@router.get("/sessions", response_model=list[MobileSessionOut])
def sessions(user: MobileUserDep, session: SessionDep):
    return [
        MobileSessionOut(
            id=s.id,
            device_name=s.device_name,
            platform=s.platform,
            created_at=s.created_at,
            last_used_at=svc.aware(s.last_used_at),
            is_current=s.id == user.session_id,
        )
        for s in svc.active_sessions(session, user.account_id)
    ]


@router.get("/branches", response_model=list[MobileBranchOut])
def branches(user: MobileUserDep, session: SessionDep):
    return reports.branch_states(session, user.shop_id, list(user.branch_ids))


@router.get("/branches/{branch_id}", response_model=MobileBranchOut)
def branch(branch_id: str, user: MobileUserDep, session: SessionDep):
    user.require_branch(branch_id)
    rows = reports.branch_states(session, user.shop_id, [branch_id])
    if not rows:
        raise NotFound("branch_not_found", "الفرع غير موجود")
    return rows[0]


@router.get("/summary", response_model=MobileSummaryOut)
def summary(
    user: MobileUserDep,
    session: SessionDep,
    date_from: Annotated[date, Query()],
    date_to: Annotated[date, Query()],
    branch_id: Annotated[str | None, Query(max_length=36)] = None,
):
    """الفترة بتاريخ الهاتف المحلي (مثل البرنامج). المدير: فروعه فقط، وفرع غير مسند = 404."""
    ids = list(user.branch_ids)
    if branch_id is not None:
        user.require_branch(branch_id)
        ids = [branch_id]
    return reports.summary(session, user.shop_id, ids, date_from, date_to)


@router.get("/transfers", response_model=MobileTransferListOut)
def list_transfers(
    user: MobileUserDep,
    session: SessionDep,
    status_: Annotated[TransferStatus | None, Query(alias="status")] = None,
    needs_action: bool = False,
    branch_id: Annotated[str | None, Query(max_length=36)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 30,
):
    return transfers.mobile_list(session, user, status=status_, needs_action=needs_action, branch_id=branch_id,
                                 page=page, page_size=page_size)  # fmt: skip


@router.get("/transfers/{transfer_id}", response_model=MobileTransferOut)
def get_transfer(transfer_id: str, user: MobileUserDep, session: SessionDep):
    return transfers.mobile_get(session, user, transfer_id)


@router.post("/transfers/{transfer_id}/approve", response_model=MobileTransferOut)
def approve_transfer(transfer_id: str, data: MobileApproveIn, user: MobileUserDep, session: SessionDep):
    return transfers.mobile_approve(session, user, transfer_id, data)


@router.post("/transfers/{transfer_id}/reject", response_model=MobileTransferOut)
def reject_transfer(transfer_id: str, data: MobileRejectIn, user: MobileUserDep, session: SessionDep):
    return transfers.mobile_reject(session, user, transfer_id, data)


@router.post("/transfers/{transfer_id}/approval/cancel", response_model=MobileTransferOut)
def cancel_approval(transfer_id: str, user: MobileUserDep, session: SessionDep):
    return transfers.mobile_cancel_approval(session, user, transfer_id)


# ================= التنبيهات =================
@router.put("/push-token", status_code=status.HTTP_204_NO_CONTENT)
def put_push_token(data: PushTokenIn, user: MobileUserDep, session: SessionDep):
    """هذا الهاتف يستقبل إشعارات push (Expo). يُمسح تلقائياً مع الخروج أو إلغاء الجلسة."""
    notify.register_token(session, shop_id=user.shop_id, session_id=user.session_id, account_id=user.account_id,
                          username=user.username, token=data.token, offset=data.utc_offset_minutes, ip=user.ip)  # fmt: skip


@router.delete("/push-token", status_code=status.HTTP_204_NO_CONTENT)
def delete_push_token(ms: MobileSessionDep, request: Request, session: SessionDep):
    notify.clear_token(session, shop_id=ms.shop_id, session_id=ms.id, username=ms.username, ip=client_ip(request))


@router.get("/notifications", response_model=NotificationListOut)
def list_notifications(
    user: MobileUserDep, session: SessionDep, limit: Annotated[int, Query(ge=1, le=100)] = 50
):
    rows = session.scalars(
        select(Notification)
        .where(Notification.account_id == user.account_id, Notification.status != "dropped")
        .order_by(Notification.created_at.desc())
        .limit(limit)
    ).all()
    items = [NotificationOut(id=n.id, kind=n.kind, title=n.title, body=n.body, route=n.route, status=n.status,  # type: ignore[arg-type]
                             created_at=n.created_at, read_at=n.read_at) for n in rows]  # fmt: skip
    return NotificationListOut(items=items, unread=notify.unread_count(session, user.account_id))


@router.post("/notifications/read", response_model=NotificationListOut)
def read_notifications(data: NotificationReadIn, user: MobileUserDep, session: SessionDep):
    stmt = (
        update(Notification)
        .where(Notification.account_id == user.account_id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    if data.ids is not None:
        stmt = stmt.where(Notification.id.in_(data.ids))
    session.execute(stmt)
    session.commit()
    return list_notifications(user, session)


@router.get("/notification-prefs", response_model=NotificationPrefsOut)
def get_prefs(user: MobileUserDep, session: SessionDep):
    row = notify.prefs_row(session, user.account_id)
    ms = session.get(MobileSession, user.session_id)
    return NotificationPrefsOut(**notify.prefs_of(row), utc_offset_minutes=row.utc_offset_minutes if row else notify.DEFAULT_OFFSET,
                                push_on_this_device=bool(ms and ms.push_token))  # fmt: skip


@router.put("/notification-prefs", response_model=NotificationPrefsOut)
def put_prefs(data: NotificationPrefsIn, user: MobileUserDep, session: SessionDep):
    """إعدادات تنبيهات الحساب (تسري على كل هواتفه)، مع سجل التدقيق «من الهاتف»."""
    row = notify.ensure_prefs(session, user.shop_id, user.account_id)
    body = data.model_dump(exclude={"utc_offset_minutes"})
    row.data = body
    row.utc_offset_minutes = data.utc_offset_minutes
    row.updated_at = utcnow()
    record(session, "notification_prefs_updated", actor="mobile", shop_id=user.shop_id, ip=user.ip,
           details={"username": user.username, "session_id": user.session_id, "from_phone": True,
                    "enabled": [k for k in notify.KINDS if body[k]["enabled"]], "quiet": body["quiet"]})  # fmt: skip
    session.commit()
    return get_prefs(user, session)


# ================= أمان المحل (المالك فقط) =================
@router.get("/admin/staff", response_model=list[MobileStaffOut])
def admin_staff(user: MobileOwnerDep, session: SessionDep):
    return admin.list_staff(session, user)


@router.post("/admin/staff/{staff_id}/deactivate", response_model=MobileStaffOut)
def admin_staff_deactivate(staff_id: str, user: MobileOwnerDep, session: SessionDep):
    """إيقاف فوري: يصل لأجهزة الفروع مع المزامنة، وجلسات الهاتف للمدير تتوقف فوراً."""
    return admin.set_staff_active(session, user, staff_id, False)


@router.post("/admin/staff/{staff_id}/activate", response_model=MobileStaffOut)
def admin_staff_activate(staff_id: str, user: MobileOwnerDep, session: SessionDep):
    return admin.set_staff_active(session, user, staff_id, True)


@router.get("/admin/devices", response_model=list[MobileDeviceOut])
def admin_devices(user: MobileOwnerDep, session: SessionDep):
    return admin.list_devices(session, user)


@router.post("/admin/devices/{branch_id}/revoke", response_model=MobileDeviceOut)
def admin_device_revoke(branch_id: str, user: MobileOwnerDep, session: SessionDep):
    return admin.revoke_device(session, user, branch_id)


@router.post("/admin/devices/{branch_id}/pairing-code", response_model=PairingCodeOut)
def admin_device_pairing(branch_id: str, user: MobileOwnerDep, session: SessionDep):
    return admin.pairing_code(session, user, branch_id)


@router.get("/admin/sessions", response_model=list[MobileShopSessionOut])
def admin_sessions(user: MobileOwnerDep, session: SessionDep):
    return admin.list_sessions(session, user)


@router.post("/admin/sessions/{session_id}/revoke", status_code=status.HTTP_204_NO_CONTENT)
def admin_session_revoke(session_id: str, user: MobileOwnerDep, session: SessionDep):
    admin.revoke_session(session, user, session_id)


# ================= ملخصات الفروع (المرحلة 7) =================
@router.get("/stock/shortages", response_model=list[BranchShortagesOut])
def stock_shortages(user: MobileUserDep, session: SessionDep, branch_id: Annotated[str | None, Query(max_length=36)] = None):
    return reports7.shortages(session, user, branch_id)


@router.get("/stock/expiring", response_model=list[BranchExpiringOut])
def stock_expiring(user: MobileUserDep, session: SessionDep, branch_id: Annotated[str | None, Query(max_length=36)] = None):
    return reports7.expiring(session, user, branch_id)


@router.post("/stock/request-transfer", response_model=MobileTransferOut)
def stock_request_transfer(data: MobileTransferRequestIn, user: MobileUserDep, session: SessionDep):
    return reports7.request_transfer(session, user, data)


@router.get("/shifts", response_model=list[RecordOut])
def shifts(
    user: MobileUserDep, session: SessionDep, date_from: Annotated[date, Query()], date_to: Annotated[date, Query()],
    branch_id: Annotated[str | None, Query(max_length=36)] = None,
):  # fmt: skip
    return reports7.records(session, user, "shift", date_from, date_to, branch_id)


@router.get("/sensitive", response_model=list[RecordOut])
def sensitive(
    user: MobileUserDep, session: SessionDep, date_from: Annotated[date, Query()], date_to: Annotated[date, Query()],
    branch_id: Annotated[str | None, Query(max_length=36)] = None,
):  # fmt: skip
    return reports7.records(session, user, "sensitive", date_from, date_to, branch_id)


@router.get("/top-sellers", response_model=list[TopSellerOut])
def top_sellers(
    user: MobileUserDep, session: SessionDep, date_from: Annotated[date, Query()], date_to: Annotated[date, Query()],
    branch_id: Annotated[str | None, Query(max_length=36)] = None,
):  # fmt: skip
    return reports7.top_sellers(session, user, date_from, date_to, branch_id)


@router.get("/admin/report-config", response_model=ReportConfigBody)
def get_report_config(user: MobileOwnerDep, session: SessionDep):
    admin.require_owner(user)
    return reports7.get_config(session, user.shop_id)


@router.put("/admin/report-config", response_model=ReportConfigBody)
def put_report_config(data: ReportConfigBody, user: MobileOwnerDep, session: SessionDep):
    """حدود العمليات الحساسة وفرق النقدية وأيام الصلاحية: تصل للفروع مع مزامنتها التالية."""
    return reports7.put_config(session, user, data)


# ================= أسعار الأصناف المشتركة (المالك) =================
@router.get("/admin/catalog/search", response_model=list[CatalogProductOut])
def catalog_search(user: MobileOwnerDep, session: SessionDep, q: Annotated[str, Query(max_length=60)] = ""):
    return admin.search_products(session, user, q)


@router.post("/admin/catalog/{gid}/price", response_model=CatalogProductOut)
def catalog_price(gid: str, data: PriceUpdateIn, user: MobileOwnerDep, session: SessionDep):
    """يصل لكل الفروع مع المزامنة. نسخة قديمة = 409 catalog_changed بالسعر الحالي (لا كتابة فوق تعديل فرع)."""
    return admin.update_price(session, user, gid, data)

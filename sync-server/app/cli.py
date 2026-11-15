"""أوامر الإدارة من سطر الأوامر (داخل الحاوية):

    docker compose exec api python -m app.cli create-shop "سوبر ماركت النور"
    docker compose exec api python -m app.cli create-branch <shop_id> "فرع المعادي" MA
    docker compose exec api python -m app.cli pair-code <branch_id>      # كود ربط قصير للمالك
    docker compose exec api python -m app.cli mobile-code <shop_id>      # كود ربط هاتف (تطبيق «سلسلة»)
    docker compose exec api python -m app.cli list
    docker compose exec api python -m app.cli rotate-secret <branch_id>
    docker compose exec api python -m app.cli disable-branch <branch_id>
    python -m app.cli notifier                                            # خدمة تنبيهات الهاتف (خدمة notifier في compose)
    python -m app.cli test-notify [shop_id]                               # إشعار تجريبي لهواتف المحل (أو كل المحلات)

السر يظهر مرة واحدة فقط عند إنشاء الفرع أو تغيير سرّه: انسخه لإعدادات البرنامج المحلي للفرع.
"""

import argparse
import sys

from .db import get_sessionmaker
from .schemas import BranchIn, BranchPatch, ShopIn
from .services import shops


def _print_credentials(creds) -> None:  # noqa: ANN001
    print(f"الفرع: {creds.branch.name} ({creds.branch.code})")
    print(f"branch_id: {creds.branch_id}")
    print(f"secret:    {creds.secret}")
    print("⚠ انسخ السر الآن: لن يظهر مرة أخرى.")


def _notifier(*, loop: bool) -> int:
    """تنبيهات الهاتف: اكتشاف الأحداث ثم الإرسال المجمّع. على PostgreSQL قفل استشاري يمنع عمليتين معاً
    (لا إرسال مزدوج حتى لو شُغّلت الخدمة مرتين بالخطأ)."""
    import logging
    import time

    from sqlalchemy import text

    from .config import get_settings
    from .services import notifications

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    log = logging.getLogger("notify")
    interval = get_settings().notify_interval_seconds
    while True:
        try:
            with get_sessionmaker()() as session:
                postgres = session.get_bind().dialect.name == "postgresql"
                locked = not postgres or session.execute(text("SELECT pg_try_advisory_lock(73314)")).scalar()
                if locked:
                    try:
                        result = notifications.tick(session, notifications.expo_push)
                        if result["created"] or result["pushed"]:
                            log.info("notify: %s", result)
                    finally:
                        if postgres:
                            session.execute(text("SELECT pg_advisory_unlock(73314)"))
                            session.commit()
        except Exception:  # noqa: BLE001 — الخدمة لا تتوقف بسبب دورة فاشلة
            log.exception("notify tick failed")
        if not loop:
            return 0
        time.sleep(interval)


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # طرفية ويندوز: العربي يظهر صحيحاً
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="إدارة Dealzora Sync Hub")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("create-shop", help="محل جديد")
    p.add_argument("name")
    p = sub.add_parser("create-branch", help="فرع جديد لمحل")
    p.add_argument("shop_id")
    p.add_argument("name")
    p.add_argument("code", help="بادئة ترقيم الفرع، حروف إنجليزية/أرقام (مثل MA)")
    sub.add_parser("list", help="كل المحلات وفروعها")
    p = sub.add_parser("pair-code", help="كود ربط قصير (مرة واحدة) يكتبه المالك في برنامج الفرع")
    p.add_argument("branch_id")
    p = sub.add_parser("mobile-code", help="كود ربط هاتف المالك أو المدير بالمحل (مرة واحدة)")
    p.add_argument("shop_id")
    p = sub.add_parser("rotate-secret", help="سر جديد لفرع (القديم يتوقف فوراً)")
    p.add_argument("branch_id")
    sub.add_parser("lease-keygen", help="مفتاح توقيع شهادات الفروع (الخاص للسيرفر، والعام لبناء البرنامج)")
    p = sub.add_parser("make-admin", help="اجعل فرعاً هو الفرع الرئيسي لمحله (لمحل أنشأته يدوياً)")
    p.add_argument("branch_id")
    for name in ("disable-branch", "enable-branch"):
        p = sub.add_parser(name)
        p.add_argument("branch_id")
    sub.add_parser("notifier", help="خدمة تنبيهات الهاتف: دورة كل SYNC_NOTIFY_INTERVAL_SECONDS (عملية واحدة فقط)")
    sub.add_parser("notify-once", help="دورة تنبيهات واحدة (للتجربة أو cron)")
    p = sub.add_parser("test-notify", help="إشعار تجريبي لكل هاتف مسجّل في المحل (أو كل المحلات)")
    p.add_argument("shop_id", nargs="?")
    args = parser.parse_args(argv)

    if args.cmd in ("notifier", "notify-once"):
        return _notifier(loop=args.cmd == "notifier")

    if args.cmd == "lease-keygen":
        import base64

        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        from cryptography.hazmat.primitives.serialization import (
            Encoding, NoEncryption, PrivateFormat, PublicFormat,
        )  # fmt: skip

        key = Ed25519PrivateKey.generate()
        enc = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()  # noqa: E731
        print("SYNC_LEASE_KEY=" + enc(key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption())))
        print("DEALZORA_SYNC_LEASE_PUBKEY=" + enc(key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)))
        print("⚠ الأول في .env السيرفر فقط (سري). الثاني متغير بيئة وقت بناء البرنامج (build-backend.ps1).")
        return 0

    if args.cmd == "test-notify":
        from .services import notifications

        with get_sessionmaker()() as session:
            lines = notifications.send_test(session, notifications.expo_push, args.shop_id)
        print("\n".join(lines) if lines else "لا هاتف مسجّل الدخول (سجّل الدخول من التطبيق أولاً).")
        return 0

    with get_sessionmaker()() as session:
        if args.cmd == "create-shop":
            shop = shops.create_shop(session, ShopIn(name=args.name))
            print(f"shop_id: {shop.id}  ({shop.name})")
        elif args.cmd == "create-branch":
            _print_credentials(
                shops.create_branch(session, args.shop_id, BranchIn(name=args.name, code=args.code))
            )
        elif args.cmd == "list":
            for s in shops.list_shops(session):
                state = "" if s.is_active else "  [موقوف]"
                print(f"{s.id}  {s.name}  (آخر حدث #{s.last_seq}){state}")
                for b in s.branches:
                    seen = b.last_seen_at.isoformat(timespec="minutes") if b.last_seen_at else "لم يتصل"
                    off = "" if b.is_active else "  [موقوف]"
                    print(f"    {b.id}  {b.code:<6} {b.name}  آخر ظهور: {seen}  أكّد حتى #{b.acked_seq}{off}")
        elif args.cmd == "pair-code":
            from .services import pairing

            out = pairing.create_code(session, args.branch_id, ip="cli")
            print(f"الفرع: {out.branch_name}")
            print(f"كود الربط: {out.code}")
            print(f"صالح حتى: {out.expires_at.isoformat(timespec='minutes')} (مرة واحدة فقط)")
        elif args.cmd == "mobile-code":
            from .services import mobile_auth

            out = mobile_auth.create_code(session, args.shop_id, by_branch_id=None, actor="admin", ip="cli")
            print(f"المحل: {out.shop_name}")
            print(f"كود ربط الهاتف: {out.code}")
            print(f"صالح حتى: {out.expires_at.isoformat(timespec='minutes')} (مرة واحدة فقط)")
        elif args.cmd == "rotate-secret":
            _print_credentials(shops.rotate_secret(session, args.branch_id))
        elif args.cmd == "make-admin":
            from sqlalchemy import update

            from .models import Branch

            b = session.get(Branch, args.branch_id)
            if b is None:
                print("الفرع غير موجود")
                return 1
            session.execute(update(Branch).where(Branch.shop_id == b.shop_id).values(is_admin=False))
            b.is_admin = True
            session.commit()
            print(f"«{b.name}» أصبح الفرع الرئيسي: يدير فروع محله من البرنامج.")
        elif args.cmd in ("disable-branch", "enable-branch"):
            b = shops.update_branch(
                session, args.branch_id, BranchPatch(is_active=args.cmd == "enable-branch")
            )
            print(f"{b.name}: {'مفعّل' if b.is_active else 'موقوف'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

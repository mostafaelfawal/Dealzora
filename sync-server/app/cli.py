"""أوامر الإدارة من سطر الأوامر (داخل الحاوية):

    docker compose exec api python -m app.cli create-shop "سوبر ماركت النور"
    docker compose exec api python -m app.cli create-branch <shop_id> "فرع المعادي" MA
    docker compose exec api python -m app.cli pair-code <branch_id>      # كود ربط قصير للمالك
    docker compose exec api python -m app.cli list
    docker compose exec api python -m app.cli rotate-secret <branch_id>
    docker compose exec api python -m app.cli disable-branch <branch_id>

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


def main(argv: list[str] | None = None) -> int:
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
    p = sub.add_parser("rotate-secret", help="سر جديد لفرع (القديم يتوقف فوراً)")
    p.add_argument("branch_id")
    p = sub.add_parser("make-admin", help="اجعل فرعاً هو الفرع الرئيسي لمحله (لمحل أنشأته يدوياً)")
    p.add_argument("branch_id")
    for name in ("disable-branch", "enable-branch"):
        p = sub.add_parser(name)
        p.add_argument("branch_id")
    args = parser.parse_args(argv)

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

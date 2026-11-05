"""إنشاء مستخدم (مدير افتراضياً) من سطر الأوامر. للتطوير فقط، وسيُستبدل بنظام التراخيص.

التشغيل من مجلد backend/ (ليقرأ .env):
    python -m scripts.create_manager admin
    python -m scripts.create_manager sara --role cashier
    python -m scripts.create_manager admin --password 1234

كلمة المرور الافتراضية: DEV_PASSWORD. لا تمر على قواعد قوة كلمة المرور الخاصة بالـ API
(مسموح بها هنا لأن السكربت للتطوير فقط). يرفض العمل إلا لو POS_DEBUG=true.
"""

import argparse
import sys

from app.core.audit import record_audit
from app.core.base import utcnow, uuid7
from app.core.config import get_settings
from app.core.database import get_sessionmaker
from app.core.passwords import hash_password
from app.core.security import Role
from app.modules.users.constants import ENTITY_USER
from app.modules.users.helper import actor_for, normalize_username, user_snapshot
from app.modules.users.model import User
from app.modules.users.repository import UserRepository
from app.modules.users.types import AuditAction

DEV_PASSWORD = "123456"  # غيّرها هنا لو أردت كلمة مرور افتراضية أخرى


def main() -> None:
    parser = argparse.ArgumentParser(description="إنشاء مستخدم (للتطوير فقط)")
    parser.add_argument("username")
    parser.add_argument("--password", default=DEV_PASSWORD)
    parser.add_argument(
        "--role",
        choices=[r.value for r in (Role.MANAGER, Role.CASHIER)],
        default="manager",
    )
    args = parser.parse_args()

    settings = get_settings()
    if not settings.debug:
        sys.exit("مرفوض: هذا السكربت للتطوير فقط (فعّل POS_DEBUG=true في .env)")

    username = normalize_username(args.username)

    with get_sessionmaker()() as session:
        repo = UserRepository(session)
        if repo.username_taken(username):
            sys.exit(f"اسم المستخدم '{username}' مستخدم بالفعل")

        user = User(
            id=uuid7(),
            username=username,
            password_hash=hash_password(args.password),
            role=args.role,
            is_active=True,
            device_id=settings.device_id,
            password_changed_at=utcnow(),
        )
        repo.add_user(user)
        repo.flush()
        record_audit(
            session,
            actor_for(user),
            entity=ENTITY_USER,
            entity_id=user.id,
            action=AuditAction.USER_CREATE.value,
            changes=user_snapshot(user),
        )
        session.commit()
        print(f"تم إنشاء {user.role}: {user.username} / كلمة المرور: {args.password}")


if __name__ == "__main__":
    main()
# python -m scripts.create_manager admin

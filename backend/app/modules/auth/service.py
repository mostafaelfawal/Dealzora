"""قواعد عمل المصادقة: الدخول، الخروج، التحقق من الجلسة، تغيير كلمة المرور. كل أمر كتابة = معاملة واحدة."""

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import utcnow
from app.core.config import get_settings
from app.core.errors import AppError, BadRequestError, ForbiddenError, UnauthorizedError
from app.core.passwords import DUMMY_HASH, hash_password, needs_rehash, verify_password
from app.core.security import Actor, Role
from app.modules.users.constants import ENTITY_USER
from app.modules.users.helper import (
    actor_for,
    parse_role,
    password_contains_username,
    set_password,
)
from app.modules.users.model import User
from app.modules.users.repository import UserRepository
from app.modules.users.schema import UserOut

from .constants import (
    ERROR_MESSAGES,
    LOCK_DURATION,
    MAX_FAILED_ATTEMPTS,
    MAX_SESSIONS_PER_USER,
    SESSION_IDLE_TTL,
    SESSION_TOUCH_INTERVAL,
    SESSION_TTL,
    AuthError,
)
from .helper import aware, generate_token, hash_token
from .model import AuthSession
from .repository import AuthRepository
from .schema import ChangePasswordIn, LoginIn, LoginOut
from .types import AuditAction


def _err(exc: type[AppError], code: AuthError, **details) -> AppError:
    return exc(code=code.value, message=ERROR_MESSAGES[code], details=details or None)


class AuthService:
    def __init__(self, session: Session, actor: Actor | None = None) -> None:
        self.session = session
        self.actor = actor
        self.repo = AuthRepository(session)  # الجلسات
        self.users = UserRepository(session)  # قراءة المستخدمين فقط

    # ================= الدخول والخروج =================
    def login(self, data: LoginIn) -> LoginOut:
        now = utcnow()
        user = self.users.get_by_username(data.username)

        # نتحقق دائماً (حتى لو غير موجود أو مقفل) كي لا يختلف زمن الرد.
        locked = bool(user and user.locked_until and aware(user.locked_until) > now)
        valid = verify_password(
            user.password_hash if user else DUMMY_HASH, data.password
        )
        if locked:
            raise _err(ForbiddenError, AuthError.ACCOUNT_LOCKED)

        role = parse_role(user.role) if user else None
        if not (valid and user and user.is_active and role):
            if user:
                now_locked = self._register_failure(user, now)
                actor = Actor(user.id, role or Role.CASHIER, get_settings().device_id)
                self._audit(
                    actor, user.id, AuditAction.LOGIN_FAILED, {"locked": now_locked}
                )
                self.session.commit()
            raise _err(UnauthorizedError, AuthError.INVALID_CREDENTIALS)

        if needs_rehash(
            user.password_hash
        ):  # رفع قوة التجزئة تلقائياً عند تغيّر المعاملات
            user.password_hash = hash_password(data.password)
        user.failed_attempts = 0
        user.locked_until = None
        user.last_login_at = now

        token = generate_token()
        expires_at = now + SESSION_TTL
        self.repo.delete_stale_sessions(now)
        self.repo.add_session(
            AuthSession(
                token_hash=hash_token(token),
                user_id=user.id,
                last_seen_at=now,
                expires_at=expires_at,
            )
        )
        self.repo.flush()
        self.repo.trim_user_sessions(user.id, MAX_SESSIONS_PER_USER)
        self._audit(actor_for(user), user.id, AuditAction.LOGIN)
        self.session.commit()
        return LoginOut(
            token=token, expires_at=expires_at, user=UserOut.model_validate(user)
        )

    def authenticate(self, token: str) -> Actor:
        """يُستدعى من get_actor في كل طلب محمي. الدور يُقرأ من القاعدة دائماً."""
        now = utcnow()
        row = self.repo.get_session(hash_token(token))
        if row is None:
            raise _err(UnauthorizedError, AuthError.UNAUTHORIZED)

        last_seen = aware(row.last_seen_at or row.created_at)
        if aware(row.expires_at) <= now or now - last_seen > SESSION_IDLE_TTL:
            self.repo.delete_session(row)
            self.session.commit()
            raise _err(UnauthorizedError, AuthError.UNAUTHORIZED)

        user = self.users.get_user(row.user_id)
        role = parse_role(user.role) if user else None
        if user is None or not user.is_active or role is None:
            raise _err(UnauthorizedError, AuthError.UNAUTHORIZED)

        actor = Actor(user_id=user.id, role=role, device_id=get_settings().device_id)
        if (
            now - last_seen > SESSION_TOUCH_INTERVAL
        ):  # نحدّث آخر نشاط بدون كتابة في كل طلب
            row.last_seen_at = now
            try:
                self.session.commit()
            except OperationalError:
                self.session.rollback()
        return actor

    def logout(self, token: str) -> None:
        row = self.repo.get_session(hash_token(token))
        if row:
            self.repo.delete_session(row)
        if self.actor:
            self._audit(self.actor, self.actor.user_id, AuditAction.LOGOUT)
        self.session.commit()

    def get_me(self) -> UserOut:
        return UserOut.model_validate(self._current_user())

    # ================= كلمة مرور المستخدم نفسه =================
    def change_password(self, token: str, data: ChangePasswordIn) -> None:
        actor = self._actor()
        user = self._current_user()
        now = utcnow()

        if user.locked_until and aware(user.locked_until) > now:
            raise _err(ForbiddenError, AuthError.ACCOUNT_LOCKED)

        if not verify_password(user.password_hash, data.current_password):
            # التخمين عبر جلسة مسروقة يُحسب كمحاولة فاشلة، وعند القفل نلغي كل الجلسات.
            now_locked = self._register_failure(user, now)
            if now_locked:
                self.repo.delete_user_sessions(user.id)
            self._audit(
                actor,
                user.id,
                AuditAction.PASSWORD_CHANGE_FAILED,
                {"locked": now_locked},
            )
            self.session.commit()
            raise _err(BadRequestError, AuthError.WRONG_PASSWORD)

        if verify_password(user.password_hash, data.new_password):
            raise _err(BadRequestError, AuthError.SAME_PASSWORD)
        if password_contains_username(data.new_password, user.username):
            raise _err(BadRequestError, AuthError.PASSWORD_HAS_USERNAME)

        set_password(user, data.new_password, now)
        self.repo.delete_user_sessions(user.id, except_hash=hash_token(token))
        self._audit(actor, user.id, AuditAction.PASSWORD_CHANGE)
        self.session.commit()

    # ================= داخلي =================
    def _actor(self) -> Actor:
        if self.actor is None:
            raise _err(UnauthorizedError, AuthError.UNAUTHORIZED)
        return self.actor

    def _current_user(self) -> User:
        user = self.users.get_user(self._actor().user_id)
        if user is None:
            raise _err(UnauthorizedError, AuthError.UNAUTHORIZED)
        return user

    @staticmethod
    def _register_failure(user: User, now) -> bool:
        """يزيد عداد الفشل، ويقفل الحساب عند الحد. يرجع True لو قُفل الآن."""
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + LOCK_DURATION
            user.failed_attempts = 0
            return True
        return False

    def _audit(
        self,
        actor: Actor,
        entity_id: str,
        action: AuditAction,
        changes: dict | None = None,
    ) -> None:
        record_audit(
            self.session,
            actor,
            entity=ENTITY_USER,
            entity_id=entity_id,
            action=action.value,
            changes=changes,
        )

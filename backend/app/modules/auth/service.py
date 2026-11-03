"""قواعد العمل. كل أمر كتابة = معاملة واحدة: البيانات + Audit ثم commit واحد."""

from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.base import utcnow, uuid7
from app.core.config import get_settings
from app.core.errors import (
    AppError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
)
from app.core.security import Actor, Role

from .constants import (
    ENTITY_USER,
    ERROR_MESSAGES,
    LOCK_DURATION,
    MAX_FAILED_ATTEMPTS,
    MAX_SESSIONS_PER_USER,
    SESSION_IDLE_TTL,
    SESSION_TOUCH_INTERVAL,
    SESSION_TTL,
    AuthError,
)
from .helper import (
    DUMMY_HASH,
    aware,
    diff_snapshots,
    generate_token,
    hash_password,
    hash_token,
    needs_rehash,
    parse_role,
    password_contains_username,
    user_snapshot,
    verify_password,
)
from .model import AuthSession, User
from .repository import AuthRepository
from .schema import (
    ChangePasswordIn,
    LoginIn,
    LoginOut,
    ResetPasswordIn,
    SetupIn,
    UserCreate,
    UserOut,
    UserUpdate,
)
from .types import AuditAction


def _err(exc: type[AppError], code: AuthError, **details) -> AppError:
    return exc(code=code.value, message=ERROR_MESSAGES[code], details=details or None)


class AuthService:
    def __init__(self, session: Session, actor: Actor | None = None) -> None:
        self.session = session
        self.actor = actor
        self.repo = AuthRepository(session)

    # ================= الإعداد الأول =================
    def setup_required(self) -> bool:
        return self.repo.count_users() == 0

    def setup_first_manager(self, data: SetupIn) -> UserOut:
        if self.repo.count_users() > 0:
            raise _err(ConflictError, AuthError.ALREADY_SETUP)
        user = self._new_user(data.username, data.password, Role.MANAGER)
        self.repo.add_user(user)
        self.repo.flush()
        self._audit(self._actor_for(user), user.id, AuditAction.SETUP, user_snapshot(user))
        self._commit()
        return UserOut.model_validate(user)

    # ================= الدخول والخروج =================
    def login(self, data: LoginIn) -> LoginOut:
        now = utcnow()
        user = self.repo.get_by_username(data.username)

        # نتحقق دائماً (حتى لو غير موجود أو مقفل) كي لا يختلف زمن الرد.
        locked = bool(user and user.locked_until and aware(user.locked_until) > now)
        valid = verify_password(user.password_hash if user else DUMMY_HASH, data.password)
        if locked:
            raise _err(ForbiddenError, AuthError.ACCOUNT_LOCKED)

        role = parse_role(user.role) if user else None
        if not (valid and user and user.is_active and role):
            if user:
                now_locked = self._register_failure(user, now)
                actor = Actor(user.id, role or Role.CASHIER, get_settings().device_id)
                self._audit(actor, user.id, AuditAction.LOGIN_FAILED, {"locked": now_locked})
                self.session.commit()
            raise _err(UnauthorizedError, AuthError.INVALID_CREDENTIALS)

        if needs_rehash(user.password_hash):  # رفع قوة التجزئة تلقائياً عند تغيّر المعاملات
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
        self._audit(self._actor_for(user), user.id, AuditAction.LOGIN)
        self.session.commit()
        return LoginOut(token=token, expires_at=expires_at, user=UserOut.model_validate(user))

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

        user = self.repo.get_user(row.user_id)
        role = parse_role(user.role) if user else None
        if user is None or not user.is_active or role is None:
            raise _err(UnauthorizedError, AuthError.UNAUTHORIZED)

        actor = Actor(user_id=user.id, role=role, device_id=get_settings().device_id)
        if now - last_seen > SESSION_TOUCH_INTERVAL:  # نحدّث آخر نشاط بدون كتابة في كل طلب
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
        return UserOut.model_validate(self._get_or_404(self._actor().user_id))

    # ================= كلمة مرور المستخدم نفسه =================
    def change_password(self, token: str, data: ChangePasswordIn) -> None:
        actor = self._actor()
        user = self._get_or_404(actor.user_id)
        now = utcnow()

        if user.locked_until and aware(user.locked_until) > now:
            raise _err(ForbiddenError, AuthError.ACCOUNT_LOCKED)

        if not verify_password(user.password_hash, data.current_password):
            # التخمين عبر جلسة مسروقة يُحسب كمحاولة فاشلة، وعند القفل نلغي كل الجلسات.
            now_locked = self._register_failure(user, now)
            if now_locked:
                self.repo.delete_user_sessions(user.id)
            self._audit(actor, user.id, AuditAction.PASSWORD_CHANGE_FAILED, {"locked": now_locked})
            self.session.commit()
            raise _err(BadRequestError, AuthError.WRONG_PASSWORD)

        if verify_password(user.password_hash, data.new_password):
            raise _err(BadRequestError, AuthError.SAME_PASSWORD)
        if password_contains_username(data.new_password, user.username):
            raise _err(BadRequestError, AuthError.PASSWORD_HAS_USERNAME)

        self._set_password(user, data.new_password, now)
        self.repo.delete_user_sessions(user.id, except_hash=hash_token(token))
        self._audit(actor, user.id, AuditAction.PASSWORD_CHANGE)
        self._commit()

    # ================= إدارة المستخدمين (مدير) =================
    def list_users(self) -> list[UserOut]:
        self._require_manager()
        return [UserOut.model_validate(u) for u in self.repo.list_users()]

    def create_user(self, data: UserCreate) -> UserOut:
        actor = self._require_manager()
        if self.repo.username_taken(data.username):
            raise _err(ConflictError, AuthError.USERNAME_TAKEN)
        user = self._new_user(data.username, data.password, data.role, created_by=actor.user_id)
        self.repo.add_user(user)
        self.repo.flush()
        self._audit(actor, user.id, AuditAction.USER_CREATE, user_snapshot(user))
        self._commit()
        return UserOut.model_validate(user)

    def update_user(self, user_id: str, data: UserUpdate) -> UserOut:
        actor = self._require_manager()
        user = self._get_or_404(user_id)
        is_self = user.id == actor.user_id

        # ---- فحوصات أولاً، ثم التطبيق ----
        if data.username is not None and data.username != user.username:
            if self.repo.username_taken(data.username, exclude_id=user.id):
                raise _err(ConflictError, AuthError.USERNAME_TAKEN)

        role_changes = data.role is not None and data.role.value != user.role
        deactivating = data.is_active is False and user.is_active
        if role_changes or deactivating:
            if is_self:
                raise _err(ForbiddenError, AuthError.SELF_ACTION)
            self._ensure_not_last_manager(user)

        before = user_snapshot(user)
        if data.username is not None:
            user.username = data.username
        if data.role is not None:
            user.role = data.role.value
        if data.is_active is not None:
            user.is_active = data.is_active
            if data.is_active:  # إعادة التفعيل تفك القفل
                user.failed_attempts = 0
                user.locked_until = None
        if deactivating:
            self.repo.delete_user_sessions(user.id)  # لا تعود الجلسات القديمة عند إعادة التفعيل

        changes = diff_snapshots(before, user_snapshot(user))
        if changes:
            user.mark_modified()
            self._audit(actor, user.id, AuditAction.USER_UPDATE, changes)
            self._commit()
        return UserOut.model_validate(user)

    def reset_password(self, user_id: str, data: ResetPasswordIn) -> None:
        actor = self._require_manager()
        user = self._get_or_404(user_id)
        if user.id == actor.user_id:  # لنفسه: عبر change-password بكلمة المرور الحالية
            raise _err(ForbiddenError, AuthError.SELF_ACTION)
        if password_contains_username(data.new_password, user.username):
            raise _err(BadRequestError, AuthError.PASSWORD_HAS_USERNAME)

        self._set_password(user, data.new_password, utcnow())
        user.locked_until = None
        self.repo.delete_user_sessions(user.id)
        self._audit(actor, user.id, AuditAction.PASSWORD_RESET)
        self._commit()

    def delete_user(self, user_id: str) -> None:
        actor = self._require_manager()
        user = self._get_or_404(user_id)
        if user.id == actor.user_id:
            raise _err(ForbiddenError, AuthError.SELF_ACTION)
        self._ensure_not_last_manager(user)

        self.repo.delete_user_sessions(user.id)
        user.mark_deleted()  # tombstone: الاسم يصبح متاحاً من جديد
        self._audit(actor, user.id, AuditAction.USER_DELETE, {"username": user.username})
        self._commit()

    # ================= داخلي =================
    def _actor(self) -> Actor:
        if self.actor is None:
            raise _err(UnauthorizedError, AuthError.UNAUTHORIZED)
        return self.actor

    def _require_manager(self) -> Actor:
        """دفاع إضافي: الـ route يفحص الدور، والـ service يفحصه أيضاً."""
        actor = self._actor()
        if actor.role is not Role.MANAGER:
            raise _err(ForbiddenError, AuthError.FORBIDDEN)
        return actor

    def _get_or_404(self, user_id: str) -> User:
        user = self.repo.get_user(user_id)
        if user is None:
            raise _err(NotFoundError, AuthError.USER_NOT_FOUND)
        return user

    def _ensure_not_last_manager(self, user: User) -> None:
        is_active_manager = user.role == Role.MANAGER.value and user.is_active
        if is_active_manager and self.repo.count_active_managers(exclude_id=user.id) == 0:
            raise _err(ConflictError, AuthError.LAST_MANAGER)

    @staticmethod
    def _new_user(username: str, password: str, role: Role, created_by: str | None = None) -> User:
        return User(
            id=uuid7(),
            username=username,
            password_hash=hash_password(password),
            role=role.value,
            is_active=True,
            device_id=get_settings().device_id,
            created_by=created_by,
            password_changed_at=utcnow(),
        )

    @staticmethod
    def _set_password(user: User, password: str, now) -> None:
        user.password_hash = hash_password(password)
        user.password_changed_at = now
        user.failed_attempts = 0
        user.mark_modified()

    @staticmethod
    def _register_failure(user: User, now) -> bool:
        """يزيد عداد الفشل، ويقفل الحساب عند الحد. يرجع True لو قُفل الآن."""
        user.failed_attempts += 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + LOCK_DURATION
            user.failed_attempts = 0
            return True
        return False

    @staticmethod
    def _actor_for(user: User) -> Actor:
        return Actor(user.id, Role(user.role), get_settings().device_id)

    def _audit(
        self, actor: Actor, entity_id: str, action: AuditAction, changes: dict | None = None
    ) -> None:
        record_audit(
            self.session,
            actor,
            entity=ENTITY_USER,
            entity_id=entity_id,
            action=action.value,
            changes=changes,
        )

    def _commit(self) -> None:
        try:
            self.session.commit()
        except IntegrityError as exc:  # سباق على اسم المستخدم الفريد
            self.session.rollback()
            raise _err(ConflictError, AuthError.USERNAME_TAKEN) from exc
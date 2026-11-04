"""قواعد عمل المستخدمين. كل أمر كتابة = معاملة واحدة: البيانات + Audit ثم commit واحد.

يعتمد على auth فقط لإلغاء الجلسات (AuthRepository) داخل نفس المعاملة.
"""

from sqlalchemy.exc import IntegrityError
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
from app.core.passwords import hash_password
from app.core.security import Actor, Role
from app.modules.auth.repository import AuthRepository

from .constants import ENTITY_USER, ERROR_MESSAGES, UserError
from .helper import (
    actor_for,
    diff_snapshots,
    password_contains_username,
    set_password,
    user_snapshot,
)
from .model import User
from .repository import UserRepository
from .schema import ResetPasswordIn, SetupIn, UserCreate, UserOut, UserUpdate
from .types import AuditAction


def _err(exc: type[AppError], code: UserError, **details) -> AppError:
    return exc(code=code.value, message=ERROR_MESSAGES[code], details=details or None)


class UserService:
    def __init__(self, session: Session, actor: Actor | None = None) -> None:
        self.session = session
        self.actor = actor
        self.repo = UserRepository(session)
        self.sessions = AuthRepository(session)  # لإلغاء الجلسات فقط

    # ================= الإعداد الأول =================
    def setup_required(self) -> bool:
        return self.repo.count_users() == 0

    def setup_first_manager(self, data: SetupIn) -> UserOut:
        if self.repo.count_users() > 0:
            raise _err(ConflictError, UserError.ALREADY_SETUP)
        user = self._new_user(data.username, data.password, Role.MANAGER)
        self.repo.add_user(user)
        self.repo.flush()
        self._audit(actor_for(user), user.id, AuditAction.SETUP, user_snapshot(user))
        self._commit()
        return UserOut.model_validate(user)

    # ================= إدارة المستخدمين (مدير) =================
    def list_users(self) -> list[UserOut]:
        self._require_manager()
        return [UserOut.model_validate(u) for u in self.repo.list_users()]

    def create_user(self, data: UserCreate) -> UserOut:
        actor = self._require_manager()
        if self.repo.username_taken(data.username):
            raise _err(ConflictError, UserError.USERNAME_TAKEN)
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
                raise _err(ConflictError, UserError.USERNAME_TAKEN)

        role_changes = data.role is not None and data.role.value != user.role
        deactivating = data.is_active is False and user.is_active
        if role_changes or deactivating:
            if is_self:
                raise _err(ForbiddenError, UserError.SELF_ACTION)
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
            self.sessions.delete_user_sessions(user.id)  # لا تعود الجلسات القديمة عند إعادة التفعيل

        changes = diff_snapshots(before, user_snapshot(user))
        if changes:
            user.mark_modified()
            self._audit(actor, user.id, AuditAction.USER_UPDATE, changes)
            self._commit()
        return UserOut.model_validate(user)

    def reset_password(self, user_id: str, data: ResetPasswordIn) -> None:
        actor = self._require_manager()
        user = self._get_or_404(user_id)
        if user.id == actor.user_id:  # لنفسه: عبر /auth/change-password بكلمة المرور الحالية
            raise _err(ForbiddenError, UserError.SELF_ACTION)
        if password_contains_username(data.new_password, user.username):
            raise _err(BadRequestError, UserError.PASSWORD_HAS_USERNAME)

        set_password(user, data.new_password, utcnow())
        user.locked_until = None
        self.sessions.delete_user_sessions(user.id)
        self._audit(actor, user.id, AuditAction.PASSWORD_RESET)
        self._commit()

    def delete_user(self, user_id: str) -> None:
        actor = self._require_manager()
        user = self._get_or_404(user_id)
        if user.id == actor.user_id:
            raise _err(ForbiddenError, UserError.SELF_ACTION)
        self._ensure_not_last_manager(user)

        self.sessions.delete_user_sessions(user.id)
        user.mark_deleted()  # tombstone: الاسم يصبح متاحاً من جديد
        self._audit(actor, user.id, AuditAction.USER_DELETE, {"username": user.username})
        self._commit()

    # ================= داخلي =================
    def _actor(self) -> Actor:
        if self.actor is None:
            raise _err(UnauthorizedError, UserError.UNAUTHORIZED)
        return self.actor

    def _require_manager(self) -> Actor:
        """دفاع إضافي: الـ route يفحص الدور، والـ service يفحصه أيضاً."""
        actor = self._actor()
        if actor.role is not Role.MANAGER:
            raise _err(ForbiddenError, UserError.FORBIDDEN)
        return actor

    def _get_or_404(self, user_id: str) -> User:
        user = self.repo.get_user(user_id)
        if user is None:
            raise _err(NotFoundError, UserError.USER_NOT_FOUND)
        return user

    def _ensure_not_last_manager(self, user: User) -> None:
        is_active_manager = user.role == Role.MANAGER.value and user.is_active
        if is_active_manager and self.repo.count_active_managers(exclude_id=user.id) == 0:
            raise _err(ConflictError, UserError.LAST_MANAGER)

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
            raise _err(ConflictError, UserError.USERNAME_TAKEN) from exc
"""Dependencies مشتركة للـ routes: الجلسة، الـ Actor، مصنع الـ service، base_version."""

from typing import Annotated, TypeVar

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from .database import get_session
from .security import Actor, get_actor

T = TypeVar("T")

SessionDep = Annotated[Session, Depends(get_session)]
ActorDep = Annotated[Actor, Depends(get_actor)]
BaseVersionQuery = Annotated[int, Query(ge=1)]  # للحذف والتفعيل/التعطيل


def service_dependency(service_cls: type[T]) -> type[T]:
    """يبني Annotated للـ service (session + actor).

    الاستخدام في routes:
        Service = service_dependency(ExpenseService)
        def list_expenses(service: Service, ...): ...
    """

    def _get(session: SessionDep, actor: ActorDep) -> T:
        return service_cls(session, actor)  # type: ignore[call-arg]

    return Annotated[service_cls, Depends(_get)]  # type: ignore[return-value]
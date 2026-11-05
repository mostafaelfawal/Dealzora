"""طبقة HTTP فقط: استقبال الطلب، حماية الدور، استدعاء الـ service. لا منطق عمل هنا.

ترتيب المسارات مهم: الثابتة (summary / bulk-delete) قبل /{expense_id}.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_session
from app.core.security import Actor, get_actor

from .middleware import require_admin, require_admin_write
from .schema import (
    BulkIn,
    BulkResultOut,
    ExpenseCreate,
    ExpenseListOut,
    ExpenseListQuery,
    ExpenseOut,
    ExpensesSummaryOut,
    ExpenseUpdate,
)
from .service import ExpenseService

router = APIRouter(prefix="/expenses", tags=["expenses"])


def get_expense_service(
    session: Annotated[Session, Depends(get_session)],
    actor: Annotated[Actor, Depends(get_actor)],
) -> ExpenseService:
    return ExpenseService(session, actor)


Service = Annotated[ExpenseService, Depends(get_expense_service)]


# ---------- قراءة: أدمن ----------
@router.get("", response_model=ExpenseListOut, dependencies=[Depends(require_admin)])
def list_expenses(service: Service, query: Annotated[ExpenseListQuery, Query()]):
    return service.list_expenses(query)


@router.get("/summary", response_model=ExpensesSummaryOut, dependencies=[Depends(require_admin)])
def expenses_summary(service: Service):
    return service.summary()


# ---------- كتابة: أدمن + تصريح كتابة ----------
@router.post(
    "",
    response_model=ExpenseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_write)],
)
def create_expense(data: ExpenseCreate, service: Service):
    return service.create_expense(data)


@router.post(
    "/bulk-delete",
    response_model=BulkResultOut,
    dependencies=[Depends(require_admin_write)],
)
def bulk_delete_expenses(data: BulkIn, service: Service):
    return service.bulk_delete(data)


@router.put("/{expense_id}", response_model=ExpenseOut, dependencies=[Depends(require_admin_write)])
def update_expense(expense_id: str, data: ExpenseUpdate, service: Service):
    return service.update_expense(expense_id, data)


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin_write)],
)
def delete_expense(expense_id: str, service: Service, base_version: Annotated[int, Query(ge=1)]):
    service.delete_expense(expense_id, base_version)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
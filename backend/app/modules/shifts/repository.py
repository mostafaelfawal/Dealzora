"""الوصول لقاعدة البيانات فقط. لا commit هنا."""

from sqlalchemy import case, func, select

from app.core.repository import BaseRepository, fetch_page, live

from .model import Shift
from .types import ShiftTotals


class ShiftRepository(BaseRepository[Shift]):
    model = Shift

    def current(self, device_id: str) -> Shift | None:
        """الوردية المفتوحة على هذا الجهاز (لكل جهاز كاشير درجه ووردياته)."""
        stmt = select(Shift).where(
            Shift.is_open.is_(True), Shift.device_id == device_id, live(Shift)
        )
        return self.session.scalars(stmt).first()

    def list_shifts(self, page: int, page_size: int) -> tuple[list[Shift], int]:
        return fetch_page(
            self.session,
            Shift,
            [live(Shift)],
            [Shift.opened_at.desc(), Shift.id.desc()],
            page,
            page_size,
        )

    def totals(self, shift_ids: list[str]) -> dict[str, ShiftTotals]:
        """مجاميع المبيعات والمرتجعات لكل وردية (استيراد متأخر: sales يعتمد على shifts)."""
        from app.modules.sales.model import Sale, SaleReturn

        if not shift_ids:
            return {}
        def wallet(method: str):
            return func.coalesce(
                func.sum(case((Sale.payment_method == method, Sale.wallet_amount), else_=0)), 0
            )

        sales = {
            sid: tuple(vals)
            for sid, *vals in self.session.execute(
                select(
                    Sale.shift_id,
                    func.count(),
                    func.coalesce(func.sum(Sale.total), 0),
                    func.coalesce(func.sum(Sale.cash_amount), 0),
                    func.coalesce(func.sum(Sale.credit_amount), 0),
                    wallet("vodafone_cash"),
                    wallet("instapay"),
                )
                .where(Sale.shift_id.in_(shift_ids), live(Sale))
                .group_by(Sale.shift_id)
            ).all()
        }
        returns = {
            sid: (cnt, cash, wallet_back)
            for sid, cnt, cash, wallet_back in self.session.execute(
                select(
                    SaleReturn.shift_id,
                    func.count(),
                    func.coalesce(func.sum(SaleReturn.cash_refund), 0),
                    func.coalesce(func.sum(SaleReturn.wallet_refund), 0),
                )
                .where(SaleReturn.shift_id.in_(shift_ids), live(SaleReturn))
                .group_by(SaleReturn.shift_id)
            ).all()
        }
        out: dict[str, ShiftTotals] = {}
        for sid in shift_ids:
            s_cnt, s_total, s_cash, s_credit, s_vf, s_ip = sales.get(sid, (0, 0, 0, 0, 0, 0))
            r_cnt, r_cash, r_wallet = returns.get(sid, (0, 0, 0))
            out[sid] = ShiftTotals(
                sales_count=s_cnt,
                sales_total=s_total,
                cash_sales=s_cash,
                credit_sales=s_credit,
                returns_count=r_cnt,
                cash_refunds=r_cash,
                vodafone_sales=s_vf,
                instapay_sales=s_ip,
                wallet_refunds=r_wallet,
            )
        return out

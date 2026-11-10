"""dataclasses داخلية."""

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ShiftTotals:
    sales_count: int
    sales_total: int  # إجمالي الفواتير (كاش + آجل)
    cash_sales: int  # الجزء الكاش من الفواتير
    credit_sales: int
    returns_count: int
    cash_refunds: int

    def expected(self, opening_float: int) -> int:
        return opening_float + self.cash_sales - self.cash_refunds

"""قياس زمن البيع قبل وبعد ملخصات المرحلة 7 (النواقص والورديات والعمليات الحساسة والأكثر مبيعاً).

المرحلة 7 لم تغيّر مسار البيع نفسه: الملخصات تُحسب في المزامنة (مرة كل دقيقة) بقراءة فقط. القياس هنا:
  1) «قبل»: N فاتورة متتالية بلا أي حساب ملخصات.
  2) «بعد»: N فاتورة بينما يحسب خيط آخر الملخصات **بلا توقف** (أسوأ بكثير من الواقع: مرة كل دقيقة).
  3) زمن حساب الملخصات نفسه مع تاريخ مبيعات كبير.

قاعدة SQLCipher مؤقتة (لا تلمس قاعدة البرنامج). التشغيل من مجلد backend:
    .venv/Scripts/python -m tools.bench_sale_reports [عدد_الفواتير]
"""

import os
import shutil
import statistics
import sys
import tempfile
import threading
import time
from pathlib import Path

os.environ.setdefault("POS_DB_PASSWORD", "bench-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-bench")

from app.core import database
from app.core.base import uuid7
from app.core.config import get_settings
from app.core.security import Actor, Role

DEVICE = "dev-bench"
CASHIER_ID = "0190f0aa-0000-7000-8000-0000000be4c1"
ACTOR = Actor(user_id=CASHIER_ID, role=Role.MANAGER, device_id=DEVICE)
CONFIG = {"discount_min": 500, "return_min": 10_000, "expiry_days": 30, "wanted": []}


def setup(tmp: str) -> list:
    settings = get_settings()
    settings.db_path = str(Path(tmp) / "bench.db")
    settings.device_id = DEVICE
    settings.plan = "enterprise"
    for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
        f.cache_clear()
    from app.core.init_db import init_db
    from app.core.passwords import hash_password
    from app.modules.products.schema import ProductCreate
    from app.modules.products.service import ProductService
    from app.modules.shifts.schema import ShiftOpenIn
    from app.modules.shifts.service import ShiftService
    from app.modules.users.model import User

    init_db()
    with database.get_write_sessionmaker()() as s:
        s.add(User(id=CASHIER_ID, username="bench", password_hash=hash_password("bench-pass-1"), role="manager",
                   is_active=True, device_id=DEVICE))  # fmt: skip
        s.commit()
        svc = ProductService(s, ACTOR)
        products = [svc.create_product(ProductCreate(name=f"صنف {i}", barcode=f"62200{i:05d}", sale_price=1_000 + i,
                                                     opening_stock=10_000_000, min_stock=5_000_000 if i % 7 == 0 else 0))
                    for i in range(200)]  # fmt: skip
        s.commit()
        ShiftService(s, ACTOR).open_shift(ShiftOpenIn(opening_float=0))
    return products


def sell(products: list, i: int) -> float:
    from app.modules.sales.schema import SaleCreate, SaleLineIn
    from app.modules.sales.service import SaleService

    picks = [products[(i * 7 + k) % len(products)] for k in range(3)]
    discount = 500 if i % 10 == 0 else 0
    total = sum(p.sale_price for p in picks) - discount
    started = time.perf_counter()
    with database.get_write_sessionmaker()() as s:
        SaleService(s, ACTOR).create_sale(SaleCreate(
            client_ref=uuid7(), payment_method="cash", cash_amount=total, received=total, invoice_discount=discount,
            lines=[SaleLineIn(product_id=p.id, qty=1000, unit_price=p.sale_price) for p in picks],
        ))  # fmt: skip
    return (time.perf_counter() - started) * 1000


def summary(name: str, ms: list[float]) -> str:
    ms = sorted(ms)
    p95 = ms[int(len(ms) * 0.95) - 1]
    slow = sum(1 for m in ms if m > 200)
    return (f"{name:<40} n={len(ms):<5} median={statistics.median(ms):6.1f}ms  p95={p95:6.1f}ms  "
            f"max={ms[-1]:6.1f}ms  >200ms={slow}")


def main() -> None:
    from app.modules.branch_sync import branch_reports

    n = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    tmp = tempfile.mkdtemp(prefix="dealzora-bench-")
    try:
        products = setup(tmp)
        for i in range(n):  # تاريخ مبيعات (ويسخّن الذاكرة)
            sell(products, i)

        before = [sell(products, i) for i in range(n)]

        collects: list[float] = []

        def run_with_collector(offset: int, pause: float) -> list[float]:
            stop = threading.Event()

            def collector() -> None:
                while not stop.is_set():
                    started = time.perf_counter()
                    with database.get_sessionmaker()() as s:
                        branch_reports.collect(s, {}, CONFIG)
                    collects.append((time.perf_counter() - started) * 1000)
                    stop.wait(pause)

            worker = threading.Thread(target=collector, daemon=True)
            worker.start()
            out = [sell(products, offset + i) for i in range(n)]
            stop.set()
            worker.join()
            return out

        after = run_with_collector(n, 0)  # بلا توقف: أسوأ حالة ممكنة
        realistic = run_with_collector(2 * n, 5)  # كل 5 ثوانٍ (الواقع: كل 5 دقائق)

        print(f"تاريخ المبيعات: حتى {4 * n} فاتورة، 200 صنف")
        print(summary("قبل (بيع فقط)", before))
        print(summary("بعد (بيع + ملخصات بلا توقف)", after))
        print(summary("بعد (بيع + ملخصات كل 5 ثوانٍ)", realistic))
        print(summary("حساب الملخصات نفسه", collects))
    finally:
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            if f.cache_info().currsize:
                database.get_engine().dispose()
            f.cache_clear()
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()

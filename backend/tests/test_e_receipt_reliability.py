"""ضمان وصول الإيصالات (المرحلة 5): انقطاع الشبكة، إغلاق البرنامج أثناء الإرسال، الترتيب، عدم التكرار،
انتظار المرتجع لقبول فاتورته، ومهلة الـ 24 ساعة. خادم منظومة وهمي يتذكر ما استلمه وبأي ترتيب.

التشغيل من مجلد backend:  .venv/Scripts/python -m unittest discover -s tests -t . -v
"""

import json
import unittest
from datetime import date, datetime, timedelta, timezone
from unittest import mock

from app.core import database
from app.modules.e_receipt.client import EtaClient, EtaNetworkError
from tests.test_e_receipt_sender import DEVICE, Clock, EtaDbCase, resp, token_ok


class SimulatedCrash(BaseException):
    """إغلاق البرنامج فجأة (ليس Exception: لا يلتقطه أي معالج في الكود)."""


class FakeEtaServer:
    """خادم وهمي بحالة: يتذكر كل إيصال استلمه بالترتيب، ويرفض المكرر كما تفعل المنظومة."""

    def __init__(self) -> None:
        self.online = True
        self.received: list[str] = []  # UUIDs بترتيب الوصول
        self.status: dict[str, str] = {}  # uuid ← Valid / Invalid
        self.submissions: dict[str, list[str]] = {}
        self.submit_calls = 0
        self.crash_after_receive = False  # البرنامج يُغلق بعد وصول الدفعة وقبل وصول الرد
        self.timeout_after_receive = False  # وصلت الدفعة وانقطع الاتصال قبل الرد
        self.lose_next_submit = False  # انقطع الاتصال قبل أن تصل الدفعة (مهلة بلا وصول)
        self.invalid: set[str] = set()  # إيصالات سيرفضها التحقق اللاحق

    def __call__(self, method, url, headers, body, env):  # noqa: ANN001
        if not self.online:
            raise EtaNetworkError("network unreachable", maybe_sent=False)
        if url.endswith("/connect/token"):
            return token_ok()
        if url.endswith("/receiptsubmissions"):
            self.submit_calls += 1
            if self.lose_next_submit:
                self.lose_next_submit = False
                raise EtaNetworkError("timed out")  # maybe_sent=True: لا نعرف
            uuids = [d["header"]["uuid"] for d in json.loads(body)["receipts"]]
            fresh = [u for u in uuids if u not in self.status]
            for u in fresh:
                self.received.append(u)
                self.status[u] = "Invalid" if u in self.invalid else "Valid"
            sub = f"SUB-{self.submit_calls}"
            self.submissions[sub] = fresh
            if self.crash_after_receive:
                self.crash_after_receive = False
                raise SimulatedCrash
            if self.timeout_after_receive:
                self.timeout_after_receive = False
                raise EtaNetworkError("connection reset")
            return resp(202, {
                "submissionUUID": sub,
                "acceptedDocuments": [{"uuid": u, "longId": f"L-{u[-6:]}"} for u in fresh],
                "rejectedDocuments": [{"uuid": u, "receiptNumber": "x", "error": {"message": "Duplicate receipt uuid"}}
                                      for u in uuids if u not in fresh],
            })  # fmt: skip
        if "/receiptsubmissions/" in url:
            sub = url.split("/receiptsubmissions/")[1].split("/")[0]
            return resp(200, {"status": "Valid", "metadata": {"totalPages": 1},
                              "receipts": [{"uuid": u, "status": self.status[u]} for u in self.submissions[sub]]})  # fmt: skip
        uuid = url.split("/receipts/")[1].split("/")[0]  # Get Receipt Details
        if uuid not in self.status:
            return resp(404, {"error": {"code": "NotFound"}})
        return resp(200, {"receipt": {"status": self.status[uuid]}})


class ReliabilityTests(EtaDbCase):
    def setUp(self):
        from app.modules.sales.model import Sale, SaleReturn

        with database.get_write_sessionmaker()() as s:
            s.query(SaleReturn).delete()
            s.query(Sale).delete()
            s.commit()
        self.server = FakeEtaServer()
        self.clock = Clock()
        self.wall = datetime(2026, 11, 15, 12, 0, tzinfo=timezone.utc)
        self.sender = self._new_sender()
        self.seq = 0

    def _new_sender(self):  # noqa: ANN202 - «إعادة تشغيل البرنامج» = مرسِل جديد بلا أي ذاكرة
        from app.modules.e_receipt.sender import Sender

        return Sender(EtaClient(transport=self.server, clock=self.clock), sleep=self.clock.sleep,
                      clock=self.clock, wall=lambda: self.wall)  # fmt: skip

    def _receipt(self, *, kind="sale", reference: str | None = None, sale_id: str | None = None,
                 created: datetime | None = None) -> tuple[str, str]:  # fmt: skip
        from app.modules.sales.model import Sale, SaleReturn

        self.seq += 1
        uuid = f"{self.seq:064x}"
        common = dict(device_id=DEVICE, eta_status="not_sent", eta_uuid=uuid, eta_seq=self.seq,
                      eta_device_id=DEVICE, eta_document=json.dumps({"header": {"uuid": uuid}}),
                      eta_receipt_number=f"{'R-' if kind == 'return' else ''}{self.seq}", total=100)  # fmt: skip
        if created:
            common["created_at"] = created
        with database.get_write_sessionmaker()() as s:
            if kind == "sale":
                row = Sale(number=self.seq, client_ref=f"r-{self.seq}-{self.id()[-15:]}", sold_on=date(2026, 11, 15),
                           payment_method="cash", subtotal=100, **common)  # fmt: skip
            else:
                row = SaleReturn(number=self.seq, sale_id=sale_id, returned_on=date(2026, 11, 15), reason="other",
                                 eta_reference_uuid=reference, **common)  # fmt: skip
            s.add(row)
            s.commit()
            return row.id, uuid

    def _status(self) -> dict[str, str]:
        from app.modules.sales.model import Sale, SaleReturn

        with database.get_sessionmaker()() as s:
            rows = [*s.query(Sale).all(), *s.query(SaleReturn).all()]
            return {r.eta_uuid: r.eta_status for r in rows}

    def _cycle(self, n: int = 1, *, minutes: float = 2) -> None:
        for _ in range(n):
            self.clock.now += minutes * 60
            self.wall += timedelta(minutes=minutes)
            self.sender.run_cycle()

    # ---------- معايير القبول ----------
    def test_50_sales_offline_then_all_sent_once_in_order(self):
        uuids = [self._receipt()[1] for _ in range(50)]
        self.server.online = False
        self._cycle(6)  # ساعات بلا شبكة: محاولات بتأجيل متزايد ولا شيء يضيع أو يُعلَّم خطأً
        self.assertEqual(set(self._status().values()), {"not_sent"})
        self.assertEqual(self.server.submit_calls, 0)
        self.server.online = True  # رجعت الشبكة
        self._cycle(3, minutes=5)  # يستأنف تلقائياً (أقصى تأجيل 5 دقائق)
        self.assertEqual(self.server.received, uuids)  # كلها، بالترتيب الصحيح
        self.assertEqual(len(set(self.server.received)), 50)  # مرة واحدة لكل إيصال
        self.assertEqual(self.server.submit_calls, 1)  # دفعة واحدة (≤ 500)
        self.assertEqual(set(self._status().values()), {"accepted"})

    def test_app_closed_mid_batch_then_restarted(self):
        first = [self._receipt()[1] for _ in range(10)]
        self.server.crash_after_receive = True  # الدفعة وصلت المنظومة، والبرنامج أُغلق قبل الرد
        with self.assertRaises(SimulatedCrash):
            self._cycle()
        self.assertEqual(set(self._status().values()), {"pending"})  # «في الطريق» محفوظ في القاعدة
        later = [self._receipt()[1] for _ in range(5)]  # بيعات بعد إعادة التشغيل
        self.sender = self._new_sender()  # إعادة التشغيل: لا ذاكرة إلا القاعدة
        self._cycle(3)
        self.assertEqual(self.server.received, first + later)  # لا تكرار ولا ضياع، وبالترتيب
        self.assertEqual(self.server.submit_calls, 2)  # الأولى لم تُعد إرسالها
        self.assertEqual(set(self._status().values()), {"accepted"})

    # ---------- «أُرسل ولم يصل الرد» ----------
    def test_timeout_after_server_received_is_not_resent(self):
        uuids = [self._receipt()[1] for _ in range(3)]
        self.server.timeout_after_receive = True
        self._cycle(4)
        self.assertEqual(self.server.received, uuids)
        self.assertEqual(self.server.submit_calls, 1)
        self.assertEqual(set(self._status().values()), {"accepted"})

    def test_lost_request_is_resent_once_after_grace(self):
        uuids = [self._receipt()[1] for _ in range(3)]
        self.server.lose_next_submit = True  # مهلة، والدفعة لم تصل
        self._cycle(3)  # خلال مهلة الأمان: لا إعادة (قد تكون وصلت ولم تُعالج بعد)
        self.assertEqual(self.server.submit_calls, 1)
        self._cycle(10, minutes=2)  # بعد 15 دقيقة: لم تجدها المنظومة ← تُعاد مرة واحدة
        self.assertEqual(self.server.received, uuids)
        self.assertEqual(self.server.submit_calls, 2)
        self.assertEqual(set(self._status().values()), {"accepted"})

    def test_no_new_sends_while_previous_batch_unresolved(self):
        first = [self._receipt()[1] for _ in range(2)]
        self.server.lose_next_submit = True
        self._cycle()
        later = self._receipt()[1]
        self._cycle(2)  # الأولى «في الطريق»: الجديد ينتظر حفاظاً على ترتيب السلسلة
        self.assertNotIn(later, self.server.received)
        self._cycle(10)
        self.assertEqual(self.server.received, [*first, later])

    # ---------- المرتجع ----------
    def test_return_waits_for_original_acceptance_and_blocks_chain(self):
        sale_id, s1 = self._receipt()
        _, r1 = self._receipt(kind="return", reference=s1, sale_id=sale_id)
        _, s2 = self._receipt()
        self._cycle()  # يُرسل البيع فقط؛ المرتجع ينتظر قبوله، وما بعده ينتظر المرتجع
        self.assertEqual(self.server.received, [s1])
        self._cycle(2)  # قُبل الأصل ← المرتجع ثم ما بعده
        self.assertEqual(self.server.received, [s1, r1, s2])
        self.assertEqual(set(self._status().values()), {"accepted"})

    def test_rejected_original_holds_chain_until_manager_releases(self):
        from app.core.security import Actor, Role
        from app.modules.e_receipt.sender import release_return
        from app.modules.sales.model import SaleReturn

        sale_id, s1 = self._receipt()
        self.server.invalid.add(s1)
        ret_id, r1 = self._receipt(kind="return", reference=s1, sale_id=sale_id)
        _, s2 = self._receipt()
        self._cycle(4)
        self.assertEqual(self._status()[s1], "rejected")
        self.assertEqual(self.server.received, [s1])  # السلسلة موقوفة بتنبيه
        self.assertEqual(self.sender.devices[DEVICE].held_return_id, ret_id)
        with database.get_write_sessionmaker()() as s:
            release_return(s, Actor(user_id="mgr", role=Role.MANAGER, device_id=DEVICE), s.get(SaleReturn, ret_id))
        self._cycle(2)
        self.assertEqual(self.server.received, [s1, r1, s2])
        self.assertIsNone(self.sender.devices[DEVICE].held_by)

    # ---------- مهلة الـ 24 ساعة ----------
    def test_late_and_overdue_warnings(self):
        from app.modules.e_receipt.sender import queue_counts

        self._receipt(created=self.wall - timedelta(hours=2))
        self._receipt(created=self.wall - timedelta(hours=19))  # قارب المهلة
        self._receipt(created=self.wall - timedelta(hours=25))  # تجاوزها
        with database.get_sessionmaker()() as s:
            counts = queue_counts(s, self.wall)
        self.assertEqual((counts["waiting"], counts["late"], counts["overdue"]), (3, 2, 1))

    # ---------- realtime ----------
    def test_realtime_event_only_when_queue_counts_change(self):
        published = []
        with mock.patch("app.modules.e_receipt.sender.hub.publish", side_effect=lambda t: published.append(t)):
            self._receipt()
            self.server.online = False
            self._cycle()  # أول قراءة للأعداد
            self._cycle()  # لا تغيير ← لا حدث
            self.assertEqual(published, [{"e_receipt"}])
            self.server.online = True
            self._cycle(2, minutes=5)  # أُرسل ثم قُبل ← تغيّرت الأعداد
            self.assertGreaterEqual(len(published), 2)
            self.assertTrue(all(p == {"e_receipt"} for p in published))

    def test_status_updates_do_not_broadcast_sales_topic(self):
        """تحديث حالة الإيصال لا يجعل كل أجهزة الكاشير تعيد جلب المبيعات."""
        from app.core import realtime

        self._receipt()
        published = []
        realtime.install()
        with mock.patch.object(realtime.hub, "publish", side_effect=lambda t: published.append(set(t))):
            self._cycle(2)
        self.assertFalse(any("sales" in p for p in published))


if __name__ == "__main__":
    unittest.main()

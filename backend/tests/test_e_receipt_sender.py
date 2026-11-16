"""اختبارات الاتصال بالمنظومة (المرحلة 4) بـ mock للـ HTTP بلا شبكة:
نجاح، رفض جزئي في الدفعة، انتهاء التوكن أثناء الإرسال، انقطاع الشبكة، 429، وأكثر.

قاعدة بيانات مؤقتة خاصة بالاختبار (لا تلمس قاعدة البرنامج الحقيقية أبداً).
التشغيل من مجلد backend:  .venv/Scripts/python -m unittest discover -s tests -t . -v
"""

import json
import logging
import os
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.core import database  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.modules.e_receipt.client import (  # noqa: E402
    DeviceCredentials,
    EtaAuthError,
    EtaClient,
    EtaNetworkError,
    EtaRateLimited,
    EtaRequestError,
    HttpResponse,
)
from app.modules.eta.constants import EtaEnvironment  # noqa: E402

SECRET, PSK, TOKEN = "Client-Secret-XYZ-123", "PSK-Value-987", "eyJ.token.value"
DEVICE = "dev-test"
CREDS = DeviceCredentials(DEVICE, EtaEnvironment.PREPROD, "client-1", SECRET, "SN-1", "Windows 11", "1", PSK)


def resp(status: int, body=None, **headers) -> HttpResponse:  # noqa: ANN001
    raw = json.dumps(body).encode() if body is not None else b""
    return HttpResponse(status, {k.lower().replace("_", "-"): str(v) for k, v in headers.items()}, raw)


def token_ok(expires_in: int = 3600) -> HttpResponse:
    return resp(200, {"access_token": TOKEN, "token_type": "Bearer", "expires_in": expires_in, "scope": "InvoicingAPI"})


class FakeEta:
    """mock للـ HTTP: قائمة ردود لكل نوع طلب بالترتيب، ويسجّل كل طلب للتحقق."""

    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.queues: dict[str, list] = {"token": [], "submit": [], "submission": [], "receipt": []}

    def on(self, kind: str, *responses) -> "FakeEta":  # noqa: ANN002
        self.queues[kind].extend(responses)
        return self

    def __call__(self, method, url, headers, body, env):  # noqa: ANN001
        kind = ("token" if url.endswith("/connect/token") else "submission" if "/receiptsubmissions/" in url
                else "submit" if url.endswith("/receiptsubmissions") else "receipt")  # fmt: skip
        self.calls.append({"kind": kind, "method": method, "url": url, "headers": headers, "body": body})
        item = self.queues[kind].pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    def count(self, kind: str) -> int:
        return sum(1 for c in self.calls if c["kind"] == kind)


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


# ================= العميل (بلا قاعدة بيانات) =================
class ClientTests(unittest.TestCase):
    def setUp(self):
        self.fake = FakeEta()
        self.clock = Clock()
        self.client = EtaClient(transport=self.fake, clock=self.clock)

    def test_auth_request_shape_per_sdk(self):
        self.fake.on("token", token_ok())
        info = self.client.authenticate(CREDS)
        call = self.fake.calls[0]
        self.assertEqual(call["url"], "https://id.preprod.eta.gov.eg/connect/token")
        self.assertEqual(parse_qs(call["body"].decode()),
                         {"grant_type": ["client_credentials"], "client_id": ["client-1"], "client_secret": [SECRET]})  # fmt: skip
        h = call["headers"]
        self.assertEqual((h["posserial"], h["pososversion"], h["posmodelframework"], h["presharedkey"]),
                         ("SN-1", "Windows 11", "1", PSK))  # fmt: skip
        self.assertEqual(info.expires_in, 3600)

    def test_token_is_cached_until_near_expiry(self):
        self.fake.on("token", token_ok(), token_ok())
        self.fake.on("submit", *[resp(202, {"submissionUUID": "S", "acceptedDocuments": [], "rejectedDocuments": []})] * 3)
        self.client.submit(CREDS, ["{}"])
        self.clock.now += 3000  # ما زال صالحاً
        self.client.submit(CREDS, ["{}"])
        self.assertEqual(self.fake.count("token"), 1)
        self.clock.now += 560  # أقل من دقيقة على الانتهاء ← تجديد تلقائي
        self.client.submit(CREDS, ["{}"])
        self.assertEqual(self.fake.count("token"), 2)
        self.assertEqual(self.fake.calls[1]["headers"]["Authorization"], f"Bearer {TOKEN}")

    def test_body_is_stored_documents_verbatim_with_empty_signatures(self):
        self.fake.on("token", token_ok()).on("submit", resp(202, {"submissionUUID": "S"}))
        doc = '{"header":{"uuid":"abc","x":94.50}}'
        self.client.submit(CREDS, [doc, doc])
        body = self.fake.calls[1]["body"].decode()
        self.assertEqual(body, '{"receipts":[' + doc + "," + doc + '],"signatures":[]}')

    def test_partial_rejection_parsed(self):
        self.fake.on("token", token_ok()).on("submit", resp(202, {
            "submissionUUID": "SUB1",
            "acceptedDocuments": [{"uuid": "u1", "longId": "L1", "receiptNumber": "1"}],
            "rejectedDocuments": [{"uuid": "u2", "receiptNumber": "2", "error": {
                "message": "Validation Error", "details": [{"message": "Invalid itemCode", "target": "itemCode"}]}}],
        }))  # fmt: skip
        result = self.client.submit(CREDS, ["{}", "{}"])
        self.assertEqual(result.accepted, {"u1": "L1"})
        self.assertEqual(result.rejected[0].message, "Validation Error | Invalid itemCode")

    def test_expired_token_mid_send_reauthenticates_once(self):
        self.fake.on("token", token_ok(), token_ok())
        self.fake.on("submit", resp(401, {"error": {"code": "Unauthorized"}}), resp(202, {"submissionUUID": "S2"}))
        self.assertEqual(self.client.submit(CREDS, ["{}"]).submission_uuid, "S2")
        self.assertEqual(self.fake.count("token"), 2)

    def test_error_classification(self):
        cases = [
            (resp(429, {"error": "Too many requests"}, Retry_After=7), EtaRateLimited),
            (resp(503, {"error": "Too many requests"}), EtaRateLimited),
            (resp(500, {"error": {"code": "InternalServerError"}}), EtaNetworkError),
            (resp(400, {"error": {"code": "BadStructure", "message": "bad"}}), EtaRequestError),
            (resp(403, {"error": {"code": "IncorrectSubmitter"}}), EtaAuthError),
            (resp(422, {"error": {"code": "DuplicateSubmission"}}, Retry_After=60), EtaRateLimited),
        ]
        for response, expected in cases:
            self.fake.on("token", token_ok()).on("submit", response)
            client = EtaClient(transport=self.fake, clock=self.clock)
            with self.assertRaises(expected):
                client.submit(CREDS, ["{}"])
        with self.assertRaises(EtaRateLimited) as ctx:
            self.fake.on("token", token_ok()).on("submit", resp(429, {}, Retry_After=7))
            EtaClient(transport=self.fake, clock=self.clock).submit(CREDS, ["{}"])
        self.assertGreater(ctx.exception.retry_after, 7)  # «larger then the value returned»

    def test_auth_failure_is_auth_error(self):
        self.fake.on("token", resp(400, {"error": "invalid_posserial"}))
        with self.assertRaises(EtaAuthError) as ctx:
            self.client.authenticate(CREDS)
        self.assertIn("invalid_posserial", ctx.exception.message)

    def test_secrets_never_in_repr_or_logs(self):
        self.assertNotIn(SECRET, repr(CREDS))
        self.fake.on("token", token_ok()).on("submit", resp(202, {"submissionUUID": "S"}))
        with self.assertLogs("app.modules.e_receipt", level="DEBUG") as logs:
            logging.getLogger("app.modules.e_receipt").debug("probe")
            self.client.submit(CREDS, ['{"secret-doc":1}'])
        text = "\n".join(logs.output)
        for secret in (SECRET, PSK, TOKEN, "secret-doc"):
            self.assertNotIn(secret, text)


# ================= المُرسِل على قاعدة مؤقتة =================
class EtaDbCase(unittest.TestCase):
    """قاعدة SQLCipher مؤقتة خاصة بالاختبار + منظومة مفعّلة + بيانات جهاز مشفّرة."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="dealzora-eta-test-")
        settings = get_settings()
        cls._saved = (settings.db_path, settings.plan, settings.device_id)
        settings.db_path = str(Path(cls.tmp) / "test.db")
        settings.plan = "enterprise"
        settings.device_id = DEVICE
        assert cls.tmp in settings.db_path  # لا نلمس قاعدة البرنامج أبداً
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            f.cache_clear()
        from app.core.init_db import init_db
        from app.core.secret_box import _key, seal_secret
        from app.modules.devices.model import DeviceEtaProfile
        from app.modules.settings.constants import SettingKey
        from app.modules.settings.model import AppSetting

        _key.cache_clear()
        init_db()
        with database.get_write_sessionmaker()() as s:
            s.add(AppSetting(key=SettingKey.ETA_CONFIG.value, device_id=DEVICE,
                             value=json.dumps({"enabled": True, "environment": "preprod"})))  # fmt: skip
            s.add(DeviceEtaProfile(
                pos_device_id=DEVICE, device_id=DEVICE, pos_serial="SN-1", pos_os_version="Windows 11",
                pos_model_framework="1", client_id="client-1",
                client_secret_enc=seal_secret(SECRET, f"device_eta_profiles:{DEVICE}:client_secret"),
                preshared_key_enc=seal_secret(PSK, f"device_eta_profiles:{DEVICE}:preshared_key"),
            ))  # fmt: skip
            s.commit()

    @classmethod
    def tearDownClass(cls):
        for f in (database.get_engine, database.get_sessionmaker, database.get_write_sessionmaker):
            if f.cache_info().currsize:
                database.get_engine().dispose()
            f.cache_clear()
        settings = get_settings()
        settings.db_path, settings.plan, settings.device_id = cls._saved
        shutil.rmtree(cls.tmp, ignore_errors=True)


class SenderTests(EtaDbCase):
    def setUp(self):
        from app.modules.e_receipt.sender import Sender

        self.fake = FakeEta()
        self.clock = Clock()
        self.sender = Sender(EtaClient(transport=self.fake, clock=self.clock), sleep=self.clock.sleep, clock=self.clock)
        with database.get_write_sessionmaker()() as s:
            from app.modules.sales.model import Sale

            s.query(Sale).delete()
            s.commit()
        self.next = 0

    def _sales(self, n: int) -> list[str]:
        from app.modules.sales.model import Sale

        uuids = []
        with database.get_write_sessionmaker()() as s:
            for _ in range(n):
                self.next += 1
                uuid = f"{self.next:064x}"
                s.add(Sale(
                    device_id=DEVICE, number=self.next, client_ref=f"ref-{self.next}-{self.id()[-20:]}",
                    sold_on=date(2026, 11, 15), payment_method="cash", subtotal=100, total=100,
                    eta_status="not_sent", eta_uuid=uuid, eta_seq=self.next, eta_device_id=DEVICE,
                    eta_document=json.dumps({"header": {"uuid": uuid}}),
                ))  # fmt: skip
                uuids.append(uuid)
            s.commit()
        return uuids

    def _status(self) -> dict[str, tuple[str, str | None]]:
        from app.modules.sales.model import Sale

        with database.get_sessionmaker()() as s:
            return {r.eta_uuid: (r.eta_status, r.eta_error) for r in s.query(Sale).all()}

    def _attempts(self) -> list[tuple[str, str]]:
        from app.modules.e_receipt.model import EReceiptAttempt

        with database.get_sessionmaker()() as s:
            return [(a.operation, a.outcome) for a in s.query(EReceiptAttempt).order_by(EReceiptAttempt.created_at).all()]

    def test_success_then_poll_valid(self):
        u = self._sales(2)
        self.fake.on("token", token_ok()).on("submit", resp(202, {
            "submissionUUID": "SUB-OK", "acceptedDocuments": [{"uuid": u[0], "longId": "L0"}, {"uuid": u[1], "longId": "L1"}],
            "rejectedDocuments": []}))  # fmt: skip
        summary = self.sender.run_cycle()
        self.assertEqual(summary.submitted, 2)
        self.assertEqual({v[0] for v in self._status().values()}, {"pending"})
        self.fake.on("submission", resp(200, {"status": "Valid", "metadata": {"totalPages": 1},
                                              "receipts": [{"uuid": x, "status": "Valid"} for x in u]}))  # fmt: skip
        self.sender.run_cycle()
        self.assertEqual({v[0] for v in self._status().values()}, {"accepted"})
        self.assertIn(("submit", "ok"), self._attempts())
        self.assertIn(("poll", "ok"), self._attempts())

    def test_partial_rejection_in_batch(self):
        u = self._sales(3)
        self.fake.on("token", token_ok()).on("submit", resp(202, {
            "submissionUUID": "SUB-P", "acceptedDocuments": [{"uuid": u[0]}, {"uuid": u[2]}],
            "rejectedDocuments": [{"uuid": u[1], "receiptNumber": "2", "error": {"message": "Invalid unitType"}}]}))  # fmt: skip
        self.sender.run_cycle()
        st = self._status()
        self.assertEqual(st[u[1]], ("rejected", "Invalid unitType"))
        self.assertEqual((st[u[0]][0], st[u[2]][0]), ("pending", "pending"))
        self.assertIn(("submit", "partial"), self._attempts())
        # الرفض لا يُعاد تلقائياً: الدورة التالية لا ترسله
        self.fake.on("submission", resp(200, {"status": "InProgress", "receipts": []}))
        self.sender.run_cycle()
        self.assertEqual(self.fake.count("submit"), 1)

    def test_token_expires_during_sending(self):
        u = self._sales(1)
        self.fake.on("token", token_ok(), token_ok())
        self.fake.on("submit", resp(401, {"error": {"code": "Unauthorized"}}),
                     resp(202, {"submissionUUID": "S", "acceptedDocuments": [{"uuid": u[0]}]}))  # fmt: skip
        self.sender.run_cycle()
        self.assertEqual(self._status()[u[0]][0], "pending")
        self.assertEqual(self.fake.count("token"), 2)

    def test_network_down_keeps_receipts_and_backs_off(self):
        u = self._sales(2)
        self.fake.on("token", EtaNetworkError("connection refused"))
        summary = self.sender.run_cycle()
        self.assertEqual({v[0] for v in self._status().values()}, {"not_sent"})
        self.assertIn(("submit", "network"), self._attempts())
        self.assertTrue(summary.errors)
        self.sender.run_cycle()  # خلال فترة التأجيل: لا محاولة
        self.assertEqual(self.fake.count("token"), 1)
        self.clock.now += 31  # بعد التأجيل: يُعاد تلقائياً
        self.fake.on("token", token_ok()).on("submit", resp(202, {"submissionUUID": "S", "acceptedDocuments": [{"uuid": x} for x in u]}))
        self.sender.run_cycle()
        self.assertEqual({v[0] for v in self._status().values()}, {"pending"})

    def test_rate_limited_429_waits_more_than_retry_after(self):
        self._sales(1)
        self.fake.on("token", token_ok()).on("submit", resp(429, {"error": "Too many requests"}, Retry_After=20))
        self.sender.run_cycle()
        self.assertIn(("submit", "rate_limited"), self._attempts())
        self.clock.now += 20  # = Retry-After بالضبط: ما زال ممنوعاً
        self.sender.run_cycle()
        self.assertEqual(self.fake.count("submit"), 1)
        self.clock.now += 2
        self.fake.on("submit", resp(202, {"submissionUUID": "S", "acceptedDocuments": []}))
        self.sender.run_cycle()
        self.assertEqual(self.fake.count("submit"), 2)

    def test_auth_failure_stops_device_until_forced(self):
        self._sales(1)
        self.fake.on("token", resp(400, {"error": "invalid_presharedkey"}))
        self.sender.run_cycle()
        self.assertIn(("submit", "auth_failed"), self._attempts())
        self.assertIn("invalid_presharedkey", self.sender.devices[DEVICE].auth_error)
        self.clock.now += 10_000
        self.sender.run_cycle()  # موقوف حتى لو مر الوقت
        self.assertEqual(self.fake.count("token"), 1)
        self.fake.on("token", token_ok()).on("submit", resp(202, {"submissionUUID": "S"}))
        self.sender.run_cycle(force=True)  # «إرسال الآن» يعيد المحاولة صراحة
        self.assertEqual(self.fake.count("token"), 2)

    def test_bad_structure_marks_rejected_without_retry(self):
        u = self._sales(1)
        self.fake.on("token", token_ok()).on("submit", resp(400, {"error": {"code": "BadStructure", "message": "bad json"}}))
        self.sender.run_cycle()
        self.assertEqual(self._status()[u[0]][0], "rejected")
        self.assertIn("bad json", self._status()[u[0]][1])

    def test_duplicate_submission_then_poll_by_receipt(self):
        u = self._sales(1)
        self.fake.on("token", token_ok()).on("submit", resp(422, {"error": {"code": "DuplicateSubmission"}}, Retry_After=60))
        self.sender.run_cycle()
        self.assertEqual(self._status()[u[0]][0], "pending")
        self.fake.on("receipt", resp(200, {"receipt": {"status": "Invalid", "statusReason": "previousUUID mismatch"}}))
        self.sender.run_cycle()
        self.assertEqual(self._status()[u[0]], ("rejected", "previousUUID mismatch"))

    def test_poll_invalid_with_arabic_reason(self):
        u = self._sales(1)
        self.fake.on("token", token_ok()).on("submit", resp(202, {"submissionUUID": "S", "acceptedDocuments": [{"uuid": u[0]}]}))
        self.sender.run_cycle()
        self.fake.on("submission", resp(200, {"status": "Invalid", "receipts": [{"uuid": u[0], "status": "Invalid", "errors": [
            {"stepId": "1", "error": {"errorAr": "كود الصنف غير صحيح", "propertyPath": "itemData[0].itemCode"}}]}]}))  # fmt: skip
        self.sender.run_cycle()
        self.assertEqual(self._status()[u[0]], ("rejected", "كود الصنف غير صحيح (itemData[0].itemCode)"))

    def test_batches_respect_count_and_size(self):
        from app.modules.e_receipt.sender import MAX_BATCH_BYTES, Pending, batches
        from app.modules.sales.model import Sale

        small = [Pending(Sale, str(i), str(i), "x" * 10, i) for i in range(1201)]
        self.assertEqual([len(b) for b in batches(small)], [500, 500, 201])
        big = [Pending(Sale, str(i), str(i), "x" * 400_000, i) for i in range(5)]
        sizes = [sum(len(p.document) + 1 for p in b) for b in batches(big)]
        self.assertTrue(all(s < MAX_BATCH_BYTES for s in sizes))
        self.assertEqual(sum(len(b) for b in batches(big)), 5)

    def test_secrets_and_documents_not_in_attempts_or_audit(self):
        self._sales(1)
        self.fake.on("token", resp(400, {"error": "invalid_client"}))
        self.sender.run_cycle()
        from sqlalchemy import text

        with database.get_sessionmaker()() as s:
            dump = " ".join(str(r) for r in s.execute(text("select * from e_receipt_attempts")).all())
            dump += " ".join(str(r) for r in s.execute(text("select * from audit_log")).all())
        for secret in (SECRET, PSK, TOKEN, '"header"'):
            self.assertNotIn(secret, dump)

    def test_feature_disabled_sends_nothing(self):
        self._sales(1)
        get_settings().plan = "basic"  # الإيصال الإلكتروني من «سوق»
        try:
            self.sender.run_cycle()
        finally:
            get_settings().plan = "enterprise"
        self.assertEqual(self.fake.calls, [])


if __name__ == "__main__":
    unittest.main()

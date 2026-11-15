"""موافقات تطبيق الهاتف: الفرع ينفّذها بنفس approve (المسار الكامل لخصم المخزون والتكلفة مختبر في البرنامج نفسه).
هنا: الاستلام قبل التنفيذ، التنفيذ باسم «النظام» مع اسم صاحب الموافقة، إبلاغ الفشل، والسيرفر الأقدم.

التشغيل من مجلد backend:  .venv/Scripts/python -m unittest tests.test_phone_commands -v
"""

import unittest
from unittest import mock

from app.core.errors import ConflictError
from app.modules.branch_sync.client import RemoteError, SyncUnavailable
from app.modules.branch_sync.service import BranchSyncService

CMD = {
    "id": "cmd-1", "transfer_id": "tr-1", "action": "approve", "note": "الزيت خلصان",
    "lines": [{"line_id": "l-milk", "qty": 20_000}, {"line_id": "l-oil", "qty": 0}],
    "requested_by": "owner", "device_name": "Samsung A54", "created_at": "2026-11-15T10:00:00Z",
}  # fmt: skip


class FakeClient:
    """سيرفر وهمي: يسجّل الطلبات، ويرد حسب الجدول (استثناء = يُرمى)."""

    def __init__(self, replies: dict) -> None:
        self.replies = replies
        self.calls: list[tuple] = []

    def call(self, method: str, path: str, body=None, **_):  # noqa: ANN001, ANN201
        self.calls.append((method, path, body))
        reply = self.replies.get((method, path))
        if isinstance(reply, Exception):
            raise reply
        return reply


def service() -> BranchSyncService:
    user = mock.Mock(user_id="cashier-1")
    return BranchSyncService(mock.MagicMock(), user)


class PhoneCommandsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.approve = mock.patch.object(BranchSyncService, "approve", autospec=True).start()
        self.addCleanup(mock.patch.stopall)

    def test_executes_through_same_approve_as_system(self):
        client = FakeClient({("GET", "/transfers/commands"): [CMD], ("POST", "/transfers/commands/cmd-1/claim"): CMD})
        self.assertEqual(service().run_phone_commands(client), 1)

        # الاستلام قبل التنفيذ
        self.assertEqual([c[1] for c in client.calls], ["/transfers/commands", "/transfers/commands/cmd-1/claim"])
        (svc, transfer_id, data), kw = self.approve.call_args
        self.assertEqual(svc.actor.user_id, "system")  # لا باسم الكاشير الجالس على الجهاز
        self.assertEqual(transfer_id, "tr-1")
        self.assertEqual([(l.line_id, l.qty) for l in data.lines], [("l-milk", 20_000), ("l-oil", 0)])
        self.assertEqual(data.note, "الزيت خلصان")
        self.assertEqual(kw["sent_by"], "owner (من الهاتف)")
        self.assertEqual(kw["via"], {"from_phone": True, "by": "owner", "device": "Samsung A54", "command_id": "cmd-1"})

    def test_claim_conflict_is_skipped(self):
        taken = RemoteError(409, "command_not_pending", "الأمر لم يعد في الانتظار")
        client = FakeClient({("GET", "/transfers/commands"): [CMD], ("POST", "/transfers/commands/cmd-1/claim"): taken})
        self.assertEqual(service().run_phone_commands(client), 0)
        self.approve.assert_not_called()

    def test_failure_is_reported_to_phone(self):
        self.approve.side_effect = ConflictError("insufficient_stock", "الكمية المتاحة من «لبن» أقل من المطلوب")
        client = FakeClient({("GET", "/transfers/commands"): [CMD], ("POST", "/transfers/commands/cmd-1/claim"): CMD,
                             ("POST", "/transfers/commands/cmd-1/fail"): {"status": "failed"}})  # fmt: skip
        svc = service()
        self.assertEqual(svc.run_phone_commands(client), 0)
        method, path, body = client.calls[-1]
        self.assertEqual((method, path), ("POST", "/transfers/commands/cmd-1/fail"))
        self.assertEqual(body, {"code": "insufficient_stock", "message": "الكمية المتاحة من «لبن» أقل من المطلوب"})
        svc.session.rollback.assert_called()

    def test_network_loss_is_not_reported_as_failure(self):
        self.approve.side_effect = SyncUnavailable("timeout")
        client = FakeClient({("GET", "/transfers/commands"): [CMD], ("POST", "/transfers/commands/cmd-1/claim"): CMD})
        with self.assertRaises(SyncUnavailable):
            service().run_phone_commands(client)
        self.assertNotIn("/transfers/commands/cmd-1/fail", [c[1] for c in client.calls])

    def test_old_server_without_commands(self):
        client = FakeClient({("GET", "/transfers/commands"): RemoteError(404, "http_404", "Not Found")})
        self.assertEqual(service().run_phone_commands(client), 0)
        self.approve.assert_not_called()


if __name__ == "__main__":
    unittest.main()

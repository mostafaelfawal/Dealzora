"""QR الإيصال المطبوع (المرحلة 6) مقابل المثال الرسمي في الـ SDK (receiptissuancefaq، Receipt QR Code)."""

import json
import os
import unittest
from decimal import Decimal

os.environ.setdefault("POS_DB_PASSWORD", "unit-test-password")
os.environ.setdefault("POS_SESSION_TOKEN", "t")
os.environ.setdefault("POS_WRITE_PERMIT_SECRET", "t")
os.environ.setdefault("POS_DEVICE_ID", "dev-test")

from app.modules.e_receipt.qr import print_data, qr_content, qr_modules  # noqa: E402
from app.modules.eta.constants import EtaEnvironment  # noqa: E402

OFFICIAL = (
    "http://invoicing.eta.gov.eg/receipts/search/68e656b251e67e8358bef8483ab0d51c6619f3e7a1a9f0e75838d41ff368f320"
    "/share/2022-02-19T02:00Z#Total:1000.000,IssuerRIN:674859545"
)
UUID = "68e656b251e67e8358bef8483ab0d51c6619f3e7a1a9f0e75838d41ff368f320"


class QrTests(unittest.TestCase):
    def test_matches_official_example_except_https(self):
        """نفس المثال الرسمي حرفياً، والفرق الوحيد https (قرار: من جدول البيئات بدل http في المثال)."""
        content = qr_content(EtaEnvironment.PROD, UUID, "2022-02-19T02:00:00Z", Decimal("1000"), "674859545")
        self.assertEqual(content, OFFICIAL.replace("http://", "https://", 1))

    def test_preprod_portal_and_rounding(self):
        content = qr_content(EtaEnvironment.PREPROD, UUID, "2026-11-15T10:42:59Z", Decimal("113.5"), "123456789")
        self.assertTrue(content.startswith("https://preprod.invoicing.eta.gov.eg/receipts/search/"))
        self.assertIn("/share/2026-11-15T10:42Z#Total:113.500,IssuerRIN:123456789", content)

    def test_print_data_from_stored_document(self):
        doc = {"header": {"dateTimeIssued": "2026-11-15T10:42:00Z", "receiptNumber": "R-7", "uuid": UUID,
                          "previousUUID": "", "referenceUUID": "b" * 64},
               "seller": {"rin": "123456789", "companyTradeName": "شركة", "branchCode": "0",
                          "deviceSerialNumber": "SN-1"},
               "totalAmount": 25}  # fmt: skip
        data = print_data(json.dumps(doc), EtaEnvironment.PROD)
        self.assertEqual((data.receipt_number, data.reference_uuid), ("R-7", "b" * 64))
        self.assertEqual(data.qr_url, data.qr_content.split("#")[0])
        self.assertTrue(data.qr_content.endswith("#Total:25.000,IssuerRIN:123456789"))
        self.assertEqual(len(data.qr_modules), len(data.qr_modules[0]))  # مصفوفة مربعة
        self.assertEqual(set("".join(data.qr_modules)), {"0", "1"})

    def test_matrix_is_deterministic(self):
        self.assertEqual(qr_modules(OFFICIAL), qr_modules(OFFICIAL))


if __name__ == "__main__":
    unittest.main()

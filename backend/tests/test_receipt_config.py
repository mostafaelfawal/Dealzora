"""شكل الفاتورة المطبوعة: التحقق من المدخلات والافتراضي = الإيصال القديم."""

import unittest

from pydantic import ValidationError

from app.modules.settings.receipt import DEFAULT_FOOTER, ReceiptConfig

PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="


class ReceiptConfigTest(unittest.TestCase):
    def test_default_matches_old_receipt(self):
        cfg = ReceiptConfig()
        self.assertEqual(cfg.footer, DEFAULT_FOOTER)
        self.assertIsNone(cfg.logo)
        self.assertTrue(cfg.show_cashier and cfg.show_customer and cfg.show_payment_details)

    def test_accepts_png_logo_and_normalizes(self):
        cfg = ReceiptConfig(logo=PNG, accent="#AABBCC", address="  القاهرة  ")
        self.assertEqual(cfg.logo, PNG)
        self.assertEqual(cfg.accent, "#aabbcc")
        self.assertEqual(cfg.address, "القاهرة")

    def test_empty_logo_is_none(self):
        self.assertIsNone(ReceiptConfig(logo="").logo)

    def test_rejects_non_image_logo(self):
        for bad in ("https://evil.example/x.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:text/html;base64,AAAA"):
            with self.assertRaises(ValidationError):
                ReceiptConfig(logo=bad)

    def test_rejects_bad_color_and_unknown_fields(self):
        with self.assertRaises(ValidationError):
            ReceiptConfig(accent="red")
        with self.assertRaises(ValidationError):
            ReceiptConfig.model_validate({"unknown": 1})

    def test_roundtrip_json(self):
        cfg = ReceiptConfig(logo=PNG, terms="الاستبدال خلال 14 يوم", font_size="large")
        self.assertEqual(ReceiptConfig.model_validate_json(cfg.model_dump_json()), cfg)


if __name__ == "__main__":
    unittest.main()

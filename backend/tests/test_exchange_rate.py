"""العملة الثانية: جلب السعر من الإنترنت (بدون شبكة حقيقية) والتحقق من الإعداد."""

import io
import json
import unittest
from urllib.error import URLError

from pydantic import ValidationError

from app.modules.settings.exchange import (
    ExchangeConfig,
    RateFetchError,
    fetch_rate,
    is_stale,
)


def _opener(payload=None, error=None):
    def opener(req, timeout):
        if error:
            raise error
        return io.BytesIO(json.dumps(payload).encode())

    return opener


class FetchRateTest(unittest.TestCase):
    def test_reads_rate_for_pair(self):
        rate = fetch_rate(
            "USD", "LBP",
            opener=_opener({"result": "success", "time_last_update_unix": 1700000000, "rates": {"LBP": 89500}}),
        )  # fmt: skip
        self.assertEqual(rate.second_per_main, 89500)
        self.assertEqual(rate.rate_updated_at, 1700000000)
        self.assertFalse(is_stale(rate))

    def test_offline_gives_arabic_message(self):
        with self.assertRaises(RateFetchError) as ctx:
            fetch_rate("USD", "LBP", opener=_opener(error=URLError("down")))
        self.assertIn("الإنترنت", str(ctx.exception))

    def test_unknown_currency(self):
        with self.assertRaises(RateFetchError):
            fetch_rate("USD", "XXX", opener=_opener({"result": "success", "rates": {"EGP": 50}}))
        with self.assertRaises(RateFetchError):
            fetch_rate("ZZZ", "USD", opener=_opener({"result": "error", "error-type": "unsupported-code"}))


class ExchangeConfigTest(unittest.TestCase):
    def test_default_disabled(self):
        self.assertFalse(ExchangeConfig().enabled)

    def test_manual_needs_rate_and_direction(self):
        with self.assertRaises(ValidationError):
            ExchangeConfig(enabled=True, mode="manual")
        # 1 دولار = 50 جنيه، والمحل بالجنيه: 1 جنيه = 0.02 دولار.
        cfg = ExchangeConfig(enabled=True, mode="manual", manual_rate=50, manual_base="second")
        self.assertAlmostEqual(cfg.manual_second_per_main(), 0.02)
        cfg = ExchangeConfig(enabled=True, mode="manual", manual_rate=89500, manual_base="main")
        self.assertEqual(cfg.manual_second_per_main(), 89500)

    def test_code_normalized(self):
        self.assertEqual(ExchangeConfig(code="lbp").code, "LBP")
        with self.assertRaises(ValidationError):
            ExchangeConfig(code="L1P")


if __name__ == "__main__":
    unittest.main()

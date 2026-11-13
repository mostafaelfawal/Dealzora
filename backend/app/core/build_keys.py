"""مفاتيح عامة مثبّتة داخل البرنامج (ليست سرية: تتحقق فقط ولا توقّع).

لا تُقرأ من متغيرات البيئة في النسخة المبنية، فلا يقدر أحد يستبدلها على جهاز التاجر.
تغييرها: هنا مباشرة، أو متغير البيئة DEALZORA_SYNC_LEASE_PUBKEY وقت build-backend.ps1.
"""

# المفتاح العام لشهادات الفروع (base64url)، المقابل لـ SYNC_LEASE_KEY في سيرفر الفروع.
# من: python -m app.cli lease-keygen
SYNC_LEASE_PUBKEY = "8Fm--u7WVqhsGVNTsYHf199hfCY11ls_Us1z1lV0QBk"

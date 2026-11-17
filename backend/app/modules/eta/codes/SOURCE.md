# جداول أكواد منظومة الإيصال الإلكتروني

بيانات ثابتة من الـ SDK الرسمي لمصلحة الضرائب المصرية. لا تُعدَّل يدوياً: عند تحديث الـ SDK
نزّل الملف من نفس الرابط واستبدله، وحدّث التاريخ والبصمة هنا.

تاريخ الجلب: 2026-11-15 (صفحات الـ SDK مؤرخة last update 08-12-2022).

| الملف                   | المصدر                                                                                  | طريقة الجلب                                                                                                     | sha256                                                           |
| ----------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| UnitTypes.json          | https://sdk.invoicing.eta.gov.eg/files/UnitTypes.json (صفحة /codes/unit-types/)         | تنزيل مباشر بلا تعديل                                                                                           | 21faf7927ea77204529e437ff242134bc464ca23ae94fc0514fedbaeec90c772 |
| TaxTypes.json           | https://sdk.invoicing.eta.gov.eg/files/TaxTypes.json (صفحة /codes/tax-types/)           | تنزيل مباشر بلا تعديل                                                                                           | 093d14ee6e9c4ee6a49dc78cc96ff0171fefe0d6bacc226e616315bf2a943039 |
| NonTaxableTaxTypes.json | https://sdk.invoicing.eta.gov.eg/files/NonTaxableTaxTypes.json (صفحة /codes/tax-types/) | تنزيل مباشر بلا تعديل                                                                                           | db496b210700d50c5ac2816402d202959984d118330fe1c4c6cfdf003c70efc3 |
| TaxSubtypes.json        | https://sdk.invoicing.eta.gov.eg/files/TaxSubtypes.json (صفحة /codes/tax-types/)        | تنزيل مباشر بلا تعديل                                                                                           | 0264aa9c733f6e971a6b1cc81a212a7295b4b0cdc5ce632e8704fab350e579d6 |
| ActivityCodes.json      | https://sdk.invoicing.eta.gov.eg/files/ActivityCodes.json (صفحة /codes/activity-types/) | تنزيل مباشر بلا تعديل                                                                                           | 660dcc09b0f5017c51552be4074f9cea535589e31406385d709ee58bf3ca8f09 |
| PaymentMethods.json     | https://sdk.invoicing.eta.gov.eg/codes/payment-methods/                                 | منقول من جدول الصفحة (لا يوجد ملف للتنزيل، والصفحة بلا وصف عربي)                                                | cfd0db8b960740e23aab5c58db70125ec48cb9c04ba856d4f927354c5e6d8555 |
| BuyerTypes.json         | https://sdk.invoicing.eta.gov.eg/documents/retail-receipt-v1-2/ (حقل buyer.type)        | منقول من نص الصفحة: «B for business in Egypt, P for natural person, F for foreigner» (لا يوجد جدول أكواد مستقل) | 0b0b1077d55e1c953d914fc41af110ed8498e757f1c7cde62cdd752bf566b068 |

ملاحظات من المصدر نفسه:

- UnitTypes.json: الكود ST مكرر في المصدر ("Ton (short,2000 lb)" و"Sheet"). نحتفظ بالملف كما هو، والتحميل يأخذ أول ظهور.
- مثال unitType في صفحة الإيصال هو "kg" بينما الجدول فيه KGM للكيلوجرام. نعتمد الجدول.
- الحقول بأسماء مختلفة الحالة بين الملفات (code/Code، desc_en/Desc_en) كما نزلت من المصدر.

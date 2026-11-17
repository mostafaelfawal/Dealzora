# عيّنات رسمية من الـ SDK (للاختبار فقط، بلا تعديل)

تاريخ الجلب: 2026-11-15.

| الملف                       | المصدر                                                             | sha256                                                           |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| one-doc.json                | https://sdk.invoicing.eta.gov.eg/files/one-doc.json                | 586615e7f278791e774e946c0b20b19c4eba13098527eea9234c298adfed087e |
| one-doc-serialized.json.txt | https://sdk.invoicing.eta.gov.eg/files/one-doc-serialized.json.txt | d43fae25b02b7e466fa5aa39e5fa45c7d92661e5b0a0e7964e04783bff3c2651 |
| BatchReceipt.json           | https://sdk.invoicing.eta.gov.eg/files/BatchReceipt.json           | d531e7392a7c0b0877d40a7cf9b7c92365fa45957fdd893a5ffe69b045cdd6f5 |

- one-doc.json و one-doc-serialized.json.txt: المثال الرسمي لخوارزمية التسلسل (صفحة /document-serialization-approach/). مستند فاتورة إلكترونية لكن الخوارزمية نفسها للإيصال (FAQ: How to generate receipt UUID، الخطوة 4).
- BatchReceipt.json: عيّنة دفعة إيصالات (صفحة /receiptissuancefaq/). الـ uuid فيها لا يمكن إعادة إنتاجه بأي تفسير للخطوات (جرّبنا 131 تفسيراً)، والعيّنة نفسها تخالف القواعد (previousUUID = "0"، typeVersion 1.0 المتقاعد، paymentMethod "Cash" ليس كوداً، feesAmount/adjustment غير صفرية). اختبارها expectedFailure يوثّق ذلك وينبّه لو تغيّر.

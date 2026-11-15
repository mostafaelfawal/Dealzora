# شهادة البيئة التجريبية للمنظومة

- الملف: `preprod-root-ca.crt` (DER) كما نزل بلا تعديل من
  https://sdk.invoicing.eta.gov.eg/files/preprod-root-ca.crt (صفحة /faq/: «Test environment of the solution
  (PreProd environments) depends on internally issued certificates»). تاريخ الجلب: 2026-11-15.
- الموضوع: `C=EG, O=ETA, CN=EEI-RootCA-PREPROD`، صالحة حتى 2032-07-19.
- بصمة الملف sha256 مثبتة في `e_receipt/environments.py` ويُرفض الملف لو تغيّر.
- تُستخدم فقط للاتصال بعناوين البيئة التجريبية، ولا تُثبَّت في Windows. الـ SDK: «do not install this certificate
  in your production environment».

"""ترجمة أخطاء المنظومة الشائعة لرسالة عربية مفهومة + «ماذا أفعل».

ما في الـ SDK فقط (لا أكواد مخترعة):
  - أكواد المصادقة (ereceiptapi/01-authenticate-pos): unauthorized_client, invalid_posserial,
    invalid_pososversion, invalid_posmodelframework, invalid_presharedkey, unsupported_grant_type, invalid_scope.
  - أكواد الإرسال (02-submit-receipt / standard-error-response): BadStructure, MaximumSizeExceeded,
    IncorrectSubmitter, DuplicateSubmission, TooManyRequests, Unauthorized, ServiceUnavailable.
  - أخطاء التحقق: الـ SDK لا ينشر جدول أكوادها (مثاله الوحيد CV307)، لكنها تأتي بنص عربي (errorAr) ومسار الحقل
    (propertyPath)، فنستنتج «ماذا أفعل» من الحقل نفسه. رسالة المنظومة الأصلية تبقى معروضة كما هي.
  - رسائل التحقق المحلي (validator.py) عربية أصلاً، و«ماذا أفعل» حسب موضوعها.
"""

from dataclasses import dataclass

DEVICES = "الإعدادات ← الإيصال الإلكتروني ← الأجهزة"
SHOP = "الإعدادات ← الإيصال الإلكتروني ← بيانات المحل"
BRANCH = "الإعدادات ← الإيصال الإلكتروني ← الفرع"
UNITS = "الإعدادات ← الإيصال الإلكتروني ← وحدات القياس"
FIX_AND_RESEND = "بعد التصحيح اضغط «تصحيح وإعادة إرسال»"


@dataclass(frozen=True, slots=True)
class Explanation:
    title: str  # ما المشكلة (بالعربي)
    action: str  # ماذا أفعل


# (كلمة في نص الخطأ، الشرح). الترتيب مهم: الأدق أولاً.
_RULES: tuple[tuple[tuple[str, ...], Explanation], ...] = (
    # ---- المصادقة ----
    (("invalid_posserial",), Explanation("المنظومة لا تعرف الرقم التسلسلي لهذا الجهاز",
        f"اكتب الرقم التسلسلي كما سُجّل على بوابة المنظومة ({DEVICES})، ثم «اختبار الاتصال»")),
    (("invalid_pososversion",), Explanation("إصدار نظام التشغيل المسجّل للجهاز لا يطابق",
        f"صحّح «إصدار نظام التشغيل» كما في تسجيل الجهاز على البوابة ({DEVICES})")),
    (("invalid_posmodelframework",), Explanation("قيمة Model Framework للجهاز لا تطابق تسجيله",
        f"صحّح Model Framework كما في تسجيل الجهاز ({DEVICES})")),
    (("invalid_presharedkey",), Explanation("المفتاح المشترك (Pre-shared key) خاطئ",
        f"أعد كتابة المفتاح المشترك من بوابة المنظومة ({DEVICES})")),
    (("unauthorized_client", "invalid_client"), Explanation("Client ID أو Client Secret غير صحيح أو أُلغي",
        f"انسخ بيانات الدخول من بوابة المنظومة وأعد كتابتها ({DEVICES})، ثم «اختبار الاتصال»")),
    (("unsupported_grant_type", "invalid_scope"), Explanation("طلب المصادقة رُفض لسبب تقني",
        "تواصل مع دعم Dealzora مع رقم المحاولة (correlationId)")),
    (("incorrectsubmitter",), Explanation("المنظومة لا تسمح لهذا الحساب/الجهاز بإرسال الإيصالات",
        "تأكد من تفعيل علامة B2C للممول وربط الجهاز برقم التسجيل على بوابة المنظومة")),
    (("unauthorized", "http 401"), Explanation("انتهت صلاحية الدخول للمنظومة",
        "سيُجدَّد الدخول تلقائياً. لو تكرر، اضغط «اختبار الاتصال» وراجع بيانات الجهاز")),
    # ---- الإرسال ----
    (("badstructure",), Explanation("شكل الدفعة لم يُقبل عند المنظومة",
        "غالباً بيانات ناقصة في الإيصال. راجع البيانات، ولو تكرر تواصل مع الدعم")),
    (("maximumsizeexceeded",), Explanation("الدفعة أكبر من الحد المسموح",
        "يُعاد تقسيمها تلقائياً. لو تكرر تواصل مع الدعم")),
    (("duplicatesubmission", "duplicate"), Explanation("الإيصال وصل المنظومة من قبل",
        "لا شيء: تتم متابعة نتيجته تلقائياً")),
    (("too many requests", "toomanyrequests", "http 429"), Explanation("طلبات كثيرة على المنظومة في وقت قصير",
        "لا شيء: يُعاد الإرسال تلقائياً بعد المهلة")),
    (("serviceunavailable", "http 503", "network", "timed out", "unreachable", "connection"), Explanation("المنظومة غير متاحة أو لا يوجد إنترنت",
        "تأكد من الإنترنت. الإيصالات محفوظة وتُرسل تلقائياً عند رجوع الاتصال")),
    # ---- حقول الإيصال (propertyPath من المنظومة أو رسائلنا المحلية) ----
    (("previousuuid", "سلسلة إيصالات"), Explanation("ترتيب سلسلة إيصالات الجهاز لا يطابق ما لدى المنظومة",
        "راجع تنبيه السلسلة في إعدادات الإيصال الإلكتروني، ولا تحذف أو تستعيد نسخاً احتياطية دون متابعته")),
    (("referenceuuid", "الأصلية"), Explanation("مرجع فاتورة البيع الأصلية في المرتجع غير مقبول",
        f"تأكد أن فاتورة البيع الأصلية مقبولة أولاً. {FIX_AND_RESEND}")),
    (("subtype", "taxtype", "taxableitems", "الضريبة"), Explanation("بيانات ضريبة صنف غير مقبولة",
        f"راجع نوع الضريبة ونسبتها في شاشة الصنف، وإعداد ضريبة القيمة المضافة. {FIX_AND_RESEND}")),
    (("itemcode", "itemtype", "كود الصنف", "نوع كود"), Explanation("كود الصنف في المنظومة (EGS/GS1) خاطئ أو غير مسجّل",
        f"صحّح كود الصنف من شاشة الصنف كما هو مسجّل على البوابة. {FIX_AND_RESEND}")),
    (("unittype", "وحدة القياس"), Explanation("كود وحدة القياس غير مقبول",
        f"اختر كود الوحدة الصحيح ({UNITS}). {FIX_AND_RESEND}")),
    (("buyer", "الرقم القومي", "المشتري"), Explanation("بيانات المشتري غير كافية",
        "الإيصال بقيمة 150,000 جنيه فأكثر يحتاج اسم المشتري ورقمه القومي. تواصل مع الدعم لإكمال بيانات العميل")),
    (("activitycode", "كود النشاط"), Explanation("كود النشاط غير صحيح لهذا الفرع",
        f"اختر كود النشاط المسجّل للفرع ({SHOP})")),
    (("branchcode", "branchaddress", "كود الفرع", "عنوان الفرع"), Explanation("بيانات الفرع غير مطابقة لتسجيله",
        f"صحّح كود الفرع وعنوانه كما في ملف الممول على البوابة ({BRANCH})")),
    (("seller.rin", "issuerrin", "التسجيل الضريبي", "(rin)"), Explanation("رقم التسجيل الضريبي غير صحيح", f"راجع رقم التسجيل الضريبي ({SHOP})")),
    (("deviceserialnumber", "الرقم التسلسلي"), Explanation("الرقم التسلسلي للجهاز غير مسجّل",
        f"راجع الرقم التسلسلي ({DEVICES})")),
    (("datetimeissued", "تاريخ الإيصال", "المستقبل"), Explanation("تاريخ الإيصال غير مقبول",
        "تأكد أن ساعة الجهاز وتاريخه صحيحان، ثم أعد الإرسال")),
    (("totalamount", "netamount", "totalsales", "netsale", "totalsale", "لا يطابق", "≠"),
     Explanation("فرق في حسابات الإيصال", "تواصل مع دعم Dealzora مع رقم الفاتورة")),
    (("540",), Explanation("مر أكثر من 540 يوماً على الفاتورة الأصلية",
        "المنظومة لا تقبل إيصال مرتجع بعد هذه المدة. المرتجع نفسه تم في المحل")),
    (("cancelled", "أُلغي"), Explanation("أُلغي الإيصال في المنظومة", "راجع بوابة المنظومة لمعرفة سبب الإلغاء")),
    (("غير مكتوب", "ناقص", "is required", "required"), Explanation("بيانات مطلوبة ناقصة",
        f"أكمل البيانات المذكورة من إعدادات الإيصال الإلكتروني أو شاشة الصنف. {FIX_AND_RESEND}")),
)

DEFAULT = Explanation("رفضت المنظومة الإيصال", f"اقرأ رسالة المنظومة أدناه وصحّح السبب. {FIX_AND_RESEND}")


def explain(error: str | None) -> Explanation | None:
    """شرح أول قاعدة تنطبق على نص الخطأ (رسالة المنظومة الأصلية تُعرض معه كما هي)."""
    if not error:
        return None
    text = error.lower()
    for keys, explanation in _RULES:
        if any(k.lower() in text for k in keys):
            return explanation
    return DEFAULT

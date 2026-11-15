# سياسة الخصوصية — تطبيق Dealzora سلسلة

آخر تحديث: 16 نوفمبر 2026

تطبيق «Dealzora سلسلة» مخصص لمالك المحل ومديري الفروع المشتركين في خطة «سلسلة» من برنامج Dealzora، لمتابعة
فروع محلهم. لا يستخدمه عامة الناس، ولا يحتوي إعلانات، ولا يبيع أو يشارك بياناتك مع أي طرف لأغراض تسويقية.

## البيانات التي يجمعها التطبيق
| البيان | لماذا | أين يُحفظ |
|---|---|---|
| اسم المستخدم وكلمة المرور (نفس حساب البرنامج) | تسجيل الدخول. كلمة المرور لا تُحفظ على الهاتف أبداً | خادم المزامنة الخاص بمحلك (تجزئة فقط) |
| اسم الهاتف ونوع نظامه ومعرّف عشوائي للتطبيق | عرض «الأجهزة المسجّلة» وتسجيل الخروج منها | خادم المزامنة |
| رمز الإشعارات (Expo push token) | إرسال تنبيهات الفروع لهاتفك | خادم المزامنة، ويُحذف عند الخروج |
| فرق توقيت الهاتف | ساعات الهدوء وتحديد «أمس» بتوقيتك | خادم المزامنة |
| عنوان IP ووقت الدخول والإجراءات (الموافقات، الإيقاف…) | سجل أمني لحماية المحل | خادم المزامنة |

**بيانات المحل** (المبيعات المجمّعة، الفروع، التحويلات، النواقص، الورديات، أسماء الموظفين وأسماء الأصناف) تُعرض
من خادم المزامنة، وتُحفظ منها نسخة مؤقتة على الهاتف لعرضها بلا إنترنت، وتُمسح عند تسجيل الخروج. لا يجمع التطبيق
بيانات عملاء المحل الشخصية ولا موقعك ولا جهات اتصالك ولا صورك.

## البصمة والوجه
يستخدم التطبيق بصمة الإصبع أو الوجه من نظام الهاتف نفسه لقفل التطبيق. لا يصل التطبيق لصورة البصمة أو الوجه
ولا يحفظها؛ يحصل فقط على نتيجة «نجح/لم ينجح» من الهاتف.

## الأطراف الأخرى
- **خادم المزامنة**: يديره صاحب البرنامج لمحلك، وهو مصدر كل البيانات.
- **خدمة Expo للإشعارات وFirebase Cloud Messaging (Google)**: لتوصيل الإشعارات فقط. محتوى الإشعار لا يحوي
  مبالغ أو تفاصيل مالية (نوع الحدث واسم الفرع فقط).

## الأمان
الاتصال مشفّر (HTTPS). رموز الدخول محفوظة في التخزين الآمن للهاتف (Keychain / Keystore)، والجلسة تنتهي
تلقائياً بعد 30 يوماً بلا استخدام، ويمكنك أو لمالك المحل إلغاء أي جلسة فوراً (مثلاً لو ضاع الهاتف).

## الحذف
تسجيل الخروج يمسح بيانات المحل من الهاتف. لحذف حسابك أو سجلاتك من الخادم تواصل مع مالك المحل أو مع الدعم:
**[ضع بريد الدعم هنا]**.

## التواصل
**[اسم الشركة / المطوّر] — [البريد الإلكتروني] — [العنوان]**

---

# Privacy Policy — Dealzora Chain

Last updated: November 16, 2026

Dealzora Chain is for shop owners and branch managers on the Dealzora "Chain" (enterprise) plan, to monitor their
branches. It has no ads and does not sell or share data for marketing.

**Collected:** username (password is never stored on the phone; the server keeps only a hash), device name/platform and a
random app id (to list and revoke devices), the Expo push token (deleted on sign-out), the phone's UTC offset (quiet
hours), and IP/time of sign-ins and actions (security audit log). Shop data (aggregated sales, branches, transfers,
shortages, shifts, staff and product names) is shown from your shop's sync server and cached on the phone for offline
viewing; it is erased on sign-out. No end-customer personal data, location, contacts or photos are collected.

**Biometrics:** handled by the operating system; the app only receives success/failure.

**Third parties:** your shop's sync server; Expo Push and Firebase Cloud Messaging (Google) to deliver notifications,
whose text contains no amounts or financial details.

**Security:** HTTPS; tokens in Keychain/Keystore; sessions expire after 30 days of inactivity and can be revoked at
any time. **Deletion:** signing out erases shop data from the phone; contact the shop owner or **[support email]** to
delete server-side records.

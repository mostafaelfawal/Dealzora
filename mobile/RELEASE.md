# نشر تطبيق Dealzora سلسلة على Google Play

## قبل أول بناء (مرة واحدة)

1. **حساب Expo** ثم في مجلد `mobile`:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init            # يربط المشروع ويضيف extra.eas.projectId إلى app.json
   ```
2. **عنوان خادم المزامنة الافتراضي** للنسخة المنشورة (يقدر المستخدم يغيّره من شاشة الدخول):
   ```bash
   npx eas-cli@latest env:create --name EXPO_PUBLIC_SYNC_URL --value https://sync.YOUR-DOMAIN --environment production --visibility plaintext
   ```
   (HTTPS إجباري في النسخة المنشورة: أندرويد يمنع http.)
3. **الإشعارات (Firebase)**: كما في قسم «الإشعارات» في `README.md` — `google-services.json` في `mobile/` و
   `"googleServicesFile": "./google-services.json"` داخل `android` في `app.json`، ورفع مفتاح FCM V1 إلى EAS
   (هذه المرة لملف `production`).
4. **الخادم**: شغّل خدمة `notifier` (موجودة في `docker-compose.yml`) وحدّث الخادم (migrations حتى `0010`).

## ما تم تجهيزه في المشروع

| البند                  | الحالة                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| الاسم                  | «Dealzora سلسلة»، الحزمة `com.dealzora.chain`                                                                                                                    |
| الأيقونة وشاشة البداية | شعار Dealzora (`assets/brand/logo.png`)، خلفية بيضاء                                                                                                             |
| الأذونات (أندرويد)     | الإنترنت، البصمة (USE_BIOMETRIC/USE_FINGERPRINT)، الإشعارات (POST_NOTIFICATIONS)، الاهتزاز فقط. محظور صراحةً: الكاميرا، الميكروفون، التخزين، الظهور فوق التطبيقات |
| النسخ الاحتياطي        | معطّل (`allowBackup: false`): بيانات المحل المؤقتة لا تُنسخ خارج الهاتف                                                                                            |
| الإصدار                | `version` في `app.json`، ورقم البناء (versionCode) يزيد تلقائياً من EAS (`autoIncrement`)                                                                         |
| سياسة الخصوصية         | `PRIVACY.md` (عربي + إنجليزي) — املأ بيانات التواصل واستضفها كصفحة عامة                                                                                          |

## البناء

```bash
npx eas-cli@latest build --profile production --platform android     # ينتج AAB للمتجر
```

للتجربة قبل المتجر: `--profile preview` ينتج APK تثبّته مباشرة على الهواتف.

## الرفع على Google Play

1. **Google Play Console** (رسوم تسجيل لمرة واحدة) ← Create app ← الاسم «Dealzora سلسلة»، تطبيق، مجاني.
2. **App content** (إجباري):
   - **Privacy policy**: رابط صفحة `PRIVACY.md` المستضافة.
   - **App access**: التطبيق يحتاج حساباً. أعطِ المراجعين محلاً تجريبياً على خطة «سلسلة» + اسم مستخدم وكلمة
     مرور + طريقة الحصول على كود ربط (انظر «أسئلة مفتوحة»).
   - **Ads**: لا يحتوي إعلانات.
   - **Content rating**: استبيان «Utility/Business»، بلا محتوى حساس.
   - **Target audience**: 18+.
   - **Data safety** (من سياسة الخصوصية):
     | نوع البيانات                                        | يُجمع | يُشارك | الغرض                                  | إلزامي |
     | --------------------------------------------------- | ---- | ----- | -------------------------------------- | ------ |
     | Personal info → User IDs (اسم المستخدم)             | نعم  | لا    | App functionality, Account management  | نعم    |
     | Device or other IDs (معرّف التطبيق، push token)      | نعم  | لا    | App functionality (الإشعارات، الأجهزة) | نعم    |
     | App activity → Other actions (سجل الإجراءات)        | نعم  | لا    | Security, fraud prevention             | نعم    |
     | Financial info → Other (أرقام مبيعات المحل المجمّعة) | نعم  | لا    | App functionality                      | نعم    |
     - البيانات مشفّرة أثناء النقل: نعم. يمكن طلب حذفها: نعم (عبر المالك/الدعم).
3. **Store listing**: وصف قصير وطويل بالعربية، أيقونة 512×512 (`assets/brand/logo.png`)، صورة غلاف 1024×500،
   ولقطتا شاشة على الأقل من الهاتف (الرئيسية، الفروع، التحويلات، التنبيهات).
4. **Testing → Internal testing** أولاً: ارفع الـ AAB وأضف بريدك وبريد مدير تجريبي، وجرّب الدخول والإشعارات
   والموافقة على تحويل على هاتف حقيقي. ثم Closed/Production.
   أو من الطرفية: `npx eas-cli@latest submit --platform android` (يحتاج مفتاح Google Service Account لرفع الإصدارات).

## التحديثات اللاحقة

- تغيير في الكود فقط (JS): بناء جديد ورفعه (أو `eas update` لو فعّلت التحديث عبر الهواء لاحقاً).
- أي تغيير في `app.json` أو الأذونات أو مكتبة native: بناء جديد إجباري.

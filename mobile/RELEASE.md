# نشر تطبيق Dealzora سلسلة

## بدون متاجر (الوضع الحالي): APK للأندرويد + نسخة ويب للآيفون

الملفان يُستضافان على أي سحابة، والمستخدم يثبّت من الرابط مباشرة.

### أندرويد: ملف APK

```bash
npm run build:apk        # = eas build --platform android --profile apk
```

- يستخدم متغيرات بيئة EAS «production» (مثل `EXPO_PUBLIC_SYNC_URL`، انظر الخطوة 2 بالأسفل).
- عند الانتهاء يعطيك EAS رابط تحميل الـ APK: نزّله وارفعه على السحابة.
- التثبيت على الهاتف: فتح الرابط ← تنزيل ← السماح بـ«تثبيت التطبيقات من مصادر غير معروفة» للمتصفح مرة واحدة.
- التحديث: بناء جديد بنفس الحزمة `com.dealzora.chain` يُثبَّت فوق القديم وتبقى البيانات (نفس مفتاح التوقيع من EAS).
- الإشعارات تحتاج Firebase كما في قسم «الإشعارات» في `README.md` (بدونه تعمل والتطبيق مفتوح فقط).

### الآيفون: نسخة ويب (PWA)

```bash
EXPO_PUBLIC_SYNC_URL=https://sync.YOUR-DOMAIN npm run build:web     # الناتج في مجلد dist/
```

> اكتب `EXPO_PUBLIC_SYNC_URL` في الأمر نفسه: ملف `.env.local` (عنوان التطوير) له أولوية على `.env.production`.
> وفي كل الأحوال يقدر المستخدم يغيّر عنوان الخادم من شاشة الدخول.

1. **ارفع محتوى `dist/` كما هو** على استضافة ملفات ثابتة **بـ HTTPS** (إجباري: Safari لا يثبّت التطبيق ولا يتصل
   بخادم http من صفحة https). مثل Cloudflare Pages أو Netlify أو Firebase Hosting أو أي CDN.
2. **كل المسارات ← `index.html`** (تطبيق صفحة واحدة: رابط مثل `/recap/day/...` أو تحديث الصفحة):
   - Netlify / Cloudflare Pages: تلقائي من `dist/_redirects` (موجود).
   - Vercel: `vercel.json` بجانب `dist`: `{"rewrites": [{"source": "/(.*)", "destination": "/"}]}`.
   - Firebase Hosting: أجب «Yes» على «single-page app» في `firebase init`.
   - nginx: `try_files $uri /index.html;`
3. **خادم المزامنة يسمح بنطاق نسخة الويب** (وإلا يرفض المتصفح الاتصال): في `.env` السيرفر
   `SYNC_CORS_ORIGINS=https://app.YOUR-DOMAIN` ثم أعد تشغيله.
4. **التثبيت على الآيفون**: افتح الرابط في **Safari** ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية». يفتح بعدها
   كتطبيق بأيقونة Dealzora وبلا شريط المتصفح.

**فروق نسخة الويب عن تطبيق أندرويد:**

| الميزة                   | الويب (آيفون)                                                                  |
| ------------------------ | ------------------------------------------------------------------------------ |
| القفل                    | بالرمز السري فقط (لا بصمة/وجه في المتصفح). فعّله من «المزيد» ← «القفل برمز سري» |
| الإشعارات على شاشة القفل | غير متاحة (تظهر التنبيهات داخل التطبيق فقط وشارة العدد)                        |
| تخزين الجلسة             | `localStorage` لنطاق التطبيق بدل Keychain. مسح بيانات الموقع = خروج كامل       |
| التحديث                  | تلقائي: ارفع `dist/` الجديد، ويصل عند فتح التطبيق التالي                       |

---

# النشر على Google Play (لاحقاً)

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

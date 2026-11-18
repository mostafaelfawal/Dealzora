# Dealzora Sync Hub — سيرفر المزامنة بين الفروع

كل فرع يبيع على قاعدته المحلية **حتى بدون إنترنت**، ويرفع أحداثه (`outbox`) هنا ويسحب أحداث باقي الفروع.
السيرفر **لا يبيع ولا يحسب مخزوناً**: ينقل الأحداث بترتيب مضمون وبلا تكرار، ويملك حالة **تحويلات المخزون**،
ويجمع **الملخصات اليومية** لتقارير المالك.

```
 فرع المعادي (backend)  ──push/pull──►  Sync Hub (FastAPI + PostgreSQL)  ◄──push/pull──  فرع مدينة نصر
                        ◄──SSE "changed"──                    ──SSE "changed"──►
```

**المكونات (Docker Compose):** `api` (FastAPI) · `db` (PostgreSQL 16) · `caddy` (HTTPS تلقائي) · `backup` (نسخة يومية).

---

## 1) الرفع على سيرفر (VPS)

**المطلوب:** سيرفر Linux (Ubuntu 22.04/24.04)، 1–2 GB رام تكفي للبداية، ودومين (أو subdomain) مثل `sync.yourdomain.com`.

```bash
# 1. ثبّت Docker (مرة واحدة)
curl -fsSL https://get.docker.com | sh

# 2. الجدار الناري: SSH + HTTP + HTTPS فقط
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable

# 3. ارفع مجلد sync-server للسيرفر (git clone أو scp) وادخله
cd sync-server

# 4. الإعدادات
cp .env.example .env
openssl rand -hex 24   # → POSTGRES_PASSWORD
openssl rand -hex 32   # → SYNC_JWT_SECRET
openssl rand -hex 32   # → SYNC_ADMIN_TOKEN
nano .env              # املأ الدومين والإيميل والأسرار

# 5. التشغيل
docker compose up -d --build
docker compose ps                         # كل الخدمات running/healthy
curl https://sync.yourdomain.com/health   # {"status":"ok"}
```

> **قبل الخطوة 5:** سجل DNS من نوع `A` للدومين يشاور على IP السيرفر، وإلا Caddy مش هيقدر يطلّع شهادة HTTPS.
> الـ migrations بتتطبق تلقائياً مع كل تشغيل (`alembic upgrade head`).

---

## 1-ب) تشغيل مجاني مؤقت (قبل شراء VPS)

نفس الخدمات بالظبط على أي جهاز شغال على طول (Windows + Docker Desktop، أو Ubuntu)، والوصول من الإنترنت
عن طريق **Cloudflare Tunnel** المجاني بدل Caddy: لا IP ثابت ولا فتح بورتات في الراوتر. لما تشتري VPS تنقل
البيانات وتغيّر سجل DNS، **والفروع والهاتف مش هيحسّوا بحاجة** (نفس الدومين، نفس الأسرار).

**التكلفة الوحيدة: دومين ملكك.** لازم يكون عندك من الأول: عنوان السيرفر بيتحفظ في كل فرع وفي تطبيق الهاتف
ويتبني جوه البرنامج (`NEXT_PUBLIC_SYNC_URL`)، فلو بدأت برابط مؤقت مجاني هتضطر تغيّره في كل مكان وقت النقل.

### الإعداد (مرة واحدة)

1. اشترِ دومين، وأضفه لحساب Cloudflare مجاني (Add a domain ← خطة Free)، وغيّر الـ nameservers عند شركة الدومين
   للي Cloudflare بيديهولك.
2. في لوحة Cloudflare: **Zero Trust ← Networks ← Tunnels ← Create a tunnel** (نوع Cloudflared) ← انسخ الـ **token**.
3. في نفس النفق ← **Public hostname**: الـ subdomain `sync` + دومينك ← Service: `HTTP` و `api:8000`.
4. الإعدادات: `.env` **كامل زي ما هيبقى على الـ VPS** (`SYNC_DOMAIN` = `sync.yourdomain.com`، و `ACME_EMAIL`،
   و `POSTGRES_PASSWORD`، وكل الأسرار)، وزوّد عليه:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=<التوكن من الخطوة 2>
   ```
5. التشغيل (كل حاجة ما عدا caddy):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.tunnel.yml up -d --build db api notifier backup cloudflared
   curl https://sync.yourdomain.com/health   # {"status":"ok"}
   ```

**الجهاز:** لازم يفضل شغال: اقفل السكون (Sleep) من إعدادات الطاقة، وفعّل «Start Docker Desktop when you sign in».
لو اتقفل، الفروع بتكمل بيع عادي والمزامنة بتكمّل لما يرجع (نفس سلوك انقطاع النت).
**انسخ مجلد `backups/` لمكان تاني بانتظام** (Google Drive مثلاً): الجهاز المنزلي أضعف من سيرفر.

### النقل للـ VPS (لما تشتري)

```bash
# 1) على الجهاز القديم: وقّف الاستقبال، وخد نسخة نهائية
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml stop api notifier
docker compose exec -T db pg_dump -Fc -U dealzora dealzora_sync > final.dump

# 2) على الـ VPS (بعد خطوات 1 و 2 من قسم «الرفع على سيرفر»): انسخ نفس .env بالظبط و final.dump، ثم
docker compose up -d db
docker compose exec -T db pg_restore --clean --if-exists -U dealzora -d dealzora_sync < final.dump
```

3. في Cloudflare: احذف الـ Public hostname من النفق، وفي **DNS** اعمل سجل `A` لـ `sync` على IP الـ VPS
   **بالسحابة الرمادية (DNS only)** عشان Caddy يطلّع شهادة HTTPS بنفسه.
4. على الـ VPS: `docker compose up -d --build` ← `curl https://sync.yourdomain.com/health`.
5. على الجهاز القديم: `docker compose -f docker-compose.yml -f docker-compose.tunnel.yml down` (من غير `-v`
   لحد ما تتأكد إن كل حاجة شغالة على الـ VPS).

> **لازم نفس `.env`:** `SYNC_JWT_SECRET` و `SYNC_LEASE_KEY` وباقي الأسرار لو اتغيرت، كل الفروع والهواتف
> هتحتاج ربط من جديد.

---

## 2) إضافة محل وفروعه

### الطريقة الأساسية: المالك يعمل كل حاجة بنفسه (بدون تدخلك)

1. ضع `SYNC_VENDOR_PUBKEY` في `.env` = نفس المفتاح العام `DEALZORA_VENDOR_PUBKEY` اللي بتبني بيه البرنامج.
2. ابنِ الواجهة ومعها `NEXT_PUBLIC_SYNC_URL=https://sync.example.com` (عنوان السيرفر)، فالمالك لا يكتبه.
3. المالك (خطة «سلسلة») على جهازه الرئيسي: الإعدادات ← الأجهزة والحماية ← الفروع ← «محل جديد (أنا المالك)»
   ← يلصق مفتاح الترخيص ← يتسجّل المحل، والجهاز يصبح **الفرع الرئيسي**.
4. من نفس المكان: «إضافة فرع» ← يظهر كود ربط ← يكتبه على جهاز الفرع («فرع تابع»).
   ويقدر يطلع كود جديد، يوقف فرعاً، أو يلغي ربط جهاز ضاع — كله من البرنامج.

- السيرفر يتحقق من توقيع الترخيص بالمفتاح العام فقط: لا أحد يقدر يعمل محلاً بدون ترخيص صادر منك.
- محل واحد لكل ترخيص. نفس الترخيص على جهاز رئيسي جديد = «استرجاع المحل» (القديم يتوقف فوراً).
- بعد انتهاء الترخيص بمهلة `SYNC_LICENSE_GRACE_DAYS` تتوقف مزامنة المحل، وتعود فور التجديد
  (تفعيل المفتاح الجديد على جهاز المالك يجدده على السيرفر تلقائياً).

### الفروع الجديدة: ترث خطة المحل (بدون مفتاح لكل جهاز)

- **مرة واحدة عندك:** `python -m app.cli lease-keygen` ← ضع `SYNC_LEASE_KEY=…` في `.env` السيرفر (سري)،
  وابنِ البرنامج ومعه متغير البيئة `DEALZORA_SYNC_LEASE_PUBKEY=…` (سكربت `build-backend.ps1` يثبّته داخل النسخة).
  للتطوير: `POS_SYNC_LEASE_PUBKEY=…` في `.env` الـ backend. وعمر الشهادة `SYNC_LEASE_TTL_DAYS` (افتراضي 7).
- **جهاز الفرع الجديد:** شاشة «لنجهز محلك» ← «فرع جديد لمحل موجود؟» ← كود الربط من المالك.
  الجهاز يرث خطة المحل (شهادة موقّعة من السيرفر، تتجدد مع كل مزامنة)، ويصله حساب المالك والأصناف والعملاء.
- **بعدها:** المالك يدخل بحسابه المعتاد على جهاز الفرع، وينشئ مدير الفرع والكاشيرية من «المستخدمون».
- سيرفر مزيّف لا يقدر يفتح خطة لنفسه (التوقيع بمفتاحك فقط)، وفصل الفرع يرجّع خطته الأصلية فوراً.

### الطريقة اليدوية (للطوارئ أو المحلات القديمة)

```bash
docker compose exec api python -m app.cli create-shop "سوبر ماركت النور"
# shop_id: 8a1b6280-…

docker compose exec api python -m app.cli create-branch <shop_id> "فرع المعادي" MA
# branch_id: 59c6e859-…

# الأسهل للمالك: كود ربط قصير بدل نسخ السر الطويل
docker compose exec api python -m app.cli pair-code <branch_id>
# كود الربط: K7QM-4XWT-9HNA   (صالح 15 دقيقة، مرة واحدة)
# المالك يكتبه في برنامج الفرع ← الجهاز يأخذ بيانات دخوله تلقائياً (POST /v1/auth/pair)

docker compose exec api python -m app.cli list                       # المحلات والفروع وآخر ظهور
docker compose exec api python -m app.cli rotate-secret <branch_id>  # جهاز ضاع؟ سر جديد والقديم وتوكناته يتوقفوا فوراً
docker compose exec api python -m app.cli disable-branch <branch_id> # إيقاف فرع (اشتراك انتهى…)
docker compose exec api python -m app.cli make-admin <branch_id>     # محل قديم أنشأته يدوياً: اجعل فرعاً هو الرئيسي
```

نفس الأوامر متاحة كـ API تحت `/v1/admin/*` بـ `Authorization: Bearer <SYNC_ADMIN_TOKEN>` (للوحة إدارة لاحقاً).

---

## 3) التحديث، النسخ الاحتياطي، والمراقبة

```bash
# تحديث لنسخة جديدة من الكود
git pull && docker compose up -d --build

# اللوجات
docker compose logs -f api

# النسخ الاحتياطية: ./backups/dealzora-sync-YYYYMMDD-HHMMSS.dump (يومياً، تُحذف بعد BACKUP_KEEP_DAYS)
# انسخها خارج السيرفر بانتظام (rclone / scp) — السيرفر نفسه ممكن يضيع.

# الاسترجاع من نسخة
docker compose stop api
docker compose exec -T db pg_restore --clean --if-exists -U dealzora -d dealzora_sync < backups/<file>.dump
docker compose start api
```

**المراقبة:** راقب `https://sync.yourdomain.com/health` من خدمة مثل UptimeRobot (مجانية) لتنبيهك لو وقع.

---

## 4) عقد الـ API (اللي هيستخدمه الـ backend المحلي)

كل المسارات تحت `/v1`. الأخطاء دائماً: `{"error": {"code", "message", "details"}}`.
المال **بالقروش** والكميات **× 1000** (نفس قواعد البرنامج).

### التوثيق وربط الجهاز

| الطلب                                       | الوصف                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /v1/auth/pair` `{code}`               | **مرة واحدة** عند تجهيز جهاز الفرع: الكود من الإدارة ← `{branch_id, secret, branch_name, shop_name…}`. احفظ السر **مشفّراً** في الجهاز. الربط يوقف أي جهاز قديم لنفس الفرع |
| `POST /v1/auth/token` `{branch_id, secret}` | توكن JWT صالح `SYNC_TOKEN_TTL_MINUTES` دقيقة. جدّده قبل انتهائه أو عند `401 token_expired`                                                                                |

أكواد مهمة للبرنامج المحلي: `401 token_expired` (اطلب توكناً جديداً بنفس السر) ·
`401 token_revoked` أو `bad_credentials` (السر اتغيّر: الجهاز يحتاج ربطاً جديداً) · `429 rate_limited` (انتظر `retry_after` ثانية).

كل الطلبات التالية: `Authorization: Bearer <access_token>`. التوكن مقيّد بالمحل والفرع، فلا يرى فرعٌ بيانات محل آخر.

### المزامنة

| الطلب                                  | الوصف                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/sync/push` `{events: [...]}` | حتى `SYNC_MAX_PUSH_EVENTS` حدث. الرد `{accepted, duplicates, last_seq}`. **إعادة نفس الحزمة آمنة** (المكرر يُتجاهل بالـ `id`)        |
| `GET /v1/sync/pull?after=N&limit=500`  | أحداث باقي الفروع بعد الرقم N بالترتيب. الرد `{events, next_after, has_more, last_seq}`. كرر بـ `after=next_after` طالما `has_more` |
| `POST /v1/sync/ack` `{seq}`            | بعد تطبيق الأحداث محلياً (للمراقبة وحذف القديم لاحقاً)                                                                                |
| `GET /v1/sync/status`                  | آخر رقم في المحل، ورقمك، وحالة كل الفروع (آخر ظهور)                                                                                 |
| `GET /v1/sync/stream?after=N`          | **SSE**: `hello` ثم `changed {last_seq}` عند أي جديد، ونبضة كل 15 ثانية، و`reconnect` قبل انتهاء التوكن                             |
| `GET /v1/branches`                     | دليل فروع المحل: `{id, name, code, is_active, online, is_me}` لاختيار فرع التحويل (بدون أي بيانات دخول)                             |

**شكل الحدث المرفوع** (نفس صف `outbox` المحلي):

```json
{
  "id": "0190a1b2-…",          // id صف outbox (UUID) — مفتاح منع التكرار
  "entity": "sale",             // product / customer / sale / stock_movement / …
  "entity_id": "…",
  "op": "upsert",               // upsert / delete
  "payload": { … },             // نفس payload الـ outbox
  "base_version": 3,            // اختياري
  "created_at": "2026-11-13T10:00:00Z",
  "target_branch_id": null      // اختياري: id فرع واحد ← الحدث يوصله هو بس (باقي الفروع لا تراه)
}
```

**الترتيب مضمون:** كل حدث يأخذ `seq` متسلسلاً داخل المحل **تحت قفل صف المحل**، فلا يظهر رقم أكبر قبل رقم أصغر
ولا يفوت حدث على فرع يسحب «بعد آخر رقم». المؤشر `next_after` يتقدّم حتى عند تخطّي أحداث فرعك أنت.

### كتالوج الأصناف والعملاء (مشترك بين الفروع)

```
POST /v1/catalog/push   {"items": [{"kind": "product"|"customer", "gid": "<id>", "data": {...},
                                    "fields": ["sale_price"] | null, "deleted": false}]}
  ← لكل سجل: {"gid", "status": "ok"|"merged"|"conflict"|"deleted"|"invalid", "canonical_gid",
              "version", "seq", "data", "message"}
GET  /v1/catalog/pull?after=<seq>&limit=500
  ← {"items": [{"kind", "gid", "version", "seq", "deleted", "data", "updated_by_branch_id"}],
     "next_after", "has_more", "last_seq"}
```

- **اللي بيتشارك:** الصنف (الاسم، الباركود، القسم، الوحدة ووحدات البيع الإضافية، سعر البيع والجملة، كود الميزان،
  تتبع الصلاحية، موقوف) والعميل (الاسم، التليفون، العنوان، الملاحظات، حد الائتمان، عميل جملة).
  **ما بيتشاركش أبداً:** المخزون، التكلفة، حد الطلب، ديون العملاء، نقاط الولاء، المشتريات.
- **أول ربط:** صنف بنفس الباركود (أو بنفس الاسم لو مالوش باركود) أو عميل بنفس التليفون موجود عند فرع رفع قبلك
  ← `merged` بالمعرّف المعتمد وبياناته، فلا يتكرر. **أول فرع يرفع الصنف هو المرجع لبياناته.**
- **التعديل بالحقول:** `fields` = الحقول اللي اتغيرت بس. فرع غيّر السعر وفرع تاني غيّر الاسم = الاتنين يتحفظوا.
  نفس الحقل من فرعين = آخر رفع يكسب.
- **التعارض:** تعديل يخلي باركود صنف = باركود صنف تاني حي ← `conflict` برسالة واضحة (السجل يفضل زي ما هو).
- **التحقق:** نموذج صارم لكل نوع (لا حقول زيادة، أنواع وأطوال مضبوطة، الجملة أقل من القطاعي)، وكل فرع
  بيتحقق تاني بنفس قواعد شاشة الأصناف قبل ما يطبّق. معرّف يخص محل تاني ← `invalid` بدون كشف أي شيء.

### تحويلات المخزون

```
طلب (فرع الاستلام يطلب):
  requested ──موافقة وإرسال: الفرع المطلوب منه──► sent
            ├─رفض: الفرع المطلوب منه─────────────► rejected
            └─سحب: صاحب الطلب────────────────────► withdrawn
إرسال (مباشر أو بعد الموافقة):
  sent ──استلام: فرع الاستلام فقط──► received  /  partial (بعجز)
       └─إلغاء: فرع الإرسال فقط───► cancelled
```

| الطلب                                                                                                      | الوصف                                                                                                          |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `POST /v1/transfers` `{id, to_branch_id, lines[], note?, sent_by?}`                                        | إرسال مباشر (البضاعة خرجت). `id` من الفرع: إعادة نفس الطلب = نفس التحويل                                       |
| `POST /v1/transfers/requests` `{id, from_branch_id, lines[], note?, requested_by?}`                        | طلب بضاعة من فرع آخر (السطر: `product_id, name, unit, qty`)                                                    |
| `POST /v1/transfers/{id}/approve` `{lines:[{line_id, qty, unit_cost, batch_no?, expiry_date?}], sent_by?}` | الموافقة وإرسال الكميات المتاحة فعلاً. `qty: 0` = غير متوفر (يُحذف السطر). الأسطر غير المذكورة = الكمية المطلوبة |
| `POST /v1/transfers/{id}/reject` `{reason}`                                                                | رفض الطلب                                                                                                      |
| `POST /v1/transfers/{id}/withdraw`                                                                         | صاحب الطلب يسحبه قبل الرد                                                                                      |
| `GET /v1/transfers?direction=in                                                                            | out                                                                                                            | all&status=` | `in` = ما يخصك كمستلم (واردات وطلباتك)، `out` = كمرسل (صادرات وطلبات منك) |
| `GET /v1/transfers/{id}`                                                                                   | التفاصيل (مع `total_cost` و`shortage_cost`). فرع ليس طرفاً يأخذ `404`                                           |
| `POST /v1/transfers/{id}/receive` `{lines:[{line_id, qty_received}], note?}`                               | الأسطر غير المذكورة = استُلمت كاملة. أقل من المرسل ← `partial`                                                  |
| `POST /v1/transfers/{id}/cancel`                                                                           | قبل الاستلام فقط                                                                                               |

السطر المرسل: `{product_id, name, unit, qty, unit_cost, batch_no?, expiry_date?}` (الصلاحية والتشغيلة تنتقل مع البضاعة).
كل تغيّر حالة يُضاف لسجل الأحداث كـ `entity="stock_transfer"` و
`op = requested | sent | rejected | withdrawn | received | cancelled`، **موجّهاً للطرف الآخر فقط**
(باقي فروع المحل لا ترى تحويلات غيرها). فرع الإرسال يخصم مخزونه عند الإرسال، وفرع الاستلام يضيف ما
استلمه فعلاً، والعجز يظهر للطرفين من `received`.

### الملخصات اليومية

| الطلب                                        | الوصف                                                          |
| -------------------------------------------- | -------------------------------------------------------------- |
| `PUT /v1/stats/{YYYY-MM-DD}` `{data: {...}}` | ملخص يوم فرعك (مبيعات، عدد فواتير، ربح…). يُستبدل لو أُرسل ثانية |
| `GET /v1/stats?date_from=&date_to=`          | ملخصات كل فروع المحل (تقارير مجمعة / تطبيق المالك)             |

### تطبيق الهاتف (`/mobile/v1`) — المالك ومديرو الفروع، خطة «سلسلة» فقط

الحسابات هي حسابات البرنامج نفسها (owner يرى كل الفروع، و manager فروعه فقط، والكاشير مرفوض).
أسماء المستخدمين فريدة داخل المحل فقط، فالهاتف يُربط بالمحل بكود مرة واحدة ثم اسم المستخدم وكلمة المرور.

| الطلب                                                                                         | الوصف                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /v1/shop/mobile-code` (توكن فرع)                                                        | كود ربط هاتف (XXXX-XXXX-XXXX)، `SYNC_MOBILE_CODE_TTL_MINUTES`، مرة واحدة، ويُبطَل بعد `SYNC_MOBILE_CODE_MAX_ATTEMPTS` كلمة مرور خاطئة. للدعم: `POST /v1/admin/shops/{id}/mobile-code`                                                                                                                                                                                            |
| `POST /mobile/v1/auth/login` `{code, username, password, device_id, device_name, platform}`   | ← `{access_token, expires_at, refresh_token, refresh_expires_at, session_id, user}`. دخول جديد من نفس `device_id` يلغي جلسته القديمة                                                                                                                                                                                                                                           |
| `POST /mobile/v1/auth/refresh` `{refresh_token}`                                              | زوج جديد، والـ refresh القديم يتوقف. **رجوع refresh قديم يلغي الجلسة كلها** (`refresh_invalid`)                                                                                                                                                                                                                                                                                |
| `POST /mobile/v1/auth/logout` · `POST /mobile/v1/auth/logout-all`                             | هذا الهاتف · كل هواتف الحساب (يعملان حتى لو نزلت الخطة)                                                                                                                                                                                                                                                                                                                        |
| `GET /mobile/v1/me` · `GET /mobile/v1/sessions`                                               | الحساب وفروعه المسموحة · هواتف الحساب                                                                                                                                                                                                                                                                                                                                          |
| `GET /mobile/v1/branches` · `GET /mobile/v1/branches/{id}`                                    | الفروع المسموحة: `status` (`online` ضمن `SYNC_ONLINE_WINDOW_SECONDS` · `late` حتى `SYNC_MOBILE_LATE_MINUTES` · `offline` · `never` · `disabled`)، `last_seen_at`، `pending_events` (تأخر المزامنة)، `stats_updated_at` (فرع غير مسند ← `404`)                                                                                                                                  |
| `GET /mobile/v1/summary?date_from=&date_to=[&branch_id=]`                                     | ملخص الفترة (حتى سنة) للفروع المسموحة أو فرع واحد: `totals`، `branches` (الأعلى صافياً أولاً، مع `last_update` و`reported_days`/`expected_days`: الناقص = لم يرسل، لا صفر)، `days`، و`compare.previous` (الفترة السابقة بنفس الطول) و`compare.week_ago` (لليوم الواحد). **نفس أرقام تقرير الفروع في البرنامج**: `tests/fixtures/branch_report_golden.json` يُختبر هنا وفي backend |
| `GET /mobile/v1/transfers?needs_action=&status=&branch_id=` · `GET /mobile/v1/transfers/{id}` | تحويلات الفروع المسموحة (المرسل أو المستلم منها) مع `approval` و`can_approve`/`can_reject`. تحويل لا يخص فروعك ← `404`                                                                                                                                                                                                                                                         |
| `POST /mobile/v1/transfers/{id}/approve` `{version, lines?, note?}`                           | **موافقة ينفّذها جهاز الفرع المطلوب منه**: تُحفظ أمراً، والفرع يأخذه مع مزامنته وينفّذه بنفس مسار البرنامج (خصم الدفعات والتكلفة ثم `approve`)، فيُحسم `done` تلقائياً. الطلب تغيّر ← `409 transfer_changed` مع الحالة الحالية؛ موافقة منتظرة ← `409 approval_pending`                                                                                                                |
| `POST /mobile/v1/transfers/{id}/reject` `{version, reason}`                                   | رفض مباشر (لا يحرّك مخزوناً)، نفس حدث رفض البرنامج. أثناء تنفيذ الفرع لموافقة ← `409 approval_in_progress`                                                                                                                                                                                                                                                                       |
| `POST /mobile/v1/transfers/{id}/approval/cancel`                                              | إلغاء موافقة لم يأخذها الفرع (صاحبها أو المالك)                                                                                                                                                                                                                                                                                                                                |

**أوامر الفرع** (توكن فرع): `GET /v1/transfers/commands` ← `POST /v1/transfers/commands/{id}/claim` (مرة واحدة) ← الموافقة العادية،
أو `POST /v1/transfers/commands/{id}/fail {code, message}`. أمر لم يأخذه الفرع خلال `SYNC_MOBILE_COMMAND_TTL_HOURS` (24) ينتهي
(فرع منقطع أو بإصدار أقدم لا يعرف الأوامر، ولا يتأثر بشيء). الصلاحيات = البرنامج: الفرع المطلوب منه فقط ← المالك أو مديره.
كل إجراء في السجل الأمني بـ `actor=mobile` و`from_phone` واسم المستخدم والجهاز.

**التنبيهات (push عبر Expo):**

| الطلب                                                                        | الوصف                                                                                      |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PUT /mobile/v1/push-token` `{token, utc_offset_minutes}` · `DELETE …`       | Expo push token لهذه الجلسة. يُمسح تلقائياً مع الخروج والخروج من كل الأجهزة وأي إلغاء للجلسة |
| `GET /mobile/v1/notifications` · `POST /mobile/v1/notifications/read {ids?}` | سجل تنبيهات الحساب وغير المقروء                                                            |
| `GET/PUT /mobile/v1/notification-prefs`                                      | الأنواع المفعّلة، مدة انقطاع الفرع، ساعات الهدوء (لكل الحساب)                               |

خدمة منفصلة **عملية واحدة**: `python -m app.cli notifier` (خدمة `notifier` في `docker-compose.yml`، وعلى PostgreSQL قفل
يمنع نسختين معاً). كل `SYNC_NOTIFY_INTERVAL_SECONDS`: تكتشف (فرع منقطع أكثر من مدة المستخدم · إيصالات مرفوضة جديدة ·
طلب تحويل ينتظر موافقة هذا الحساب · صافي أمس أقل من `SYNC_LOW_SALES_RATIO` من متوسط نفس اليوم في 4 أسابيع) وتنشئ
**تنبيهاً واحداً لكل حدث لكل حساب** (قيد فريد)، ثم ترسل **مجمّعاً** (لا أكثر من إشعار كل `SYNC_NOTIFY_MIN_GAP_MINUTES`)،
ولا شيء في ساعات الهدوء، وتُسقط ما لم يعد صحيحاً (الفرع رجع، الطلب اتحسم). النص بلا مبالغ ولا تفاصيل (يظهر على شاشة القفل).
تحتاج اتصالاً خارجياً بـ `exp.host`. اختياري: `SYNC_EXPO_ACCESS_TOKEN` لو فعّلت الحماية الإضافية في expo.dev.

**أمان المحل من الهاتف — المالك فقط** (غيره ← `403 owner_only`):

| الطلب                                                                                                          | الوصف                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /mobile/v1/admin/staff` · `POST …/staff/{id}/deactivate` · `…/activate`                                   | نفس إدارة الموظفين المركزية (باسم الفرع الرئيسي): الإيقاف يصل للفروع مع المزامنة فتُقفل جلسات الموظف ولا يدخل، وجلسات هاتف المدير الموقوف تتوقف فوراً. محل بلا جهاز رئيسي ← `400 no_main_branch`             |
| `GET /mobile/v1/admin/devices` · `POST …/devices/{id}/revoke` · `…/pairing-code`                               | إلغاء ربط جهاز (يتوقف فوراً: `token_revoked`)، **حتى الجهاز الرئيسي لو اتسرق** (يُسترجع بمفتاح الترخيص). كود ربط لأي فرع عدا الرئيسي                                                                         |
| `GET /mobile/v1/admin/sessions` · `POST …/sessions/{id}/revoke`                                                | جلسات تطبيق الهاتف لكل المستخدمين، وإلغاء أي منها                                                                                                                                                          |
| `GET /mobile/v1/admin/catalog/search?q=` · `POST …/catalog/{gid}/price {version, sale_price, wholesale_price}` | بحث الكتالوج المشترك بالاسم/الباركود، وتعديل سعر البيع/الجملة لكل الفروع (نفس قواعد البرنامج). نسخة قديمة ← `409 catalog_changed` بالسعر الحالي. يصل للفروع بـ seq كتالوج جديد، والفواتير السابقة لا تتأثر |

مسارات `/admin` كلها تتحقق من المالك **قبل** قراءة الطلب (`MobileOwnerDep`)، و`tests/test_mobile_route_matrix.py` يمر على
كل مسار `/mobile/v1` تلقائياً (بلا توكن، توكن فرع، مدير، خطة أقل).

كل إجراء في السجل الأمني بـ `actor=mobile` و`from_phone` واسم المالك وجهازه.

**ملخصات الفروع (المخزون والورديات والعمليات الحساسة):**

| الطلب                                                                                         | الوصف                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/reports/config` (فرع)                                                                | حدود المالك + `wanted`: الأصناف الناقصة في الفروع الأخرى (الفرع يرفع مخزونه منها فقط)                                                  |
| `POST /v1/reports/push` (فرع)                                                                 | لقطات `shortages`/`expiring`/`wanted_stock` (None = لم تتغير) + `records` (`shift`/`sensitive`/`top`) بمفتاح ثابت. صارم: لا حقول زائدة |
| `GET /mobile/v1/stock/shortages` · `…/stock/expiring`                                         | لكل فرع مسموح: الأصناف و`updated_at` («آخر تحديث من الفرع»، null = لم يرسل)، ولكل ناقص اقتراحات من فروع فيها فائض                      |
| `POST /mobile/v1/stock/request-transfer` `{to_branch_id, from_branch_id, lines:[{key, qty}]}` | طلب تحويل باسم الفرع الناقص (المالك أو مديره) بنفس مسار طلب البرنامج                                                                   |
| `GET /mobile/v1/shifts` · `…/sensitive` · `…/top-sellers` `?date_from&date_to[&branch_id]`    | الورديات بفروقها، العمليات الحساسة، الأكثر مبيعاً                                                                                       |
| `GET/PUT /mobile/v1/admin/report-config` (المالك)                                             | `discount_min`، `return_min`، `cash_diff_min` (قروش)، `expiry_days`                                                                    |

العمليات الحساسة = ما يحدث فعلاً في البرنامج: خصم كاشير أو مرتجع فوق الحد، ومرتجع فاتورة كاملة (البرنامج لا يلغي
الفواتير ولا يغيّر السعر عند البيع). تنبيهات `sensitive_op` و`cash_diff` (فرق ≥ `cash_diff_min`) بلا مبالغ في النص.
الفرع يحسبها في الخلفية كل 5 دقائق من جداوله (قراءة فقط) ويرفع ما تغيّر، وسيرفر أقدم بلا `/reports` (404) يتجاهله
الفرع 6 ساعات. قياس زمن البيع: `backend/tools/bench_sale_reports.py`.

- توكن الوصول `SYNC_MOBILE_ACCESS_TTL_MINUTES` دقيقة، والـ refresh يتجدد مع كل استخدام لمدة `SYNC_MOBILE_REFRESH_DAYS` يوم.
- كل طلب يعيد فحص الحساب والمحل والخطة: محل بخطة أقل ← `403 plan_upgrade_required` مع
  `details: {current_plan, required_plan}` (شاشة الترقية). تغيير كلمة مرور الحساب أو دوره أو إيقافه ← `401 session_revoked`.
- توكن الهاتف (`typ=mobile`، `aud`، ومفتاح توقيع مشتق) لا يصلح لمسارات `/v1`، وتوكن الفرع لا يصلح لـ `/mobile/v1`.

---

## 5) الأمان

| الخطر                             | الحماية                                                                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| سرقة/تخمين سر الفرع               | سر **256 بت** عشوائي، مُخزَّن **مُجزّأ** (SHA-256)، يظهر مرة واحدة. التوكن JWT قصير العمر وموقّع ومحدد المصدر (`iss`)                                         |
| جهاز ضاع أو اتسرق                 | `rotate-secret` أو ربط جديد يزيد `token_version` ← **السر القديم وكل توكناته تتوقف فوراً** (`token_revoked`)                                             |
| نسخ السر الطويل يدوياً (تسريب)     | **كود ربط** 12 حرفاً (~59 بت)، **مرة واحدة**، صالح 15 دقيقة، مُجزّأ، والكود الجديد يلغي القديم                                                             |
| تخمين/إغراق `/auth`               | **حد طلبات لكل IP** (`SYNC_AUTH_RATE_PER_MIN`) ← `429` مع `retry_after`، ورسالة واحدة لكل أسباب الفشل (لا تكشف هل الفرع/الكود موجود)                    |
| محل يرى بيانات محل آخر            | كل استعلام مقيّد بـ `shop_id` من التوكن، والأحداث والتحويلات **لا تعبر بين المحلات** (اختبارات عزل)                                                      |
| فرع يرى ما لا يخصه داخل نفس المحل | **أحداث موجّهة** (`target_branch_id`)، والتحويل لا يراه إلا طرفاه (الفرع الثالث يأخذ `404`)                                                              |
| فرع ينفذ دور غيره                 | كل انتقال تحويل يتحقق من **الدور**: المستلم فقط يستلم، المرسل فقط يلغي، المطلوب منه فقط يوافق/يرفض، الطالب فقط يسحب                                     |
| إعادة الطلبات (نت ضعيف)           | الأحداث والتحويلات **idempotent** بالـ `id`؛ id مستخدم من فرع آخر ← `409` (لا استيلاء)                                                                  |
| تعارض متزامن                      | قفل صف المحل ثم صف التحويل بنفس الترتيب دائماً، وترقيم بلا فجوات                                                                                         |
| إيقاف محل (اشتراك انتهى)          | `is_active=false` يوقف **كل فروعه فوراً**                                                                                                                |
| لوحة الإدارة                      | `SYNC_ADMIN_TOKEN` + **قائمة IPs** اختيارية (`SYNC_ADMIN_ALLOWED_IPS`)، وكل عملية إدارة مُسجَّلة                                                           |
| هاتف ضاع أو refresh اتسرق         | «الخروج من كل الأجهزة»، والـ refresh يتغير مع كل تجديد ومُخزَّن **مُجزّأ**، ورجوع قديم يلغي الجلسة. دخول الهاتف وخروجه في السجل الأمني باسم المستخدم والجهاز |
| تتبع الاختراق                     | **سجل أمني** (`GET /v1/admin/audit`): دخول فاشل، ربط، تغيير أسرار، عمليات الإدارة، التحويلات، مع الـ IP و**بدون أي سر**                                 |
| طلبات ضخمة                        | حد حجم الطلب (`SYNC_MAX_BODY_BYTES` في التطبيق + Caddy) وحد عدد الأحداث وحجم كل حدث                                                                     |
| تسريب تفاصيل داخلية               | الأخطاء غير المتوقعة ترجع `500 server_error` فقط، والتفاصيل في اللوج                                                                                    |
| التنصت                            | HTTPS إجباري عبر Caddy (HSTS)، و`/docs` مقفول في الإنتاج                                                                                                |

لا تشارك `SYNC_ADMIN_TOKEN` مع أي محل، ولا ترفع `.env` على git، وضع IP جهازك في `SYNC_ADMIN_ALLOWED_IPS`.

## 6) التطوير والاختبارات (على جهازك)

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt     # Windows (Linux/Mac: .venv/bin/pip)
.venv/Scripts/python -m pytest -q                     # 34 اختبار على SQLite بنفس الـ migrations
```

تشغيل محلي سريع (SQLite):

```bash
set SYNC_JWT_SECRET=<32+ حرف>  &  set SYNC_ADMIN_TOKEN=<32+ حرف>  &  set SYNC_DOCS_ENABLED=true
.venv/Scripts/python -m alembic upgrade head
.venv/Scripts/python -m uvicorn app.main:app --reload     # http://127.0.0.1:8000/docs
```

تعديل الجداول: عدّل `app/models.py` ثم
`alembic revision --autogenerate -m "وصف"` وراجع الملف الناتج، ثم `alembic check`.

---

## 7) اللي لسه ناقص (خارج هذا المجلد)

- رفع المبيعات والمصروفات (`/v1/sync`) لتقارير المالك المجمعة لكل الفروع.
- حذف الأحداث القديمة بعد أن تؤكدها كل الفروع (compaction)، وتوثيق تطبيق المالك.

---

## المتجر الإلكتروني («سلسلة» فقط)

- **الإدارة:** من البرنامج على الجهاز الرئيسي للمالك ← «المتجر الإلكتروني» (الإعدادات، الأصناف المعروضة، الطلبات).
- **الواجهة العامة:** مجلد `../storefront` (Next.js) كخدمة `storefront` في compose، على نطاق منفصل:
  `https://STORE_DOMAIN/<slug>`. Caddy يوجّه `/v1/store/public/*` فقط لـ api، ولا يمر أي مسار آخر للـ api من هذا النطاق.
- **الإعداد:** أضف في `.env`: `STORE_DOMAIN` و `SYNC_STORE_PUBLIC_URL=https://STORE_DOMAIN` + سجل DNS من نوع `A`.
  وفي بناء البرنامج: `DEALZORA_STORE_URL=https://STORE_DOMAIN` (زر «فتح المتجر» من البرنامج).
- **الدفع:** عند الاستلام فقط. الأسعار تُحسب على السيرفر من الكتالوج، والمخزون المتاح = ما يرفعه فرع التجهيز − المحجوز في الطلبات المفتوحة.
- **الحماية:** حد قراءات لكل IP، وحد طلبات ناجحة لكل IP ولكل هاتف (10 دقائق)، وحقل فخ للبرامج الآلية، ومفتاح يمنع تكرار الطلب،
  ورابط متابعة سري (HMAC) لا يُخزَّن إلا مُجزّأً، والصور يُتحقق من نوعها الفعلي وتُخدم بـ `nosniff` و `sandbox`.

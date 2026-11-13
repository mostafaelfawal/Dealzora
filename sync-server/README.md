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
| الطلب | الوصف |
|---|---|
| `POST /v1/auth/pair` `{code}` | **مرة واحدة** عند تجهيز جهاز الفرع: الكود من الإدارة ← `{branch_id, secret, branch_name, shop_name…}`. احفظ السر **مشفّراً** في الجهاز. الربط يوقف أي جهاز قديم لنفس الفرع |
| `POST /v1/auth/token` `{branch_id, secret}` | توكن JWT صالح `SYNC_TOKEN_TTL_MINUTES` دقيقة. جدّده قبل انتهائه أو عند `401 token_expired` |

أكواد مهمة للبرنامج المحلي: `401 token_expired` (اطلب توكناً جديداً بنفس السر) ·
`401 token_revoked` أو `bad_credentials` (السر اتغيّر: الجهاز يحتاج ربطاً جديداً) · `429 rate_limited` (انتظر `retry_after` ثانية).

كل الطلبات التالية: `Authorization: Bearer <access_token>`. التوكن مقيّد بالمحل والفرع، فلا يرى فرعٌ بيانات محل آخر.

### المزامنة
| الطلب | الوصف |
|---|---|
| `POST /v1/sync/push` `{events: [...]}` | حتى `SYNC_MAX_PUSH_EVENTS` حدث. الرد `{accepted, duplicates, last_seq}`. **إعادة نفس الحزمة آمنة** (المكرر يُتجاهل بالـ `id`) |
| `GET /v1/sync/pull?after=N&limit=500` | أحداث باقي الفروع بعد الرقم N بالترتيب. الرد `{events, next_after, has_more, last_seq}`. كرر بـ `after=next_after` طالما `has_more` |
| `POST /v1/sync/ack` `{seq}` | بعد تطبيق الأحداث محلياً (للمراقبة وحذف القديم لاحقاً) |
| `GET /v1/sync/status` | آخر رقم في المحل، ورقمك، وحالة كل الفروع (آخر ظهور) |
| `GET /v1/sync/stream?after=N` | **SSE**: `hello` ثم `changed {last_seq}` عند أي جديد، ونبضة كل 15 ثانية، و`reconnect` قبل انتهاء التوكن |
| `GET /v1/branches` | دليل فروع المحل: `{id, name, code, is_active, online, is_me}` لاختيار فرع التحويل (بدون أي بيانات دخول) |

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
| الطلب | الوصف |
|---|---|
| `POST /v1/transfers` `{id, to_branch_id, lines[], note?, sent_by?}` | إرسال مباشر (البضاعة خرجت). `id` من الفرع: إعادة نفس الطلب = نفس التحويل |
| `POST /v1/transfers/requests` `{id, from_branch_id, lines[], note?, requested_by?}` | طلب بضاعة من فرع آخر (السطر: `product_id, name, unit, qty`) |
| `POST /v1/transfers/{id}/approve` `{lines:[{line_id, qty, unit_cost, batch_no?, expiry_date?}], sent_by?}` | الموافقة وإرسال الكميات المتاحة فعلاً. `qty: 0` = غير متوفر (يُحذف السطر). الأسطر غير المذكورة = الكمية المطلوبة |
| `POST /v1/transfers/{id}/reject` `{reason}` | رفض الطلب |
| `POST /v1/transfers/{id}/withdraw` | صاحب الطلب يسحبه قبل الرد |
| `GET /v1/transfers?direction=in|out|all&status=` | `in` = ما يخصك كمستلم (واردات وطلباتك)، `out` = كمرسل (صادرات وطلبات منك) |
| `GET /v1/transfers/{id}` | التفاصيل (مع `total_cost` و`shortage_cost`). فرع ليس طرفاً يأخذ `404` |
| `POST /v1/transfers/{id}/receive` `{lines:[{line_id, qty_received}], note?}` | الأسطر غير المذكورة = استُلمت كاملة. أقل من المرسل ← `partial` |
| `POST /v1/transfers/{id}/cancel` | قبل الاستلام فقط |

السطر المرسل: `{product_id, name, unit, qty, unit_cost, batch_no?, expiry_date?}` (الصلاحية والتشغيلة تنتقل مع البضاعة).
كل تغيّر حالة يُضاف لسجل الأحداث كـ `entity="stock_transfer"` و
`op = requested | sent | rejected | withdrawn | received | cancelled`، **موجّهاً للطرف الآخر فقط**
(باقي فروع المحل لا ترى تحويلات غيرها). فرع الإرسال يخصم مخزونه عند الإرسال، وفرع الاستلام يضيف ما
استلمه فعلاً، والعجز يظهر للطرفين من `received`.

### الملخصات اليومية
| الطلب | الوصف |
|---|---|
| `PUT /v1/stats/{YYYY-MM-DD}` `{data: {...}}` | ملخص يوم فرعك (مبيعات، عدد فواتير، ربح…). يُستبدل لو أُرسل ثانية |
| `GET /v1/stats?date_from=&date_to=` | ملخصات كل فروع المحل (تقارير مجمعة / تطبيق المالك) |

---

## 5) الأمان
| الخطر | الحماية |
|---|---|
| سرقة/تخمين سر الفرع | سر **256 بت** عشوائي، مُخزَّن **مُجزّأ** (SHA-256)، يظهر مرة واحدة. التوكن JWT قصير العمر وموقّع ومحدد المصدر (`iss`) |
| جهاز ضاع أو اتسرق | `rotate-secret` أو ربط جديد يزيد `token_version` ← **السر القديم وكل توكناته تتوقف فوراً** (`token_revoked`) |
| نسخ السر الطويل يدوياً (تسريب) | **كود ربط** 12 حرفاً (~59 بت)، **مرة واحدة**، صالح 15 دقيقة، مُجزّأ، والكود الجديد يلغي القديم |
| تخمين/إغراق `/auth` | **حد طلبات لكل IP** (`SYNC_AUTH_RATE_PER_MIN`) ← `429` مع `retry_after`، ورسالة واحدة لكل أسباب الفشل (لا تكشف هل الفرع/الكود موجود) |
| محل يرى بيانات محل آخر | كل استعلام مقيّد بـ `shop_id` من التوكن، والأحداث والتحويلات **لا تعبر بين المحلات** (اختبارات عزل) |
| فرع يرى ما لا يخصه داخل نفس المحل | **أحداث موجّهة** (`target_branch_id`)، والتحويل لا يراه إلا طرفاه (الفرع الثالث يأخذ `404`) |
| فرع ينفذ دور غيره | كل انتقال تحويل يتحقق من **الدور**: المستلم فقط يستلم، المرسل فقط يلغي، المطلوب منه فقط يوافق/يرفض، الطالب فقط يسحب |
| إعادة الطلبات (نت ضعيف) | الأحداث والتحويلات **idempotent** بالـ `id`؛ id مستخدم من فرع آخر ← `409` (لا استيلاء) |
| تعارض متزامن | قفل صف المحل ثم صف التحويل بنفس الترتيب دائماً، وترقيم بلا فجوات |
| إيقاف محل (اشتراك انتهى) | `is_active=false` يوقف **كل فروعه فوراً** |
| لوحة الإدارة | `SYNC_ADMIN_TOKEN` + **قائمة IPs** اختيارية (`SYNC_ADMIN_ALLOWED_IPS`)، وكل عملية إدارة مُسجَّلة |
| تتبع الاختراق | **سجل أمني** (`GET /v1/admin/audit`): دخول فاشل، ربط، تغيير أسرار، عمليات الإدارة، التحويلات، مع الـ IP و**بدون أي سر** |
| طلبات ضخمة | حد حجم الطلب (`SYNC_MAX_BODY_BYTES` في التطبيق + Caddy) وحد عدد الأحداث وحجم كل حدث |
| تسريب تفاصيل داخلية | الأخطاء غير المتوقعة ترجع `500 server_error` فقط، والتفاصيل في اللوج |
| التنصت | HTTPS إجباري عبر Caddy (HSTS)، و`/docs` مقفول في الإنتاج |

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

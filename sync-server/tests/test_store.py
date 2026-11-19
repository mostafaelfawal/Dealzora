"""المتجر الإلكتروني: الصلاحيات والخطة، الأصناف المعروضة، الطلب بالدفع عند الاستلام، والمخزون."""

import base64
import uuid

import pytest

from tests.test_mobile import db

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def gid() -> str:
    return str(uuid.uuid4())


def product(name: str, price: int, **over):  # noqa: ANN003
    return {"name": name, "unit": "قطعة", "sale_price": price, **over}


@pytest.fixture
def store(client, shop):
    """المعادي (A) هو الجهاز الرئيسي للمالك، وفي الكتالوج 3 أصناف، والمتجر منشور."""
    from app.models import Branch

    _, br = shop
    with db() as s:
        s.get(Branch, br["A"].id).is_admin = True
        s.commit()
    gids = {"milk": gid(), "rice": gid(), "cheese": gid()}
    items = [
        {"kind": "product", "gid": gids["milk"], "data": product("لبن جهينة", 3500, category="ألبان", barcode="6221")},
        {"kind": "product", "gid": gids["rice"], "data": product("أرز الضحى", 4200, category="بقالة")},
        {"kind": "product", "gid": gids["cheese"], "data": product("جبنة رومي", 32000, unit="كيلو", allow_decimal=True,
                                                                     category="ألبان")},
    ]  # fmt: skip
    r = br["A"].post("/v1/catalog/push", json={"items": items})
    assert all(x["status"] == "ok" for x in r.json()), r.text
    r = br["A"].put("/v1/shop/store", json=settings())
    assert r.status_code == 200, r.text
    r = br["A"].post("/v1/shop/store/products/bulk", json={"gids": list(gids.values()), "is_published": True})
    assert r.json()["changed"] == 3
    return br, gids


def settings(**over):  # noqa: ANN003
    return {
        "slug": "elbaraka", "name": "سوبر ماركت البركة", "phone": "0100 123 4567", "is_published": True,
        "delivery_fee": 2000, "free_delivery_over": 50000, "min_order": 5000, **over,
    }  # fmt: skip


def order(gids: dict, **over):  # noqa: ANN003
    return {
        "client_ref": str(uuid.uuid4()), "name": "أحمد علي", "phone": "01011112222",
        "address": "15 شارع النصر، المعادي", "items": [{"gid": gids["milk"], "qty": 2000}], **over,
    }  # fmt: skip


# ================= الصلاحيات والخطة =================
def test_only_main_device_manages_store(client, store):
    br, _ = store
    for call in (lambda b: b.get("/v1/shop/store"), lambda b: b.put("/v1/shop/store", json=settings()),
                 lambda b: b.get("/v1/shop/store/orders"), lambda b: b.get("/v1/shop/store/products")):  # fmt: skip
        r = call(br["B"])
        assert r.status_code == 403 and r.json()["error"]["code"] == "not_admin_branch"
    assert client.get("/v1/shop/store").status_code == 401


def test_store_requires_enterprise_plan(client, store):
    from app.models import Shop

    br, _ = store
    with db() as s:
        shop = s.get(Shop, s.scalars(__import__("sqlalchemy").select(Shop.id)).first())
        shop.license_plan = "pro"
        s.commit()
    r = br["A"].get("/v1/shop/store")
    assert r.status_code == 403 and r.json()["error"]["code"] == "plan_upgrade_required"
    # الواجهة العامة تختفي فوراً (لا تكشف أن المتجر موجود)
    assert client.get("/v1/store/public/elbaraka").status_code == 404


def test_slug_rules(client, store):
    br, _ = store
    for bad in ("ab", "Admin", "v1", "-bad", "bad--slug", "عربي", "a" * 41):
        r = br["A"].put("/v1/shop/store", json=settings(slug=bad))
        assert r.status_code == 422, bad
    assert br["A"].get("/v1/shop/store/slug", params={"slug": "elbaraka"}).json()["available"]  # رابطي أنا


def test_slug_unique_between_shops(client, store):
    from tests.conftest import BranchClient, admin

    s2 = admin(client, "POST", "/v1/admin/shops", json={"name": "محل آخر"}).json()
    creds = admin(client, "POST", f"/v1/admin/shops/{s2['id']}/branches", json={"name": "رئيسي", "code": "X"}).json()
    other = BranchClient(client, creds["branch_id"], creds["secret"])
    from app.models import Branch

    with db() as s:
        s.get(Branch, other.id).is_admin = True
        s.commit()
    r = other.put("/v1/shop/store", json=settings())
    assert r.status_code == 409 and r.json()["error"]["code"] == "slug_taken"
    assert other.get("/v1/shop/store/slug", params={"slug": "elbaraka"}).json()["available"] is False


def test_text_is_cleaned(client, store):
    br, _ = store
    r = br["A"].put("/v1/shop/store", json=settings(name="  متجر‮   البركة​ ", tagline="  "))
    assert r.json()["name"] == "متجر البركة" and r.json()["tagline"] is None
    assert r.json()["phone"] == "01001234567"


# ================= الواجهة العامة =================
def test_public_store_and_products(client, store):
    br, gids = store
    home = client.get("/v1/store/public/elbaraka").json()
    assert home["name"] == "سوبر ماركت البركة" and home["products_count"] == 3
    assert {c["name"]: c["count"] for c in home["categories"]} == {"ألبان": 2, "بقالة": 1}

    page = client.get("/v1/store/public/elbaraka/products", params={"category": "ألبان", "sort": "price_asc"}).json()
    assert [p["name"] for p in page["items"]] == ["لبن جهينة", "جبنة رومي"]
    cheese = page["items"][1]
    assert cheese["step"] == 250 and cheese["available"] and cheese["max_qty"] is None
    # البحث يتسامح مع الهمزات
    assert client.get("/v1/store/public/elbaraka/products", params={"q": "ارز"}).json()["total"] == 1

    # إخفاء صنف ومنتج غير نشط في الكتالوج لا يظهران
    br["A"].patch(f"/v1/shop/store/products/{gids['rice']}", json={"is_published": False})
    assert client.get("/v1/store/public/elbaraka").json()["products_count"] == 2
    assert client.get(f"/v1/store/public/elbaraka/products/{gids['rice']}").status_code == 404

    # الأسعار تتبع الكتالوج مباشرة
    br["B"].post("/v1/catalog/push", json={"items": [
        {"kind": "product", "gid": gids["milk"], "data": product("لبن جهينة", 3800), "fields": ["sale_price"]},
    ]})  # fmt: skip
    assert client.get(f"/v1/store/public/elbaraka/products/{gids['milk']}").json()["product"]["price"] == 3800


def test_unpublished_store_is_hidden(client, store):
    br, _ = store
    br["A"].put("/v1/shop/store", json=settings(is_published=False))
    assert client.get("/v1/store/public/elbaraka").status_code == 404
    assert client.get("/v1/store/public/../admin").status_code == 404


# ================= الطلب =================
def test_order_prices_come_from_server(client, store):
    br, gids = store
    body = order(gids, items=[{"gid": gids["milk"], "qty": 2000}, {"gid": gids["cheese"], "qty": 750}])
    body["items"][0]["price"] = 1  # سعر من المتصفح = مرفوض (حقل غير مسموح)
    assert client.post("/v1/store/public/elbaraka/orders", json=body).status_code == 422
    del body["items"][0]["price"]
    r = client.post("/v1/store/public/elbaraka/orders", json=body)
    assert r.status_code == 201, r.text
    out = r.json()
    # 2 × 35 + 0.75 × 320 = 70 + 240 = 310 جنيه ≥ 500؟ لا ← رسوم التوصيل 20
    assert out["number"] == 1 and out["total"] == 7000 + 24000 + 2000

    track = client.get(f"/v1/store/public/elbaraka/orders/{out['token']}").json()
    assert track["status"] == "new" and track["can_cancel"] and len(track["lines"]) == 2
    assert "•" in track["phone"]  # الهاتف مخفي جزئياً

    detail = br["A"].get("/v1/shop/store/orders").json()
    assert detail["total"] == 1 and detail["items"][0]["phone"] == "01011112222"


def test_order_is_idempotent(client, store):
    _, gids = store
    body = order(gids)
    a = client.post("/v1/store/public/elbaraka/orders", json=body).json()
    b = client.post("/v1/store/public/elbaraka/orders", json=body).json()
    assert a["number"] == b["number"] and a["token"] == b["token"]
    other = client.post("/v1/store/public/elbaraka/orders", json=order(gids)).json()
    assert other["number"] == 2


def test_order_validation(client, store):
    br, gids = store
    url = "/v1/store/public/elbaraka/orders"
    # كمية كسرية لصنف بالقطعة
    assert client.post(url, json=order(gids, items=[{"gid": gids["milk"], "qty": 1500}])).json()["error"]["code"] == "qty_invalid"
    # أقل من الحد الأدنى (50 جنيه)
    r = client.post(url, json=order(gids, items=[{"gid": gids["milk"], "qty": 1000}]))
    assert r.json()["error"]["code"] == "below_minimum"
    # صنف من محل آخر/غير معروض
    assert client.post(url, json=order(gids, items=[{"gid": gid(), "qty": 1000}])).status_code == 409
    # حقل الفخ
    assert client.post(url, json=order(gids, website="http://spam")).status_code == 400
    # رقم هاتف غير صالح
    assert client.post(url, json=order(gids, phone="abc")).status_code == 422
    # المتجر لا يستقبل طلبات
    br["A"].put("/v1/shop/store", json=settings(accepting_orders=False))
    assert client.post(url, json=order(gids)).json()["error"]["code"] == "store_closed"


def test_free_delivery_threshold(client, store):
    _, gids = store
    r = client.post("/v1/store/public/elbaraka/orders", json=order(gids, items=[{"gid": gids["cheese"], "qty": 2000}]))
    assert r.json()["total"] == 64000  # ≥ 500 جنيه: توصيل مجاني


def test_order_rate_limit_per_phone(client, store, monkeypatch):
    from app.config import get_settings

    _, gids = store
    monkeypatch.setattr(get_settings(), "store_order_rate_per_phone", 2)
    url = "/v1/store/public/elbaraka/orders"
    assert client.post(url, json=order(gids)).status_code == 201
    assert client.post(url, json=order(gids)).status_code == 201
    assert client.post(url, json=order(gids)).status_code == 429
    assert client.post(url, json=order(gids, phone="01099998888")).status_code == 201


def test_bad_tracking_tokens(client, store):
    _, gids = store
    token = client.post("/v1/store/public/elbaraka/orders", json=order(gids)).json()["token"]
    assert client.get("/v1/store/public/elbaraka/orders/" + "0" * 40).status_code == 404
    assert client.get("/v1/store/public/elbaraka/orders/not-a-token").status_code == 404
    assert client.get(f"/v1/store/public/elbaraka/orders/{token}").status_code == 200


# ================= حالة الطلب =================
def test_status_flow_and_customer_cancel(client, store):
    br, gids = store
    url = "/v1/store/public/elbaraka/orders"
    first = client.post(url, json=order(gids)).json()
    oid = br["A"].get("/v1/shop/store/orders").json()["items"][0]["id"]

    st = lambda s, **kw: br["A"].post(f"/v1/shop/store/orders/{oid}/status", json={"status": s, **kw})  # noqa: E731
    assert st("delivered").status_code == 409  # لا قفز فوق الخطوات
    assert st("confirmed").json()["status"] == "confirmed"
    # العميل لا يلغي بعد التأكيد
    assert client.post(f"{url}/{first['token']}/cancel").status_code == 409
    assert st("cancelled").json()["error"]["code"] == "reason_required"
    assert st("delivering").json()["delivering_at"]
    assert st("delivered").json()["status"] == "delivered"
    assert st("cancelled", reason="x").status_code == 409  # مُغلق

    second = client.post(url, json=order(gids)).json()
    r = client.post(f"{url}/{second['token']}/cancel")
    assert r.json()["status"] == "cancelled" and r.json()["cancelled_by"] == "customer"

    summary = br["A"].get("/v1/shop/store/summary").json()
    assert summary["counts"]["delivered"] == 1 and summary["counts"]["cancelled"] == 1
    assert summary["today_orders"] == 1 and summary["today_sales"] == first["total"]
    assert summary["top_products"][0]["name"] == "لبن جهينة"


def test_orders_are_scoped_to_shop(client, store):
    br, gids = store
    client.post("/v1/store/public/elbaraka/orders", json=order(gids))
    oid = br["A"].get("/v1/shop/store/orders").json()["items"][0]["id"]
    from tests.conftest import BranchClient, admin
    from app.models import Branch

    s2 = admin(client, "POST", "/v1/admin/shops", json={"name": "محل آخر"}).json()
    creds = admin(client, "POST", f"/v1/admin/shops/{s2['id']}/branches", json={"name": "رئيسي", "code": "X"}).json()
    other = BranchClient(client, creds["branch_id"], creds["secret"])
    with db() as s:
        s.get(Branch, other.id).is_admin = True
        s.commit()
    assert other.get(f"/v1/shop/store/orders/{oid}").status_code == 404
    assert other.post(f"/v1/shop/store/orders/{oid}/status", json={"status": "confirmed"}).status_code == 404
    assert other.patch(f"/v1/shop/store/products/{gids['milk']}", json={"is_published": True}).status_code in (404, 409)


# ================= المخزون =================
def test_stock_from_fulfillment_branch_and_reservations(client, store):
    br, gids = store
    assert br["B"].get("/v1/store/stock-request").json()["gids"] == []  # ليس فرع التجهيز
    assert br["B"].post("/v1/store/stock", json={"items": []}).status_code == 403
    assert set(br["A"].get("/v1/store/stock-request").json()["gids"]) == set(gids.values())

    br["A"].post("/v1/store/stock", json={"items": [{"gid": gids["milk"], "qty": 3000}, {"gid": gids["rice"], "qty": 0}]})
    page = {p["gid"]: p for p in client.get("/v1/store/public/elbaraka/products").json()["items"]}
    assert page[gids["milk"]]["max_qty"] == 3000 and page[gids["milk"]]["low_stock"]
    assert page[gids["rice"]]["available"] is False

    url = "/v1/store/public/elbaraka/orders"
    big = order(gids, items=[{"gid": gids["milk"], "qty": 2000}, {"gid": gids["cheese"], "qty": 1000}])
    assert client.post(url, json=big).status_code == 201
    # المتبقي المتاح = 3 − 2 محجوزة = 1
    r = client.post(url, json=order(gids, items=[{"gid": gids["milk"], "qty": 2000}, {"gid": gids["cheese"], "qty": 1000}]))
    assert r.json()["error"]["code"] == "qty_exceeds" and r.json()["error"]["details"]["max_qty"] == 1000
    r = client.post(url, json=order(gids, items=[{"gid": gids["rice"], "qty": 2000}]))
    assert r.json()["error"]["code"] == "out_of_stock"

    # تغيير فرع التجهيز
    br["A"].put("/v1/shop/store", json=settings(fulfillment_branch_id=br["B"].id))
    assert br["A"].get("/v1/store/stock-request").json()["gids"] == []
    assert len(br["B"].get("/v1/store/stock-request").json()["gids"]) == 3


# ================= الصور =================
def test_images(client, store):
    br, gids = store
    up = lambda raw, ct="image/png": br["A"].post(  # noqa: E731
        "/v1/shop/store/images", json={"content_type": ct, "data": base64.b64encode(raw).decode()}
    )
    assert up(b"<svg onload=alert(1)>" + b" " * 40).json()["error"]["code"] == "image_invalid"
    assert up(PNG, "image/jpeg").json()["error"]["code"] == "image_invalid"  # النوع لا يطابق المحتوى
    img = up(PNG).json()["id"]
    assert br["A"].patch(f"/v1/shop/store/products/{gids['milk']}", json={"image_id": img}).status_code == 200

    p = client.get(f"/v1/store/public/elbaraka/products/{gids['milk']}").json()["product"]
    r = client.get(p["image_url"])
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert r.headers["x-content-type-options"] == "nosniff" and "sandbox" in r.headers["content-security-policy"]
    assert "immutable" in r.headers["cache-control"]

    # استبدال الصورة يحذف القديمة غير المستخدمة
    img2 = up(PNG).json()["id"]
    br["A"].patch(f"/v1/shop/store/products/{gids['milk']}", json={"image_id": img2})
    assert client.get(f"/v1/store/public/elbaraka/images/{img}").status_code == 404
    # صورة محل آخر لا تُربط
    assert br["A"].patch(f"/v1/shop/store/products/{gids['rice']}", json={"image_id": "f" * 32}).status_code == 400


def test_admin_products_listing(client, store):
    br, gids = store
    br["A"].patch(f"/v1/shop/store/products/{gids['rice']}", json={"is_published": False})
    out = br["A"].get("/v1/shop/store/products", params={"status": "published"}).json()
    assert out["total"] == 2 and out["published_count"] == 2 and out["categories"] == ["ألبان", "بقالة"]
    out = br["A"].get("/v1/shop/store/products", params={"q": "6221"}).json()
    assert [p["gid"] for p in out["items"]] == [gids["milk"]]


def test_quote_corrects_cart_before_order(client, store):
    br, gids = store
    br["A"].post("/v1/store/stock", json={"items": [{"gid": gids["milk"], "qty": 2000}, {"gid": gids["rice"], "qty": 0}]})
    body = {"items": [{"gid": gids["milk"], "qty": 5000}, {"gid": gids["rice"], "qty": 1000},
                      {"gid": gids["cheese"], "qty": 1000}, {"gid": gid(), "qty": 1000}]}  # fmt: skip
    r = client.post("/v1/store/public/elbaraka/quote", json=body)
    assert r.status_code == 200, r.text
    q = r.json()
    lines = {ln["gid"]: ln for ln in q["lines"]}
    assert lines[gids["milk"]]["qty"] == 2000 and gids["rice"] not in lines  # صُححت للمتاح، والنافد خرج
    assert {i["code"] for i in q["issues"]} == {"qty_exceeds", "out_of_stock", "product_unavailable"}
    assert q["subtotal"] == 7000 + 32000 and q["delivery_fee"] == 2000 and q["total"] == 41000
    # الطلب نفسه بنفس الكميات الأصلية يُرفض (لا تصحيح صامت عند الطلب)
    bad = order(gids, items=body["items"][:1])
    assert client.post("/v1/store/public/elbaraka/orders", json=bad).json()["error"]["code"] == "qty_exceeds"


# ================= التخصيص وصور الصنف =================
def _img(br):  # noqa: ANN001
    r = br["A"].post("/v1/shop/store/images", json={"content_type": "image/png", "data": base64.b64encode(PNG).decode()})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_theme_customization(client, store):
    br, _ = store
    cover = _img(br)
    r = br["A"].put("/v1/shop/store/theme", json={
        "color": "emerald", "mode": "dark", "cover_image_id": cover, "announcement": "  خصم 10%  على كل الطلبات ",
        "show_featured": False, "facebook": "fb.com/elbaraka", "instagram": "https://www.instagram.com/elbaraka/",
    })  # fmt: skip
    assert r.status_code == 200, r.text
    t = r.json()["theme"]
    assert t["color"] == "emerald" and t["announcement"] == "خصم 10% على كل الطلبات"
    assert t["facebook"] == "https://fb.com/elbaraka" and t["instagram"] == "https://www.instagram.com/elbaraka/"

    pub = client.get("/v1/store/public/elbaraka").json()["theme"]
    assert pub["mode"] == "dark" and pub["show_featured"] is False and pub["cover_url"].endswith(cover)

    # لون غير معروف، ورابط من موقع آخر أو بمحارف خطرة، مرفوض
    bad = [{"color": "#ff0000"}, {"facebook": "https://evil.com/x"}, {"instagram": "javascript:alert(1)"},
           {"tiktok": 'https://tiktok.com/@a"onmouseover=1'}, {"facebook": "https://user:pw@facebook.com/x"}]  # fmt: skip
    for body in bad:
        assert br["A"].put("/v1/shop/store/theme", json=body).status_code == 422, body

    # تغيير الغلاف يحذف القديم غير المستخدم
    br["A"].put("/v1/shop/store/theme", json={"color": "blue"})
    assert client.get(f"/v1/store/public/elbaraka/images/{cover}").status_code == 404
    assert br["B"].put("/v1/shop/store/theme", json={}).status_code == 403  # الجهاز الرئيسي فقط


def test_product_gallery(client, store):
    br, gids = store
    main, extra1, extra2 = _img(br), _img(br), _img(br)
    url = f"/v1/shop/store/products/{gids['milk']}"
    r = br["A"].patch(url, json={"image_id": main, "gallery": [extra1, extra2]})
    assert r.status_code == 200 and r.json()["gallery"] == [extra1, extra2]
    imgs = client.get(f"/v1/store/public/elbaraka/products/{gids['milk']}").json()["product"]["images"]
    assert [i.rsplit("/", 1)[1] for i in imgs] == [main, extra1, extra2]

    # جعل صورة إضافية رئيسية: لا تتكرر، والرئيسية القديمة المحذوفة تُمسح
    r = br["A"].patch(url, json={"image_id": extra1, "gallery": [extra2]})
    assert r.json()["image_id"] == extra1 and r.json()["gallery"] == [extra2]
    assert client.get(f"/v1/store/public/elbaraka/images/{main}").status_code == 404
    assert client.get(f"/v1/store/public/elbaraka/images/{extra2}").status_code == 200

    assert br["A"].patch(url, json={"gallery": [extra2, extra2]}).status_code == 422
    assert br["A"].patch(url, json={"gallery": [_img(br) for _ in range(6)]}).status_code == 422
    assert br["A"].patch(url, json={"gallery": ["f" * 32]}).status_code == 400  # صورة ليست لهذا المحل


def test_images_load_cross_origin_in_desktop_app(client, store):
    br, _ = store
    r = client.get(f"/v1/store/public/elbaraka/images/{_img(br)}")
    assert r.headers["cross-origin-resource-policy"] == "cross-origin"

"""الصنف كما يرفعه البرنامج الحالي (بعد دعم الضريبة والإيصال الإلكتروني) يُقبل، وفرع بنسخة أقدم لا يمسح حقوله.

السبب: السيرفر كان يرفض tax_type/tax_rate/eta_item_type/eta_item_code (نموذج صارم)، فلم يُرفع أي صنف.
"""

import uuid

# نفس مفاتيح backend/app/modules/branch_sync/catalog_sync.py:product_data حرفياً.
DESKTOP_PRODUCT = {
    "name": "بيبسي 1 لتر", "barcode": "6221031490213", "category": "مشروبات", "unit": "زجاجة",
    "allow_decimal": False, "sale_price": 2_500, "scale_code": None, "wholesale_price": 2_300,
    "wholesale_min_qty": 12_000, "track_expiry": True, "tax_type": "taxable", "tax_rate": 1400,
    "eta_item_type": "EGS", "eta_item_code": "EG-123456789-1", "is_active": True,
    "units": [{"name": "كرتونة", "factor": 12_000, "barcode": "6221031490299", "sale_price": 28_000}],
}  # fmt: skip
OLD_DESKTOP_PRODUCT = {k: v for k, v in DESKTOP_PRODUCT.items() if k not in ("tax_type", "tax_rate", "eta_item_type", "eta_item_code")}


def push(branch, item):
    [res] = branch.post("/v1/catalog/push", json={"items": [item]}).json()
    return res


def pulled(branch, gid):
    return next(i for i in branch.get("/v1/catalog/pull").json()["items"] if i["gid"] == gid)


def test_current_desktop_product_is_accepted(shop):
    _, br = shop
    gid = str(uuid.uuid4())
    res = push(br["A"], {"kind": "product", "gid": gid, "data": DESKTOP_PRODUCT})
    assert res["status"] == "ok", res
    item = pulled(br["B"], gid)
    assert item["data"] == DESKTOP_PRODUCT  # يصل للفروع الأخرى كاملاً


def test_old_branch_does_not_erase_tax_and_eta(shop):
    _, br = shop
    gid = str(uuid.uuid4())
    push(br["A"], {"kind": "product", "gid": gid, "data": DESKTOP_PRODUCT})
    # فرع بنسخة أقدم يعدّل السعر ويرفع السجل كاملاً بلا حقول الضريبة
    res = push(br["B"], {"kind": "product", "gid": gid, "data": {**OLD_DESKTOP_PRODUCT, "sale_price": 2_600}})
    assert res["status"] == "ok", res
    data = pulled(br["C"], gid)["data"]
    assert data["sale_price"] == 2_600
    assert (data["tax_type"], data["tax_rate"], data["eta_item_type"], data["eta_item_code"]) == (
        "taxable", 1400, "EGS", "EG-123456789-1",
    )  # fmt: skip
    # وصنف جديد من فرع أقدم: لا مفاتيح ضريبة مضافة بقيم فارغة (فلا يمسح شيئاً عند الفروع الأحدث)
    gid2 = str(uuid.uuid4())
    other = {**OLD_DESKTOP_PRODUCT, "name": "شيبسي", "barcode": "6221000000017", "units": []}
    assert push(br["B"], {"kind": "product", "gid": gid2, "data": other})["status"] == "ok"
    assert "eta_item_code" not in pulled(br["C"], gid2)["data"]


def test_invalid_tax_values_rejected(shop):
    _, br = shop
    for bad in ({"tax_type": "free"}, {"tax_rate": 20_000}, {"eta_item_type": "XYZ"}, {"eta_item_code": "x" * 101}):
        res = push(br["A"], {"kind": "product", "gid": str(uuid.uuid4()), "data": {**DESKTOP_PRODUCT, **bad,
                                                                                   "barcode": None, "name": str(uuid.uuid4())}})  # fmt: skip
        assert res["status"] == "invalid", bad

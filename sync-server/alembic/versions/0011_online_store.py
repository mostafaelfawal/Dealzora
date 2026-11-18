"""المتجر الإلكتروني: إعدادات المتجر، الأصناف المعروضة، الصور، وطلبات الدفع عند الاستلام
(جداول جديدة فقط، لا تغيير في الموجود)

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-18 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "stores",
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("slug", sa.String(length=40), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("tagline", sa.String(length=160), nullable=True),
        sa.Column("about", sa.String(length=600), nullable=True),
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("whatsapp", sa.String(length=16), nullable=True),
        sa.Column("city", sa.String(length=60), nullable=True),
        sa.Column("address", sa.String(length=200), nullable=True),
        sa.Column("hours", sa.String(length=120), nullable=True),
        sa.Column("currency", sa.String(length=8), server_default="ج.م", nullable=False),
        sa.Column("logo_image_id", sa.String(length=32), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("accepting_orders", sa.Boolean(), nullable=False),
        sa.Column("delivery_fee", sa.BigInteger(), nullable=False),
        sa.Column("free_delivery_over", sa.BigInteger(), nullable=True),
        sa.Column("min_order", sa.BigInteger(), nullable=False),
        sa.Column("delivery_note", sa.String(length=200), nullable=True),
        sa.Column("fulfillment_branch_id", sa.String(length=36), nullable=True),
        sa.Column("last_order_no", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_stores_shop_id_shops")),
        sa.ForeignKeyConstraint(
            ["fulfillment_branch_id"], ["branches.id"], name=op.f("fk_stores_fulfillment_branch_id_branches")
        ),
        sa.PrimaryKeyConstraint("shop_id", name=op.f("pk_stores")),
        sa.UniqueConstraint("slug", name=op.f("uq_stores_slug")),
    )

    op.create_table(
        "store_products",
        sa.Column("gid", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("featured", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("image_id", sa.String(length=32), nullable=True),
        sa.Column("max_qty", sa.BigInteger(), nullable=True),
        sa.Column("stock_qty", sa.BigInteger(), nullable=True),
        sa.Column("stock_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["gid"], ["catalog_items.id"], name=op.f("fk_store_products_gid_catalog_items")),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_store_products_shop_id_shops")),
        sa.PrimaryKeyConstraint("gid", name=op.f("pk_store_products")),
    )
    op.create_index(op.f("ix_store_products_shop_id"), "store_products", ["shop_id"], unique=False)
    op.create_index(
        "ix_store_products_shop_published", "store_products", ["shop_id", "is_published"], unique=False
    )

    op.create_table(
        "store_images",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("content_type", sa.String(length=16), nullable=False),
        sa.Column("data", sa.LargeBinary(), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_store_images_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_store_images")),
    )
    op.create_index(op.f("ix_store_images_shop_id"), "store_images", ["shop_id"], unique=False)

    op.create_table(
        "store_orders",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("shop_id", sa.String(length=36), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("client_ref", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("customer_name", sa.String(length=80), nullable=False),
        sa.Column("phone", sa.String(length=16), nullable=False),
        sa.Column("city", sa.String(length=60), nullable=True),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("notes", sa.String(length=300), nullable=True),
        sa.Column("subtotal", sa.BigInteger(), nullable=False),
        sa.Column("delivery_fee", sa.BigInteger(), nullable=False),
        sa.Column("total", sa.BigInteger(), nullable=False),
        sa.Column("items_count", sa.Integer(), nullable=False),
        sa.Column("cancel_reason", sa.String(length=200), nullable=True),
        sa.Column("cancelled_by", sa.String(length=12), nullable=True),
        sa.Column("owner_note", sa.String(length=300), nullable=True),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivering_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["shop_id"], ["shops.id"], name=op.f("fk_store_orders_shop_id_shops")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_store_orders")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_store_orders_token_hash")),
        sa.UniqueConstraint("shop_id", "number", name="uq_store_orders_shop_number"),
        sa.UniqueConstraint("shop_id", "client_ref", name="uq_store_orders_shop_ref"),
    )
    op.create_index("ix_store_orders_shop_status", "store_orders", ["shop_id", "status", "created_at"], unique=False)
    op.create_index("ix_store_orders_shop_phone", "store_orders", ["shop_id", "phone", "created_at"], unique=False)

    op.create_table(
        "store_order_lines",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("order_id", sa.String(length=36), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("gid", sa.String(length=36), nullable=False),
        sa.Column("barcode", sa.String(length=32), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("unit", sa.String(length=30), nullable=False),
        sa.Column("unit_price", sa.BigInteger(), nullable=False),
        sa.Column("qty", sa.BigInteger(), nullable=False),
        sa.Column("line_total", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["order_id"], ["store_orders.id"], name=op.f("fk_store_order_lines_order_id_store_orders")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_store_order_lines")),
    )
    op.create_index(op.f("ix_store_order_lines_order_id"), "store_order_lines", ["order_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_store_order_lines_order_id"), table_name="store_order_lines")
    op.drop_table("store_order_lines")
    op.drop_index("ix_store_orders_shop_phone", table_name="store_orders")
    op.drop_index("ix_store_orders_shop_status", table_name="store_orders")
    op.drop_table("store_orders")
    op.drop_index(op.f("ix_store_images_shop_id"), table_name="store_images")
    op.drop_table("store_images")
    op.drop_index("ix_store_products_shop_published", table_name="store_products")
    op.drop_index(op.f("ix_store_products_shop_id"), table_name="store_products")
    op.drop_table("store_products")
    op.drop_table("stores")

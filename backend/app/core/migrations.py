"""تشغيل Alembic برمجياً عند الإقلاع."""

from pathlib import Path

from alembic import command
from alembic.config import Config

# backend/ (فيه alembic.ini ومجلد alembic)
_ROOT = Path(__file__).resolve().parents[2]


def run_migrations() -> None:
    cfg = Config(str(_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(_ROOT / "alembic"))
    command.upgrade(cfg, "head")
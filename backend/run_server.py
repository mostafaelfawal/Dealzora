"""نقطة التشغيل: python main.py"""

import uvicorn

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",  # محلي فقط، مش متاح للشبكة
        port=8000,
        reload=settings.debug,  # إعادة تشغيل تلقائي وقت التطوير فقط
        log_level="debug" if settings.debug else "info",
    )


if __name__ == "__main__":
    main()
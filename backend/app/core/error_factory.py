"""مصنع أخطاء موحّد: يربط كود الخطأ برسالته العربية في جدول ERROR_MESSAGES الخاص بكل موديول."""

from collections.abc import Callable, Mapping
from enum import StrEnum

from .errors import AppError


def make_error_factory(
    messages: Mapping[StrEnum, str],
) -> Callable[..., AppError]:
    """الاستخدام (في auth/shop/users وأي service لا يرث EntityService):
        _err = make_error_factory(ERROR_MESSAGES)
        raise _err(NotFoundError, ShopError.NOT_FOUND, id=x)
    """

    def _err(exc: type[AppError], code: StrEnum, **details) -> AppError:
        return exc(code=code.value, message=messages[code], details=details or None)

    return _err
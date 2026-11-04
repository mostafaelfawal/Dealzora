"""قواعد التحقق الخاصة بالدخول. قواعد إنشاء الحسابات وكلمات المرور الجديدة في users."""

from typing import Annotated

from pydantic import AfterValidator, Field

from app.core.passwords import MAX_PASSWORD_LEN
from app.modules.users.constants import MAX_USERNAME_LEN
from app.modules.users.helper import normalize_username

# اسم الدخول: نوحّده فقط ولا نفحص النمط (حتى لا نكشف القواعد لمن يخمّن).
LoginUsername = Annotated[
    str, Field(min_length=1, max_length=MAX_USERNAME_LEN), AfterValidator(normalize_username)
]
LoginPassword = Annotated[str, Field(min_length=1, max_length=MAX_PASSWORD_LEN)]
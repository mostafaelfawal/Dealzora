"""أنواع التحقق الخاصة بالموردين (مبنية على core.validation: الحدود والرسائل فقط هنا)."""

from app.core.validation import (  # noqa: F401  (Money/PositiveMoney تُستورد من هنا في schema)
    Money,
    PositiveMoney,
    optional_phone,
    optional_text,
    required_text,
)

from .constants import MAX_ADDRESS_LEN, MAX_NAME_LEN, MAX_NOTE_LEN, MAX_NOTES_LEN, PHONE_PATTERN

Name = required_text("اسم المورد", MAX_NAME_LEN)
OptionalPhone = optional_phone(
    PHONE_PATTERN, "رقم الهاتف غير صالح (أرقام فقط، من 7 إلى 15 رقماً)"
)
OptionalAddress = optional_text("العنوان", MAX_ADDRESS_LEN)
OptionalNotes = optional_text("الملاحظات", MAX_NOTES_LEN)
OptionalTxnNote = optional_text("الملاحظة", MAX_NOTE_LEN)
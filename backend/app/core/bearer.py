"""استخراج توكن Bearer من الهيدر (مكان واحد بدل التكرار في security و auth)."""

from typing import Annotated

from fastapi import Header

from .errors import UnauthorizedError


def get_bearer_token(authorization: Annotated[str | None, Header()] = None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise UnauthorizedError("unauthorized", "سجّل الدخول أولاً")
    return token
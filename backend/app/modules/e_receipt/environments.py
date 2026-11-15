"""عناوين بيئتي المنظومة (المكان الوحيد في البرنامج). الاختيار نفسه في إعدادات المحل (eta.config.environment).

المصدر: https://sdk.invoicing.eta.gov.eg/faq/ (How to set up environment to access test APIs and test portals?)
  Identity Service: PreProd https://id.preprod.eta.gov.eg          | Prod https://id.eta.gov.eg
  System API:       PreProd https://api.preprod.invoicing.eta.gov.eg | Prod https://api.invoicing.eta.gov.eg
المسارات من صفحات ereceiptapi: POST /connect/token (01)، POST /api/v1/receiptsubmissions (02)،
GET /api/v1/receiptsubmissions/{uuid}/details (06)، GET /api/v1/receipts/{uuid}/details (03).

البيئة التجريبية بشهادة جذرية داخلية للمصلحة (certs/preprod-root-ca.crt) نثق بها لعناوينها فقط.
"""

import hashlib
import ssl
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from app.modules.eta.constants import EtaEnvironment

_CERTS = Path(__file__).parent / "certs"
PREPROD_CA_FILE = _CERTS / "preprod-root-ca.crt"
PREPROD_CA_SHA256 = "c3702c5a6dd2e6b7aa989e7333b2a7222568d6a2d1b513911026b246f5ea0000"  # بصمة الشهادة (DER)

TOKEN_PATH = "/connect/token"
SUBMIT_PATH = "/api/v1/receiptsubmissions"
SUBMISSION_PATH = "/api/v1/receiptsubmissions/{uuid}/details"
RECEIPT_DETAILS_PATH = "/api/v1/receipts/{uuid}/details"


@dataclass(frozen=True, slots=True)
class Environment:
    key: EtaEnvironment
    identity_url: str
    api_url: str
    extra_ca: Path | None  # شهادة جذرية إضافية للثقة (التجريبية فقط)


ENVIRONMENTS: dict[EtaEnvironment, Environment] = {
    EtaEnvironment.PREPROD: Environment(
        EtaEnvironment.PREPROD, "https://id.preprod.eta.gov.eg", "https://api.preprod.invoicing.eta.gov.eg", PREPROD_CA_FILE
    ),
    EtaEnvironment.PROD: Environment(
        EtaEnvironment.PROD, "https://id.eta.gov.eg", "https://api.invoicing.eta.gov.eg", None
    ),
}


@lru_cache
def ssl_context(key: EtaEnvironment) -> ssl.SSLContext:
    """شهادات النظام دائماً + شهادة التجريبية لعناوين التجريبية فقط (بعد التأكد من بصمتها)."""
    context = ssl.create_default_context()
    extra = ENVIRONMENTS[key].extra_ca
    if extra is not None:
        der = extra.read_bytes()
        if hashlib.sha256(der).hexdigest() != PREPROD_CA_SHA256:
            raise RuntimeError("شهادة البيئة التجريبية المضمّنة تغيّرت عن الأصل")
        context.load_verify_locations(cadata=der)
    return context

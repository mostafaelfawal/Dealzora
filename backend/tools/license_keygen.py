"""أداة البائع (واجهة رسومية): توليد زوج المفاتيح وإصدار مفاتيح الترخيص.
المفتاح الخاص لا يغادر جهازك أبداً.

التشغيل:  python license_keygen_gui.py
المتطلبات: pip install customtkinter cryptography
"""

import base64
import json
import re
import time
import uuid
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox

import customtkinter as ctk
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)

LIFETIME_UNIX = 4_102_444_800  # سنة 2100
DAY = 86_400
APP_DIR = Path(__file__).resolve().parent
DEFAULT_KEY = APP_DIR / "vendor_private.key"
HISTORY_FILE = APP_DIR / "issued_licenses.jsonl"
MACHINE_ID_RE = re.compile(r"[0-9a-f]{64}")

PRESETS = {"30 يوم": 30, "90 يوم": 90, "سنة": 365, "مدى الحياة": 0, "مخصص": -1}

FONT = "Segoe UI"


# ---------------- المنطق (نفس صيغة license_keygen.py و license.rs) ----------------
def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def load_private_key(path: Path) -> Ed25519PrivateKey:
    if not path.is_file():
        raise ValueError("ملف المفتاح الخاص غير موجود")
    raw = path.read_bytes()
    if len(raw) != 32:
        raise ValueError("ملف المفتاح الخاص غير صالح (لازم 32 بايت)")
    return Ed25519PrivateKey.from_private_bytes(raw)


def public_key_b64(key: Ed25519PrivateKey) -> str:
    return b64(key.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw))


def generate_keypair(path: Path) -> str:
    if path.exists():
        raise ValueError("الملف موجود بالفعل. لن يتم الكتابة فوقه حفاظاً على المفتاح القديم")
    key = Ed25519PrivateKey.generate()
    path.write_bytes(key.private_bytes(Encoding.Raw, PrivateFormat.Raw, NoEncryption()))
    return public_key_b64(key)


MAX_TERMINALS = 50
# الخطط المدفوعة (المجانية «بَسطة» لا تحتاج مفتاحاً). الاسم المعروض ← القيمة في الترخيص.
PLANS = {"دُكّان": "basic", "سوق": "pro", "سلسلة": "enterprise"}


def issue_license(
    key: Ed25519PrivateKey,
    machine_id: str,
    shop: str,
    expires: int,
    terminals: int = 0,
    plan: str = "pro",
) -> tuple[str, dict]:
    payload = {
        "license_id": str(uuid.uuid4()),
        "machine_id": machine_id,  # الجهاز الأساسي
        "shop_name": shop,
        "expires_at": expires,
        # أجهزة الكاشير الإضافية المسموح باتصالها بالجهاز الأساسي (للتسعير).
        "terminals": terminals,
        "plan": plan,  # basic | pro | enterprise
    }
    body = b64(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode())
    return f"{body}.{b64(key.sign(body.encode()))}", payload


def append_history(payload: dict, license_key: str) -> None:
    record = {**payload, "issued_at": int(time.time()), "key": license_key}
    with HISTORY_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def read_history() -> list[dict]:
    if not HISTORY_FILE.is_file():
        return []
    rows = []
    for line in HISTORY_FILE.read_text(encoding="utf-8").splitlines():
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows[::-1]  # الأحدث أولاً


def fmt_date(ts: int) -> str:
    return "مدى الحياة" if ts >= LIFETIME_UNIX else datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


# ---------------- الواجهة ----------------
class App(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Dealzora - إصدار التراخيص")
        self.geometry("760x780")
        self.minsize(700, 720)
        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.key_path = ctk.StringVar(value=str(DEFAULT_KEY))
        self.machine_id = ctk.StringVar()
        self.shop = ctk.StringVar()
        self.preset = ctk.StringVar(value="سنة")
        self.custom_days = ctk.StringVar(value="365")
        self.terminals = ctk.StringVar(value="0")
        self.plan = ctk.StringVar(value="سوق")
        self.status = ctk.StringVar(value="")

        tabs = ctk.CTkTabview(self)
        tabs.pack(fill="both", expand=True, padx=14, pady=14)
        self.issue_tab = tabs.add("إصدار مفتاح")
        self.history_tab = tabs.add("السجل")
        self.keys_tab = tabs.add("المفاتيح")
        tabs.configure(command=lambda: self.refresh_history() if tabs.get() == "السجل" else None)

        self._build_issue_tab()
        self._build_history_tab()
        self._build_keys_tab()

    # ---------- مساعدات ----------
    @staticmethod
    def _label(parent, text: str) -> ctk.CTkLabel:
        return ctk.CTkLabel(parent, text=text, anchor="e", justify="right", font=(FONT, 14))

    def _set_status(self, text: str, ok: bool = True) -> None:
        self.status.set(text)
        self.status_label.configure(text_color="#4ade80" if ok else "#f87171")

    # ---------- تبويب الإصدار ----------
    def _build_issue_tab(self) -> None:
        t = self.issue_tab

        self._label(t, "ملف المفتاح الخاص").pack(fill="x", padx=10, pady=(10, 2))
        row = ctk.CTkFrame(t, fg_color="transparent")
        row.pack(fill="x", padx=10)
        ctk.CTkButton(row, text="اختيار...", width=90, command=self.pick_key).pack(side="left")
        ctk.CTkEntry(row, textvariable=self.key_path, justify="left").pack(
            side="left", fill="x", expand=True, padx=(8, 0)
        )

        self._label(t, "Machine ID (من شاشة التفعيل عند العميل)").pack(fill="x", padx=10, pady=(14, 2))
        row = ctk.CTkFrame(t, fg_color="transparent")
        row.pack(fill="x", padx=10)
        ctk.CTkButton(row, text="لصق", width=90, command=self.paste_machine_id).pack(side="left")
        ctk.CTkEntry(row, textvariable=self.machine_id, justify="left", font=("Consolas", 12)).pack(
            side="left", fill="x", expand=True, padx=(8, 0)
        )

        self._label(t, "اسم المحل").pack(fill="x", padx=10, pady=(14, 2))
        ctk.CTkEntry(t, textvariable=self.shop, justify="right", font=(FONT, 14)).pack(fill="x", padx=10)

        self._label(t, "مدة الترخيص").pack(fill="x", padx=10, pady=(14, 2))
        ctk.CTkSegmentedButton(
            t, values=list(PRESETS), variable=self.preset, command=self._on_preset
        ).pack(fill="x", padx=10)
        self.custom_row = ctk.CTkFrame(t, fg_color="transparent")
        self.custom_row.pack(fill="x", padx=10, pady=(8, 0))
        self._label(self.custom_row, "عدد الأيام").pack(side="right", padx=(8, 0))
        self.custom_entry = ctk.CTkEntry(self.custom_row, textvariable=self.custom_days, width=100, justify="center")
        self.custom_entry.pack(side="right")
        self.custom_entry.configure(state="disabled")

        self._label(t, "الخطة").pack(fill="x", padx=10, pady=(14, 2))
        ctk.CTkSegmentedButton(t, values=list(PLANS), variable=self.plan).pack(fill="x", padx=10)

        row = ctk.CTkFrame(t, fg_color="transparent")
        row.pack(fill="x", padx=10, pady=(14, 0))
        self._label(row, "عدد أجهزة الكاشير الإضافية (0 = الجهاز الأساسي فقط)").pack(side="right", padx=(8, 0))
        ctk.CTkEntry(row, textvariable=self.terminals, width=100, justify="center").pack(side="right")

        ctk.CTkButton(
            t, text="إصدار المفتاح", height=42, font=(FONT, 15, "bold"), command=self.issue
        ).pack(fill="x", padx=10, pady=(18, 6))

        self.status_label = ctk.CTkLabel(t, textvariable=self.status, anchor="e", justify="right", font=(FONT, 13))
        self.status_label.pack(fill="x", padx=10)

        self._label(t, "مفتاح الترخيص (ابعته للعميل)").pack(fill="x", padx=10, pady=(10, 2))
        self.output = ctk.CTkTextbox(t, height=150, font=("Consolas", 11), wrap="char")
        self.output.pack(fill="both", expand=True, padx=10)
        self.copy_btn = ctk.CTkButton(t, text="نسخ المفتاح", command=self.copy_output, state="disabled")
        self.copy_btn.pack(fill="x", padx=10, pady=10)

    def _on_preset(self, value: str) -> None:
        self.custom_entry.configure(state="normal" if PRESETS[value] == -1 else "disabled")

    def pick_key(self) -> None:
        path = filedialog.askopenfilename(
            title="اختر vendor_private.key", filetypes=[("Key", "*.key"), ("All", "*.*")]
        )
        if path:
            self.key_path.set(path)

    def paste_machine_id(self) -> None:
        try:
            self.machine_id.set(self.clipboard_get().strip())
        except Exception:
            self._set_status("الحافظة فاضية", ok=False)

    def issue(self) -> None:
        mid = self.machine_id.get().strip().lower()
        shop = " ".join(self.shop.get().split())

        if not MACHINE_ID_RE.fullmatch(mid):
            return self._set_status("Machine ID لازم يكون 64 حرف hex", ok=False)
        if not 2 <= len(shop) <= 100:
            return self._set_status("اسم المحل من 2 إلى 100 حرف", ok=False)

        days = PRESETS[self.preset.get()]
        if days == -1:
            try:
                days = int(self.custom_days.get())
                if not 1 <= days <= 36_500:
                    raise ValueError
            except ValueError:
                return self._set_status("عدد الأيام لازم يكون رقم من 1 إلى 36500", ok=False)
        expires = LIFETIME_UNIX if days == 0 else int(time.time()) + days * DAY
        try:
            terminals = int(self.terminals.get())
            if not 0 <= terminals <= MAX_TERMINALS:
                raise ValueError
        except ValueError:
            return self._set_status(f"عدد أجهزة الكاشير من 0 إلى {MAX_TERMINALS}", ok=False)

        try:
            key = load_private_key(Path(self.key_path.get().strip()))
            license_key, payload = issue_license(key, mid, shop, expires, terminals, PLANS[self.plan.get()])
            append_history(payload, license_key)
        except Exception as exc:
            return self._set_status(f"فشل الإصدار: {exc}", ok=False)

        self.output.delete("1.0", "end")
        self.output.insert("1.0", license_key)
        self.copy_btn.configure(state="normal")
        self._set_status(f"تم الإصدار لـ «{shop}» - ينتهي: {fmt_date(expires)} - {self.plan.get()} - أجهزة كاشير: {terminals}")

    def copy_output(self) -> None:
        text = self.output.get("1.0", "end").strip()
        if text:
            self.clipboard_clear()
            self.clipboard_append(text)
            self._set_status("تم نسخ المفتاح")

    # ---------- تبويب السجل ----------
    def _build_history_tab(self) -> None:
        t = self.history_tab
        top = ctk.CTkFrame(t, fg_color="transparent")
        top.pack(fill="x", padx=10, pady=(10, 4))
        ctk.CTkButton(top, text="تحديث", width=90, command=self.refresh_history).pack(side="left")
        self._label(top, f"الملف: {HISTORY_FILE.name}").pack(side="right")
        self.history_box = ctk.CTkScrollableFrame(t)
        self.history_box.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.refresh_history()

    def refresh_history(self) -> None:
        for w in self.history_box.winfo_children():
            w.destroy()
        rows = read_history()
        if not rows:
            self._label(self.history_box, "لا توجد تراخيص صادرة بعد").pack(fill="x", pady=20)
            return
        for r in rows:
            card = ctk.CTkFrame(self.history_box)
            card.pack(fill="x", pady=4)
            title = (
                f"{r.get('shop_name', '?')}  |  ينتهي: {fmt_date(r.get('expires_at', 0))}"
                f"  |  أجهزة كاشير: {r.get('terminals', 0)}"
            )
            self._label(card, title).pack(fill="x", padx=10, pady=(8, 0))
            sub = f"صدر: {datetime.fromtimestamp(r.get('issued_at', 0)).strftime('%Y-%m-%d %H:%M')}  |  {r.get('machine_id', '')[:16]}..."
            ctk.CTkLabel(card, text=sub, anchor="e", font=("Consolas", 11), text_color="gray").pack(fill="x", padx=10)
            ctk.CTkButton(
                card, text="نسخ المفتاح", height=26, width=110,
                command=lambda k=r.get("key", ""): self._copy(k),
            ).pack(anchor="w", padx=10, pady=8)

    def _copy(self, text: str) -> None:
        self.clipboard_clear()
        self.clipboard_append(text)

    # ---------- تبويب المفاتيح ----------
    def _build_keys_tab(self) -> None:
        t = self.keys_tab
        self._label(t, "المفتاح العام (DEALZORA_VENDOR_PUBKEY)").pack(fill="x", padx=10, pady=(10, 2))
        self.pub_entry = ctk.CTkEntry(t, font=("Consolas", 12), justify="left")
        self.pub_entry.pack(fill="x", padx=10)
        row = ctk.CTkFrame(t, fg_color="transparent")
        row.pack(fill="x", padx=10, pady=8)
        ctk.CTkButton(row, text="عرض المفتاح العام", command=self.show_pubkey).pack(side="right")
        ctk.CTkButton(row, text="نسخ", width=80, command=self.copy_pubkey).pack(side="right", padx=8)

        ctk.CTkFrame(t, height=2).pack(fill="x", padx=10, pady=16)

        self._label(t, "توليد زوج مفاتيح جديد").pack(fill="x", padx=10)
        warn = ctk.CTkLabel(
            t,
            text="تحذير: تغيير المفتاح معناه إن كل نسخ البرنامج المبنية بالمفتاح القديم مش هتقبل التراخيص الجديدة.\nالتوليد مش بيكتب فوق ملف موجود.",
            anchor="e", justify="right", text_color="#fbbf24", wraplength=640, font=(FONT, 12),
        )
        warn.pack(fill="x", padx=10, pady=6)
        ctk.CTkButton(t, text="توليد مفاتيح جديدة...", fg_color="#b45309", hover_color="#92400e",
                      command=self.new_keypair).pack(fill="x", padx=10)

    def show_pubkey(self) -> None:
        try:
            pub = public_key_b64(load_private_key(Path(self.key_path.get().strip())))
        except Exception as exc:
            return messagebox.showerror("خطأ", str(exc))
        self.pub_entry.delete(0, "end")
        self.pub_entry.insert(0, pub)

    def copy_pubkey(self) -> None:
        text = self.pub_entry.get().strip()
        if text:
            self._copy(text)

    def new_keypair(self) -> None:
        path = filedialog.asksaveasfilename(
            title="مكان حفظ المفتاح الخاص الجديد", defaultextension=".key",
            initialfile="vendor_private.key", filetypes=[("Key", "*.key")],
        )
        if not path:
            return
        if not messagebox.askyesno("تأكيد", "هتولّد مفتاح جديد. متأكد؟"):
            return
        try:
            pub = generate_keypair(Path(path))
        except Exception as exc:
            return messagebox.showerror("خطأ", str(exc))
        self.key_path.set(path)
        self.pub_entry.delete(0, "end")
        self.pub_entry.insert(0, pub)
        messagebox.showinfo(
            "تم", "اتولد المفتاح. انسخ المفتاح العام وحطه في DEALZORA_VENDOR_PUBKEY،\nواحفظ الملف الخاص في مكان آمن."
        )


if __name__ == "__main__":
    App().mainloop()
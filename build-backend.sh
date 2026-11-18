#!/usr/bin/env bash
# نسخة ماك/لينكس من build-backend.ps1: يبني الـ backend بـ PyInstaller، ينقله إلى
# src-tauri/binaries باسم الـ target triple، ثم يبني تطبيق Tauri (dmg على ماك، AppImage على لينكس).
# التشغيل من أي مكان:  ./build-backend.sh [--skip-backend | --backend-only]
#   --skip-backend : يتخطى بناء الـ backend ويبني الـ frontend فقط.
#   --backend-only : يبني الـ backend فقط (يستخدمه GitHub Actions قبل tauri-action).
#
# TARGET_TRIPLE (اختياري): المعمارية المطلوبة، الافتراضي معمارية هذا الجهاز (rustc -vV).
# PyInstaller لا يبني لمعمارية أخرى: ابنِ نسخة Intel على جهاز Intel ونسخة Apple Silicon على M1+.
#
# التحديث التلقائي: البناء يوقّع الحزمة بمفتاح التحديثات. محلياً يُقرأ من
# ~/.tauri/dealzora-updater.key لو TAURI_SIGNING_PRIVATE_KEY غير موجود.

set -euo pipefail

SKIP_BACKEND=0
BACKEND_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --skip-backend) SKIP_BACKEND=1 ;;
        --backend-only) BACKEND_ONLY=1 ;;
        *) echo "خيار غير معروف: $arg" >&2; exit 2 ;;
    esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
BIN="$FRONTEND/src-tauri/binaries"

TRIPLE="${TARGET_TRIPLE:-$(rustc -vV | sed -n 's/^host: //p')}"
if [ -z "$TRIPLE" ]; then
    echo "تعذّر تحديد الـ target triple (هل Rust مثبّت؟). عرّف TARGET_TRIPLE يدوياً." >&2
    exit 1
fi
TARGET="$BIN/dealzora-backend-$TRIPLE"

# ---------------- 1) الـ backend ----------------
if [ "$SKIP_BACKEND" -eq 0 ]; then
    PYTHON="$BACKEND/.venv/bin/python"
    [ -x "$PYTHON" ] || PYTHON="$(command -v python3 || command -v python)"

    rm -rf "$BACKEND/build" "$BACKEND/dist" "$BACKEND/dealzora-backend.spec"

    # المفتاح العام لشهادات الفروع مثبّت في app/core/build_keys.py (ليس سرياً).
    # DEALZORA_SYNC_LEASE_PUBKEY اختياري: يستبدله لهذا البناء فقط.
    KEYS_FILE="$BACKEND/app/core/build_keys.py"
    KEYS_BACKUP="$(mktemp)"
    cp "$KEYS_FILE" "$KEYS_BACKUP"
    # نرجّع الملف كما كان مهما حدث (المفتاح لا يُحفظ في git)
    trap 'cp "$KEYS_BACKUP" "$KEYS_FILE"; rm -f "$KEYS_BACKUP"' EXIT

    if [ -n "${DEALZORA_SYNC_LEASE_PUBKEY:-}" ]; then
        if ! [[ "$DEALZORA_SYNC_LEASE_PUBKEY" =~ ^[A-Za-z0-9_-]{40,60}$ ]]; then
            echo "DEALZORA_SYNC_LEASE_PUBKEY غير صالح" >&2
            exit 1
        fi
        "$PYTHON" - "$KEYS_FILE" "$DEALZORA_SYNC_LEASE_PUBKEY" <<'PY'
import re, sys
path, key = sys.argv[1], sys.argv[2]
src = open(path, encoding="utf-8").read()
open(path, "w", encoding="utf-8", newline="").write(
    re.sub(r'SYNC_LEASE_PUBKEY = ".*"', f'SYNC_LEASE_PUBKEY = "{key}"', src)
)
PY
    elif grep -q 'SYNC_LEASE_PUBKEY = ""' "$KEYS_FILE"; then
        echo "تحذير: مفتاح شهادات الفروع فارغ في build_keys.py: أجهزة الفروع لن ترث خطة المحل في هذه النسخة." >&2
    fi

    # بدون --noconsole: على ماك يُنشئ حزمة .app لا نحتاجها، والبرنامج يشغّله بلا نافذة طرفية أصلاً.
    (
        cd "$BACKEND"
        "$PYTHON" -m PyInstaller --noconfirm --clean --onefile \
            --name dealzora-backend \
            --collect-all sqlcipher3 \
            --collect-submodules app \
            --add-data "app/modules/eta/codes:app/modules/eta/codes" \
            run_server.py
    )

    mkdir -p "$BIN"
    cp "$BACKEND/dist/dealzora-backend" "$TARGET"
    chmod +x "$TARGET"
    echo
    echo "Backend -> $TARGET"
fi

[ "$BACKEND_ONLY" -eq 1 ] && exit 0

# ---------------- 2) الـ frontend (Tauri) ----------------
if [ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]; then
    UPDATER_KEY="$HOME/.tauri/dealzora-updater.key"
    if [ ! -f "$UPDATER_KEY" ]; then
        echo "مفتاح توقيع التحديثات غير موجود: $UPDATER_KEY (أو عرّف TAURI_SIGNING_PRIVATE_KEY)" >&2
        exit 1
    fi
    TAURI_SIGNING_PRIVATE_KEY="$(cat "$UPDATER_KEY")"
    export TAURI_SIGNING_PRIVATE_KEY
    export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
fi

cd "$FRONTEND"
rm -rf "$FRONTEND/out"
npm run tauri:build -- --target "$TRIPLE"

echo
echo "Done -> $FRONTEND/src-tauri/target/$TRIPLE/release/bundle"

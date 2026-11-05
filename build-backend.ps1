# يبني الـ backend بـ PyInstaller، ينقله لـ src-tauri/binaries، ثم يبني تطبيق Tauri.
# المكان: جذر المشروع (جنب مجلدي backend و frontend). التشغيل من أي مكان.
# -SkipBackend : يتخطى بناء الـ backend ويبني الـ frontend بس.

param([switch]$SkipBackend)

$ErrorActionPreference = "Stop"

$root     = $PSScriptRoot
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$bin      = Join-Path $frontend "src-tauri\binaries"
$triple   = "x86_64-pc-windows-msvc"
$target   = Join-Path $bin "dealzora-backend-$triple.exe"

# ---------------- 1) الـ backend ----------------
if (-not $SkipBackend) {
    # يستخدم python الخاص بالـ venv لو موجود، وإلا python العادي
    $python = Join-Path $backend ".venv\Scripts\python.exe"
    if (-not (Test-Path $python)) { $python = "python" }

    # تنظيف مخلفات البناء القديم
    foreach ($name in @("build", "dist", "dealzora-backend.spec")) {
        Remove-Item (Join-Path $backend $name) -Recurse -Force -ErrorAction SilentlyContinue
    }

    Push-Location $backend
    try {
        & $python -m PyInstaller --noconfirm --clean --onefile --noconsole `
            --name dealzora-backend `
            --collect-all sqlcipher3 `
            --collect-submodules app `
            run_server.py
        if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed (exit code $LASTEXITCODE)" }

        New-Item -ItemType Directory -Force $bin | Out-Null
        Copy-Item "dist\dealzora-backend.exe" $target -Force
        Write-Host "`nBackend -> $target" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

# ---------------- 2) الـ frontend (Tauri) ----------------
Push-Location $frontend
try {
    Remove-Item (Join-Path $frontend "out") -Recurse -Force -ErrorAction SilentlyContinue

    npm run tauri:build
    if ($LASTEXITCODE -ne 0) { throw "tauri:build failed (exit code $LASTEXITCODE)" }

    Write-Host "`nDone -> $(Join-Path $frontend 'src-tauri\target\release\bundle')" -ForegroundColor Green
}
finally {
    Pop-Location
}
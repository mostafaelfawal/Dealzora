//! حفظ الملفات المصدَّرة (Excel…) في مجلد التنزيلات وفتح مكانها.
//!
//! داخل Tauri لا نعتمد على <a download>: WebView2 يتعامل معه بنفسه بدون أي تأكيد
//! للواجهة. هنا نكتب الملف بأنفسنا ونرجّع مساره الفعلي، فرسالة النجاح لا تظهر إلا بعد الحفظ.

use std::path::{Path, PathBuf};

use tauri::{ipc::Request, AppHandle, Manager};

/// الامتدادات المسموح بحفظها فقط (لا نكتب ملفات تنفيذية أبداً).
const ALLOWED_EXTENSIONS: &[&str] = &["xlsx", "xls", "csv", "pdf"];
const MAX_BYTES: usize = 50 * 1024 * 1024;
const NAME_HEADER: &str = "x-file-name";

fn downloads_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().download_dir().map_err(|e| e.to_string())
}

/// اسم ملف آمن: بدون مسارات أو رموز ممنوعة في ويندوز، وبامتداد من القائمة البيضاء.
fn sanitize_file_name(raw: &str) -> Result<String, String> {
    let name: String = raw
        .chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') && !c.is_control())
        .collect();
    let name = name.trim().trim_matches('.').to_string();
    let ext = Path::new(&name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if name.is_empty() || name.len() > 120 || !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err("invalid_file_name".into());
    }
    Ok(name)
}

/// لو الاسم موجود: "products (1).xlsx"، "products (2).xlsx"… مثل المتصفح.
fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if !first.exists() {
        return first;
    }
    let path = Path::new(name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
    (1..1000)
        .map(|i| dir.join(format!("{stem} ({i}).{ext}")))
        .find(|p| !p.exists())
        .unwrap_or(first)
}

/// الجسم = بايتات الملف (raw)، والاسم في الهيدر x-file-name (مُرمَّز URI).
/// يرجّع المسار الكامل للملف بعد حفظه.
#[tauri::command]
pub fn save_download(app: AppHandle, request: Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("expected_raw_body".into());
    };
    if bytes.is_empty() || bytes.len() > MAX_BYTES {
        return Err("invalid_file_size".into());
    }
    let encoded = request
        .headers()
        .get(NAME_HEADER)
        .and_then(|v| v.to_str().ok())
        .ok_or("missing_file_name")?;
    let decoded = percent_decode(encoded)?;
    let name = sanitize_file_name(&decoded)?;

    let dir = downloads_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = unique_path(&dir, &name);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

/// يفتح مستكشف الملفات على الملف (محدَّداً). مسموح فقط لملفات داخل مجلد التنزيلات.
#[tauri::command]
pub fn reveal_download(app: AppHandle, path: String) -> Result<(), String> {
    let dir = downloads_dir(&app)?.canonicalize().map_err(|e| e.to_string())?;
    let file = PathBuf::from(&path).canonicalize().map_err(|e| e.to_string())?;
    if !file.starts_with(&dir) || !file.is_file() {
        return Err("path_not_allowed".into());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        // canonicalize يضيف بادئة \\?\ التي لا يفهمها explorer.
        let display = file.to_string_lossy().trim_start_matches(r"\\?\").to_string();
        std::process::Command::new("explorer")
            .arg(format!("/select,{display}"))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open").arg(&dir).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// فك ترميز encodeURIComponent (الأسماء العربية) بدون مكتبة إضافية.
fn percent_decode(input: &str) -> Result<String, String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|e| e.to_string())?;
            out.push(u8::from_str_radix(hex, 16).map_err(|e| e.to_string())?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|e| e.to_string())
}

//! تحويل مستند HTML (تقرير A4 جاهز من الواجهة) إلى ملف PDF في مجلد التنزيلات.
//!
//! نستخدم Microsoft Edge الموجود في كل ويندوز 10/11 في الوضع الخفي (headless):
//! نفس محرك WebView2 الذي يعرض البرنامج، فالعربي والرسوم (SVG) والخطوط تطلع مطابقة،
//! والـ PDF متجه (نص حقيقي قابل للبحث والنسخ)، ويدعم ‎@page‎ (ترويسة وأرقام صفحات).
//! لا يحتاج أي مكتبة أو برنامج إضافي.

use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use rand::{distributions::Alphanumeric, Rng};
use tauri::AppHandle;

use crate::downloads::{downloads_dir, sanitize_file_name, unique_path};

/// أقصى حجم للمستند (الخطوط مضمّنة فيه).
const MAX_HTML_BYTES: usize = 40 * 1024 * 1024;
/// أقصى مدة لتجهيز الملف قبل الإلغاء.
const TIMEOUT: Duration = Duration::from_secs(120);

/// يرجّع المسار الكامل لملف الـ PDF بعد حفظه.
#[tauri::command]
pub async fn html_to_pdf(app: AppHandle, html: String, file_name: String) -> Result<String, String> {
    if html.is_empty() || html.len() > MAX_HTML_BYTES {
        return Err("invalid_document_size".into());
    }
    let name = sanitize_file_name(&file_name)?;
    if !name.to_ascii_lowercase().ends_with(".pdf") {
        return Err("invalid_file_name".into());
    }
    let dir = downloads_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let out = unique_path(&dir, &name);

    tauri::async_runtime
        ::spawn_blocking(move || render(&html, &out).map(|()| out.to_string_lossy().into_owned())).await
        .map_err(|e| e.to_string())?
}

fn render(html: &str, out: &Path) -> Result<(), String> {
    let edge = find_edge().ok_or("edge_not_found")?;
    let suffix: String = rand::thread_rng().sample_iter(&Alphanumeric).take(10).map(char::from).collect();
    let work = std::env::temp_dir().join(format!("dealzora-pdf-{suffix}"));
    std::fs::create_dir_all(&work).map_err(|e| e.to_string())?;
    let result = (|| {
        let page = work.join("report.html");
        std::fs::write(&page, html).map_err(|e| e.to_string())?;
        let url = tauri::Url::from_file_path(&page).map_err(|_| "invalid_temp_path".to_string())?;
        run_edge(&edge, &work.join("profile"), &url, out)?;
        let ok = std::fs::metadata(out).map(|m| m.len() > 0).unwrap_or(false);
        if ok { Ok(()) } else { Err("pdf_not_created".to_string()) }
    })();
    // Edge قد يمسك ملفات الملف الشخصي لحظات بعد الخروج: فشل الحذف لا يهم.
    let _ = std::fs::remove_dir_all(&work);
    if result.is_err() {
        let _ = std::fs::remove_file(out);
    }
    result
}

fn run_edge(edge: &Path, profile: &Path, url: &tauri::Url, out: &Path) -> Result<(), String> {
    let mut cmd = std::process::Command::new(edge);
    cmd.arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--disable-extensions")
        .arg("--disable-sync")
        // ملف شخصي مؤقت: لا يتعارض مع Edge مفتوح عند المستخدم ولا يلمس بياناته.
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg("--no-pdf-header-footer")
        .arg(format!("--print-to-pdf={}", out.display()))
        .arg(url.as_str());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("edge_start_failed: {e}"))?;
    let started = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            return if status.success() { Ok(()) } else { Err("edge_failed".into()) };
        }
        if started.elapsed() > TIMEOUT {
            let _ = child.kill();
            return Err("pdf_timeout".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

/// مكان msedge.exe: المسارات المعتادة ثم سجل ويندوز (App Paths).
fn find_edge() -> Option<PathBuf> {
    let rel = r"Microsoft\Edge\Application\msedge.exe";
    let from_env = ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"]
        .iter()
        .filter_map(|var| std::env::var_os(var))
        .map(|base| PathBuf::from(base).join(rel));
    from_env.chain(edge_from_registry()).find(|p| p.is_file())
}

#[cfg(windows)]
fn edge_from_registry() -> Option<PathBuf> {
    use winreg::{enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE}, RegKey};
    let key = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe";
    [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER].into_iter().find_map(|hive| {
        RegKey::predef(hive).open_subkey(key).ok()?.get_value::<String, _>("").ok().map(PathBuf::from)
    })
}

#[cfg(not(windows))]
fn edge_from_registry() -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    #[test]
    fn renders_arabic_a4() {
        let out = std::env::temp_dir().join("dealzora-pdf-test.pdf");
        let _ = std::fs::remove_file(&out);
        let html = r#"<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
            @page { size: A4; margin: 15mm; @bottom-center { content: "صفحة " counter(page) " من " counter(pages) } }
            </style></head><body><h1>تقرير تجريبي</h1></body></html>"#;
        super::render(html, &out).expect("render pdf");
        let bytes = std::fs::read(&out).expect("pdf written");
        assert!(bytes.starts_with(b"%PDF"));
        println!("pdf bytes={} at {}", bytes.len(), out.display());
    }
}

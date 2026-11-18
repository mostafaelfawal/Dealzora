//! طباعة فاتورة A4 فوراً على طابعة باسمها، بدون نافذة الطباعة.
//!
//! نفس محرك العرض (WebView2) يطبع المستند: نافذة مخفية خارج الشاشة تحمّل الفاتورة من ملف مؤقت،
//! وبعد اكتمال التحميل نستدعي ICoreWebView2_16::Print بإعدادات فيها اسم الطابعة.
//! النتيجة نفس المعاينة تماماً (العربي، الشعار، تقسيم الصفحات بـ @page و break-inside)،
//! ونص متجه حاد، بدون أي برنامج إضافي.
//!
//! يحتاج WebView2 Runtime 1.0.1518 أو أحدث (2023). الأقدم: نرجع خطأ والواجهة تفتح نافذة الطباعة.

#[cfg(windows)]
use std::time::Duration;

use tauri::AppHandle;

/// أقصى مدة للتحميل + إرسال المهمة للطابعة (ويندوز فقط: WebView2).
#[cfg(windows)]
const TIMEOUT: Duration = Duration::from_secs(45);
const MAX_HTML_BYTES: usize = 20 * 1024 * 1024;

#[tauri::command]
pub async fn print_html_silent(
    app: AppHandle,
    html: String,
    printer: String,
    job_name: String,
) -> Result<(), String> {
    if html.is_empty() || html.len() > MAX_HTML_BYTES {
        return Err("invalid_document_size".into());
    }
    if printer.trim().is_empty() || printer.len() > 300 {
        return Err("no_printer".into());
    }
    imp::print(app, html, printer, job_name).await
}

#[cfg(windows)]
mod imp {
    use std::sync::{ Arc, Mutex };

    use rand::{ distributions::Alphanumeric, Rng };
    use tauri::{ webview::PageLoadEvent, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder };
    use tokio::sync::oneshot;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment6,
        ICoreWebView2PrintSettings2,
        ICoreWebView2_16,
        COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT,
        COREWEBVIEW2_PRINT_STATUS,
        COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE,
        COREWEBVIEW2_PRINT_STATUS_SUCCEEDED,
    };
    use webview2_com::PrintCompletedHandler;
    use windows_core::{ Interface, HSTRING };

    use super::TIMEOUT;

    /// 12mm بالبوصة.
    const MARGIN_INCHES: f64 = 12.0 / 25.4;

    type Done = Arc<Mutex<Option<oneshot::Sender<Result<(), String>>>>>;

    fn finish(done: &Done, result: Result<(), String>) {
        if let Some(tx) = done.lock().unwrap().take() {
            let _ = tx.send(result);
        }
    }

    pub async fn print(
        app: AppHandle,
        html: String,
        printer: String,
        job_name: String
    ) -> Result<(), String> {
        let suffix: String = rand::thread_rng().sample_iter(&Alphanumeric).take(10).map(char::from).collect();
        let dir = std::env::temp_dir().join(format!("dealzora-print-{suffix}"));
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let page = dir.join("invoice.html");
        std::fs::write(&page, html).map_err(|e| e.to_string())?;
        let url = tauri::Url::from_file_path(&page).map_err(|_| "invalid_temp_path".to_string())?;

        let (tx, rx) = oneshot::channel();
        let done: Done = Arc::new(Mutex::new(Some(tx)));
        let label = format!("print-{}", suffix.to_lowercase());

        let on_load = done.clone();
        let printer_name = printer.clone();
        // نافذة حقيقية خارج الشاشة (لا مخفية): WebView2 يوقف الرسم في النوافذ المخفية.
        let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url))
            .title(job_name)
            .inner_size(794.0, 1123.0)
            .position(-32000.0, -32000.0)
            .decorations(false)
            .skip_taskbar(true)
            .focused(false)
            .on_page_load(move |window, payload| {
                if payload.event() != PageLoadEvent::Finished {
                    return;
                }
                let done = on_load.clone();
                let printer = printer_name.clone();
                let started = window.with_webview(move |webview| {
                    if let Err(e) = start_print(&webview, &printer, done.clone()) {
                        finish(&done, Err(e));
                    }
                });
                if let Err(e) = started {
                    finish(&on_load, Err(e.to_string()));
                }
            })
            .build()
            .map_err(|e| e.to_string());

        let result = match window {
            Err(e) => Err(e),
            Ok(_) =>
                match tokio::time::timeout(TIMEOUT, rx).await {
                    Ok(Ok(r)) => r,
                    Ok(Err(_)) => Err("print_cancelled".into()),
                    Err(_) => Err("print_timeout".into()),
                }
        };

        if let Some(w) = app.get_webview_window(&label) {
            let _ = w.close();
        }
        // WebView2 قد يمسك الملف لحظات بعد الإغلاق: فشل الحذف لا يهم.
        let _ = std::fs::remove_dir_all(&dir);
        result
    }

    /// يُستدعى على خيط الواجهة بعد اكتمال تحميل الفاتورة.
    fn start_print(
        webview: &tauri::webview::PlatformWebview,
        printer: &str,
        done: Done
    ) -> Result<(), String> {
        let unsupported = |_| "webview2_print_unsupported".to_string();
        // SAFETY: واجهات COM من WebView2 نفسه على خيط الواجهة الذي أنشأها.
        unsafe {
            let core = webview.controller().CoreWebView2().map_err(|e| e.to_string())?;
            let core16: ICoreWebView2_16 = core.cast().map_err(unsupported)?;
            let env6: ICoreWebView2Environment6 = webview.environment().cast().map_err(unsupported)?;

            let settings = env6.CreatePrintSettings().map_err(|e| e.to_string())?;
            settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT).map_err(|e| e.to_string())?;
            settings.SetShouldPrintHeaderAndFooter(false).map_err(|e| e.to_string())?;
            settings.SetShouldPrintBackgrounds(true).map_err(|e| e.to_string())?;
            // نفس هوامش @page في الفاتورة (12mm): أياً كان المصدر الذي يعتمده المحرك، النتيجة واحدة.
            for set in [
                ICoreWebView2PrintSettingsMargins::Top,
                ICoreWebView2PrintSettingsMargins::Bottom,
                ICoreWebView2PrintSettingsMargins::Left,
                ICoreWebView2PrintSettingsMargins::Right,
            ] {
                set.apply(&settings, MARGIN_INCHES).map_err(|e| e.to_string())?;
            }
            let settings2: ICoreWebView2PrintSettings2 = settings.cast().map_err(unsupported)?;
            settings2.SetPrinterName(&HSTRING::from(printer)).map_err(|e| e.to_string())?;

            let handler = PrintCompletedHandler::create(
                Box::new(move |hr, status: COREWEBVIEW2_PRINT_STATUS| {
                    let result = match hr {
                        Err(e) => Err(e.to_string()),
                        Ok(()) if status == COREWEBVIEW2_PRINT_STATUS_SUCCEEDED => Ok(()),
                        Ok(()) if status == COREWEBVIEW2_PRINT_STATUS_PRINTER_UNAVAILABLE =>
                            Err("printer_unavailable".into()),
                        Ok(()) => Err("print_failed".into()),
                    };
                    finish(&done, result);
                    Ok(())
                })
            );
            core16.Print(&settings, &handler).map_err(|e| e.to_string())
        }
    }

    /// هوامش الطباعة بالبوصة (لكل جهة دالة مختلفة في الواجهة).
    enum ICoreWebView2PrintSettingsMargins {
        Top,
        Bottom,
        Left,
        Right,
    }

    impl ICoreWebView2PrintSettingsMargins {
        unsafe fn apply(
            &self,
            s: &webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2PrintSettings,
            inches: f64
        ) -> windows_core::Result<()> {
            unsafe {
                match self {
                    Self::Top => s.SetMarginTop(inches),
                    Self::Bottom => s.SetMarginBottom(inches),
                    Self::Left => s.SetMarginLeft(inches),
                    Self::Right => s.SetMarginRight(inches),
                }
            }
        }
    }
}

#[cfg(not(windows))]
mod imp {
    use tauri::AppHandle;

    pub async fn print(_: AppHandle, _: String, _: String, _: String) -> Result<(), String> {
        Err("webview2_print_unsupported".into())
    }
}

//! التحديث التلقائي من GitHub Releases (tauri-plugin-updater).
//!
//! البرنامج يقرأ latest.json من آخر Release، ويتحقق من توقيع المُثبّت بالمفتاح العام
//! في tauri.conf.json قبل تشغيله (ملف غير موقّع بمفتاحنا = يُرفض).
//!
//! الترتيب مهم: ننزّل التحديث كاملاً والبرنامج شغال عادي، وبعدها فقط نوقف الـ backend
//! (عشان المُثبّت يقدر يستبدل dealzora-backend.exe) ونشغّل المُثبّت. لو التثبيت فشل
//! نرجّع الـ backend فوراً فالتاجر يكمل شغله.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{ ipc::Channel, AppHandle, State };
use tauri_plugin_updater::{ Update, UpdaterExt };

/// التحديث الذي وجده آخر فحص، ينتظر موافقة المستخدم.
#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<Update>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    version: String,
    current_version: String,
    notes: Option<String>,
    date: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "camelCase")]
pub enum DownloadEvent {
    #[serde(rename_all = "camelCase")] Started {
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")] Progress {
        chunk_length: usize,
    },
    Finished,
}

/// يفحص GitHub: null لو البرنامج على آخر نسخة.
#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>
) -> Result<Option<UpdateInfo>, String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check().await
        .map_err(|e| e.to_string())?;
    let info = update.as_ref().map(|u| UpdateInfo {
        version: u.version.clone(),
        current_version: u.current_version.clone(),
        notes: u.body.clone(),
        date: u.date.map(|d| d.to_string()),
    });
    *pending.0.lock().unwrap() = update;
    Ok(info)
}

/// ينزّل التحديث (مع تقدم التحميل للواجهة) ثم يثبّته. على ويندوز المُثبّت يقفل البرنامج
/// ويثبّت النسخة الجديدة ويفتحها تلقائياً.
#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    on_event: Channel<DownloadEvent>
) -> Result<(), String> {
    let update = pending.0.lock().unwrap().take();
    let Some(update) = update else {
        return Err("no_pending_update".into());
    };

    let mut started = false;
    let bytes = update
        .download(
            |chunk_length, content_length| {
                if !started {
                    started = true;
                    let _ = on_event.send(DownloadEvent::Started { content_length });
                }
                let _ = on_event.send(DownloadEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(DownloadEvent::Finished);
            }
        ).await
        .map_err(|e| e.to_string())?;

    crate::app_log(&format!("installing update {}", update.version));
    crate::stop_backend(&app);
    // بدون هذا يقتل الـ Job المُثبّتَ لحظة خروج البرنامج، فتبقى النسخة القديمة كما هي.
    crate::set_kill_children_on_exit(false);
    if let Err(e) = update.install(bytes) {
        crate::app_log(&format!("update install failed: {e}"));
        crate::set_kill_children_on_exit(true);
        crate::restart_backend(&app);
        return Err(e.to_string());
    }
    // ويندوز لا يصل هنا (المُثبّت يُنهي البرنامج). باقي الأنظمة: نعيد التشغيل بالنسخة الجديدة.
    app.restart()
}

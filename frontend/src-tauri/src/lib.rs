mod device;
mod downloads;
mod hardware;
mod license;

use std::process::Child;
use std::sync::Mutex;

use hmac::{ Hmac, Mac };
use rand::{ distributions::Alphanumeric, Rng };
use sha2::Sha256;
use tauri::{ AppHandle, Manager, RunEvent, State };

struct AppState {
    session_token: String,
    permit_secret: String,
    backend: Mutex<Option<Child>>,
}

fn random_secret(len: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(len).map(char::from).collect()
}

#[tauri::command]
fn get_session_token(state: State<AppState>) -> String {
    state.session_token.clone()
}

#[tauri::command]
fn get_write_permit(state: State<AppState>) -> Result<String, String> {
    let expires = license::permit_expiry()?; // هيفشل لو الترخيص مش متفعل

    let mut mac = Hmac::<Sha256>
        ::new_from_slice(state.permit_secret.as_bytes())
        .map_err(|e| e.to_string())?;
    mac.update(expires.to_string().as_bytes());
    Ok(format!("{}.{}", expires, hex::encode(mac.finalize().into_bytes())))
}

/// عقد ترخيص لأجهزة الكاشير، تسلّمه واجهة الجهاز الأساسي للـ backend كل دقيقتين.
/// الصيغة: "<expires>.<max_terminals>.<hmac(permit_secret, "lease|exp|max")>".
#[tauri::command]
fn get_license_lease(state: State<AppState>) -> Result<String, String> {
    if device::load().mode != device::Mode::Main {
        return Err("not_main_device".into());
    }
    let (expires, terminals) = license::lease_terms()?;
    // الخطة ونهايتها داخل العقد الموقّع: الـ backend يعرف الخطة فوراً بعد التفعيل
    // (حتى لو لم يشغّله Rust، كما في التطوير)، ولا يمكن تزويرها بدون سر التصريح.
    let (plan, plan_expires) = license::plan_terms();
    let plan_expires = plan_expires.unwrap_or(0);
    let mut mac = Hmac::<Sha256>
        ::new_from_slice(state.permit_secret.as_bytes())
        .map_err(|e| e.to_string())?;
    mac.update(format!("lease|{expires}|{terminals}|{plan}|{plan_expires}").as_bytes());
    Ok(
        format!(
            "{expires}.{terminals}.{plan}.{plan_expires}.{}",
            hex::encode(mac.finalize().into_bytes())
        )
    )
}

/* ---------- وضع الجهاز (أساسي / كاشير) ---------- */

#[tauri::command]
fn get_device_config() -> device::DeviceConfig {
    device::load()
}

/// يوقف الـ backend المحلي ويشغّله من جديد حسب device.json الحالي (أو لا يشغّله لجهاز الكاشير).
/// نفس توكن الجلسة وسر التصريح: الواجهة المفتوحة وجلسة المستخدم تبقى صالحة (لا خروج ولا إعادة تشغيل للبرنامج).
/// في التطوير الـ backend يعمل من VS Code فلا شيء يتغير هنا (POS_HOST من .env).
fn restart_backend(app: &AppHandle) {
    let state: State<AppState> = app.state();
    let mut slot = state.backend.lock().unwrap();
    if let Some(mut child) = slot.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
    *slot = spawn_backend(&state.session_token, &state.permit_secret);
}

/// بعد نجاح الاقتران مع الجهاز الأساسي: يتحول هذا الجهاز لكاشير (يتوقف الـ backend المحلي).
/// الواجهة تعيد تحميل الصفحة بعدها لتقرأ الوضع الجديد.
#[tauri::command]
fn connect_to_main(
    app: AppHandle,
    main_url: String,
    device_token: String,
    device_name: String
) -> Result<(), String> {
    if device_token.len() < 20 || device_token.len() > 200 {
        return Err("invalid_device_token".into());
    }
    let cfg = device::DeviceConfig {
        mode: device::Mode::Terminal,
        lan_enabled: false,
        main_url: Some(device::validate_main_url(&main_url)?),
        device_token: Some(device_token),
        device_name: Some(device::validate_name(&device_name)?),
    };
    device::save(&cfg)?;
    restart_backend(&app);
    Ok(())
}

/// فصل جهاز الكاشير والرجوع لجهاز مستقل/أساسي (قاعدة بيانات محلية).
#[tauri::command]
fn disconnect_from_main(app: AppHandle) -> Result<(), String> {
    device::save(&device::DeviceConfig::default())?;
    restart_backend(&app); // يرجع الـ backend المحلي بقاعدة هذا الجهاز
    Ok(())
}

/// الجهاز الأساسي: السماح لأجهزة الكاشير بالاتصال عبر الشبكة (يعيد تشغيل الـ backend على 0.0.0.0).
#[tauri::command]
fn set_lan_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    let mut cfg = device::load();
    if cfg.mode != device::Mode::Main {
        return Err("not_main_device".into());
    }
    cfg.lan_enabled = enabled;
    device::save(&cfg)?;
    restart_backend(&app); // يستمع الآن على 0.0.0.0 (أو 127.0.0.1)
    Ok(())
}

#[tauri::command]
fn get_license_status() -> Result<license::Status, String> {
    license::status()
}

#[tauri::command]
fn start_trial(shop_name: String) -> Result<license::Status, String> {
    license::start_trial(&shop_name)
}

/// بعد التفعيل تتغير الخطة (بَسطة ← مدفوعة): نعيد تشغيل الـ backend ليقرأ POS_PLAN الجديد.
#[tauri::command]
fn activate_license(app: AppHandle, key: String) -> Result<license::Status, String> {
    let status = license::activate(&key)?;
    restart_backend(&app);
    Ok(status)
}

/// يضع عملية التطبيق في Job عليه KILL_ON_JOB_CLOSE: كل عملية نشغّلها بعد كده (الـ backend
/// وأي عمليات فرعية له، حتى bootloader بتاع PyInstaller) تموت أوتوماتيك لما التطبيق يموت،
/// سواء قفل عادي أو crash أو إنهاء من Task Manager.
#[cfg(all(windows, not(debug_assertions)))]
fn bind_children_to_app_lifetime() {
    use win32job::Job;

    let Ok(job) = Job::create() else {
        return;
    };
    let Ok(mut info) = job.query_extended_limit_info() else {
        return;
    };
    info.limit_kill_on_job_close();
    if job.set_extended_limit_info(&mut info).is_err() {
        return;
    }
    if job.assign_current_process().is_ok() {
        // لازم الـ handle يفضل مفتوح لحد ما العملية تموت. لو اتعمله drop الـ Job هيقفل ويقتل كل حاجة فوراً.
        std::mem::forget(job);
    }
}

#[cfg(not(all(windows, not(debug_assertions))))]
fn bind_children_to_app_lifetime() {}

#[cfg(not(debug_assertions))]
fn spawn_backend(session_token: &str, permit_secret: &str) -> Option<Child> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let cfg = device::load();
    if cfg.mode == device::Mode::Terminal {
        return None; // جهاز كاشير: البيانات على الجهاز الأساسي
    }
    // كل سبب فشل يُكتب في logs\app.log (بدلاً من واجهة لا تستجيب بلا تفسير).
    let fail = |why: String| {
        app_log(&format!("backend not started: {why}"));
        None
    };
    let exe = match std::env::current_exe() {
        Ok(p) => p.with_file_name("dealzora-backend.exe"),
        Err(e) => return fail(e.to_string()),
    };
    if !exe.is_file() {
        return fail(format!("missing {}", exe.display()));
    }
    let db_password = match license::db_password() {
        Ok(p) => p,
        Err(e) => return fail(format!("db_password: {e}")),
    };
    let device_id = match license::device_id() {
        Ok(d) => d,
        Err(e) => return fail(format!("device_id: {e}")),
    };
    // 0.0.0.0 فقط لو المدير سمح لأجهزة الكاشير. كل طلب يحتاج توكن جهاز في الحالتين.
    let host = if cfg.lan_enabled { "0.0.0.0" } else { "127.0.0.1" };
    let (plan, plan_expires_at) = license::plan_terms();
    let mut cmd = Command::new(&exe);
    cmd
        .env("POS_SESSION_TOKEN", session_token)
        .env("POS_WRITE_PERMIT_SECRET", permit_secret)
        .env("POS_DB_PASSWORD", db_password)
        .env("POS_DEVICE_ID", device_id)
        .env("POS_HOST", host)
        .env("POS_PLAN", plan)
        .env("POS_DEBUG", "false")
        .creation_flags(CREATE_NO_WINDOW);
    if let Some(at) = plan_expires_at {
        cmd.env("POS_PLAN_EXPIRES_AT", at.to_string());
    }
    let spawned = cmd.spawn();
    match spawned {
        Ok(child) => {
            app_log(&format!("backend started pid={} host={host}", child.id()));
            Some(child)
        }
        Err(e) => fail(format!("spawn: {e}")),
    }
}

/// سطر في %LOCALAPPDATA%\Dealzora\logs\app.log (تشخيص مشاكل التشغيل عند العميل).
#[cfg_attr(debug_assertions, allow(dead_code))]
fn app_log(msg: &str) {
    use std::io::Write;
    let Some(dir) = std::env::var("LOCALAPPDATA").ok().map(|p| std::path::PathBuf::from(p).join("Dealzora").join("logs")) else {
        return;
    };
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("app.log")) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let _ = writeln!(f, "{now} {msg}");
    }
}

/// حالة الـ backend المحلي للواجهة: لو توقف نعرض سبباً واضحاً بدل شاشة معلّقة.
#[derive(serde::Serialize)]
struct BackendState {
    /// running | exited | not_started | external (التطوير: يعمل من VS Code) | terminal
    state: &'static str,
    exit_code: Option<i32>,
    log_dir: Option<String>,
}

#[tauri::command]
fn get_backend_state(state: State<AppState>) -> BackendState {
    let log_dir = std::env::var("LOCALAPPDATA")
        .ok()
        .map(|p| format!("{p}\\Dealzora\\logs"));
    if device::load().mode == device::Mode::Terminal {
        return BackendState { state: "terminal", exit_code: None, log_dir };
    }
    if cfg!(debug_assertions) {
        return BackendState { state: "external", exit_code: None, log_dir };
    }
    let mut slot = state.backend.lock().unwrap();
    match slot.as_mut() {
        None => BackendState { state: "not_started", exit_code: None, log_dir },
        Some(child) =>
            match child.try_wait() {
                Ok(Some(status)) => BackendState { state: "exited", exit_code: status.code(), log_dir },
                _ => BackendState { state: "running", exit_code: None, log_dir },
            }
    }
}

#[cfg(debug_assertions)]
fn spawn_backend(_: &str, _: &str) -> Option<Child> {
    None // في التطوير الـ backend بيشتغل من VS Code task
}

#[cfg(debug_assertions)]
#[tauri::command]
fn reset_license_dev() -> Result<(), String> {
    license::reset_dev()
}

/// نسخة الإنتاج: الأمر مسجّل في generate_handler لكل البنايات، فلازم يوجد، لكنه مرفوض دائماً.
/// (بدونه يفشل `tauri build`.)
#[cfg(not(debug_assertions))]
#[tauri::command]
fn reset_license_dev() -> Result<(), String> {
    Err("not_available".into())
}

/// يفتح رابط واتساب فقط (قائمة بيضاء) في المتصفح/التطبيق الافتراضي لإرسال الفاتورة.
/// rundll32 لا يمر عبر cmd، فلا يوجد حقن أوامر، والرابط مُرمَّز بالكامل من الواجهة.
#[tauri::command]
fn open_whatsapp(url: String) -> Result<(), String> {
    if !url.starts_with("https://wa.me/") {
        return Err("invalid_url".into());
    }
    launch_url(&url)
}

/// بادئات الروابط الخارجية المسموح فتحها من الواجهة (قائمة بيضاء).
/// كل بادئة تنتهي بـ "/" عشان مايتقبلش مثلاً https://x.com.evil.com.
const ALLOWED_EXTERNAL_PREFIXES: &[&str] = &[
    "https://wa.me/",
    "https://chat.whatsapp.com/",
    "https://www.facebook.com/",
    "https://www.instagram.com/",
    "https://www.youtube.com/",
    "https://www.tiktok.com/",
    "https://x.com/",
];

/// يفتح رابطاً خارجياً (من القائمة البيضاء) أو رقم تليفون tel: في البرنامج الافتراضي.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let is_tel = url
        .strip_prefix("tel:")
        .is_some_and(|n| !n.is_empty() && n.chars().all(|c| c.is_ascii_digit() || c == '+'));
    let allowed = is_tel || ALLOWED_EXTERNAL_PREFIXES.iter().any(|p| url.starts_with(p));
    if !allowed {
        return Err("invalid_url".into());
    }
    launch_url(&url)
}

fn launch_url(url: &str) -> Result<(), String> {
    let safe = url.len() <= 4096 && url.chars().all(|c| c.is_ascii_graphic());
    if !safe {
        return Err("invalid_url".into());
    }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open").arg(url).spawn().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn run() {
    let (session_token, permit_secret) = if cfg!(debug_assertions) {
        ("dealzora-app-session".to_string(), "dealzora-app-secret".to_string())
    } else {
        (random_secret(48), random_secret(48))
    };

    // لازم قبل spawn_backend: العمليات الفرعية بترث الـ Job وقت إنشائها.
    bind_children_to_app_lifetime();
    let backend = spawn_backend(&session_token, &permit_secret);

    tauri::Builder
        ::default()
        // نافذة اختيار مجلد/ملف (مكان النسخ الاحتياطي والاستعادة).
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            session_token,
            permit_secret,
            backend: Mutex::new(backend),
        })
        .invoke_handler(
            tauri::generate_handler![
                get_session_token,
                get_write_permit,
                get_license_status,
                get_license_lease,
                get_device_config,
                get_backend_state,
                connect_to_main,
                disconnect_from_main,
                set_lan_enabled,
                start_trial,
                activate_license,
                reset_license_dev,
                open_whatsapp,
                open_external,
                downloads::save_download,
                downloads::reveal_download,
                hardware::get_hardware_info
            ]
        )
        .build(tauri::generate_context!())
        .expect("error while building tauri app")
        .run(|app, event| {
            // قفل عادي: نقتل الـ backend صراحةً (الـ Job هو شبكة الأمان للحالات الأخرى).
            if let RunEvent::Exit = event {
                let state: State<AppState> = app.state();
                if let Some(mut child) = state.backend.lock().unwrap().take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}

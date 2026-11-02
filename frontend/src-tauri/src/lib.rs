use std::process::Child;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use hmac::{Hmac, Mac};
use rand::{distributions::Alphanumeric, Rng};
use sha2::Sha256;
use tauri::{Manager, RunEvent, State};

struct AppState {
    session_token: String,
    permit_secret: String,
    backend: Mutex<Option<Child>>,
}

fn random_secret(len: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

#[tauri::command]
fn get_session_token(state: State<AppState>) -> String {
    state.session_token.clone()
}

#[tauri::command]
fn get_write_permit(state: State<AppState>) -> Result<String, String> {
    // TODO: افحص الترخيص هنا. لو منتهي ارجع Err ولا تصدر تصريح.
    let expires = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs()
        + 300; // 5 دقائق

    let mut mac = Hmac::<Sha256>::new_from_slice(state.permit_secret.as_bytes())
        .map_err(|e| e.to_string())?;
    mac.update(expires.to_string().as_bytes());
    Ok(format!("{}.{}", expires, hex::encode(mac.finalize().into_bytes())))
}

#[cfg(not(debug_assertions))]
fn spawn_backend(session_token: &str, permit_secret: &str) -> Option<Child> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let exe = std::env::current_exe().ok()?.parent()?.join("dealzora-backend.exe");
    Command::new(exe)
        .env("POS_SESSION_TOKEN", session_token)
        .env("POS_WRITE_PERMIT_SECRET", permit_secret)
        .env("POS_DEBUG", "false")
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .ok()
}

#[cfg(debug_assertions)]
fn spawn_backend(_: &str, _: &str) -> Option<Child> {
    None // في التطوير الـ backend بيشتغل من VS Code task
}

pub fn run() {
    let (session_token, permit_secret) = if cfg!(debug_assertions) {
        ("dev-token".to_string(), "dev-secret".to_string())
    } else {
        (random_secret(48), random_secret(48))
    };

    let backend = spawn_backend(&session_token, &permit_secret);

    tauri::Builder::default()
        .manage(AppState {
            session_token,
            permit_secret,
            backend: Mutex::new(backend),
        })
        .invoke_handler(tauri::generate_handler![get_session_token, get_write_permit])
        .build(tauri::generate_context!())
        .expect("error while building tauri app")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                let state: State<AppState> = app.state();
                if let Some(mut child) = state.backend.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
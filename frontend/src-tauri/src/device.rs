//! وضع الجهاز في المحل:
//! - أساسي (الافتراضي): قاعدة البيانات والـ backend هنا. يمكنه السماح لأجهزة الكاشير بالاتصال عبر الشبكة.
//! - كاشير: لا قاعدة بيانات محلية؛ يتصل بالـ backend على الجهاز الأساسي بتوكن جهاز من الاقتران.
//!
//! الإعداد في %LOCALAPPDATA%\Dealzora\device.json (خاص بالجهاز، ليس في القاعدة لأن جهاز الكاشير بلا قاعدة).

use std::fs;
use std::path::PathBuf;

use serde::{ Deserialize, Serialize };

type R<T> = Result<T, String>;

const MAX_URL_LEN: usize = 200;
const MAX_NAME_LEN: usize = 60;

#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    #[default]
    Main,
    Terminal,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct DeviceConfig {
    #[serde(default)]
    pub mode: Mode,
    /// الجهاز الأساسي يستمع على الشبكة (0.0.0.0) لأجهزة الكاشير.
    #[serde(default)]
    pub lan_enabled: bool,
    /// جهاز الكاشير: عنوان الجهاز الأساسي مثل http://192.168.1.10:8000
    #[serde(default)]
    pub main_url: Option<String>,
    #[serde(default)]
    pub device_token: Option<String>,
    #[serde(default)]
    pub device_name: Option<String>,
}

fn path() -> Option<PathBuf> {
    std::env::var("LOCALAPPDATA").ok().map(|p| PathBuf::from(p).join("Dealzora").join("device.json"))
}

/// إعداد تالف أو مفقود = جهاز أساسي (سلوك البرنامج قبل هذه الميزة).
pub fn load() -> DeviceConfig {
    path()
        .and_then(|p| fs::read(p).ok())
        .and_then(|b| serde_json::from_slice(&b).ok())
        .unwrap_or_default()
}

pub fn save(cfg: &DeviceConfig) -> R<()> {
    let p = path().ok_or("no_local_app_data")?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = p.with_extension("tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(cfg).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &p).map_err(|e| e.to_string()) // ذري: لا ملف نصف مكتوب
}

/// http(s)://host[:port] فقط، بدون مسار (نُضيف /api/v1 في الواجهة).
pub fn validate_main_url(url: &str) -> R<String> {
    let url = url.trim().trim_end_matches('/');
    let rest = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))
        .ok_or("invalid_main_url")?;
    let ok =
        !rest.is_empty() &&
        url.len() <= MAX_URL_LEN &&
        rest.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | ':' | '[' | ']'));
    if ok { Ok(url.to_string()) } else { Err("invalid_main_url".into()) }
}

pub fn validate_name(name: &str) -> R<String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if (2..=MAX_NAME_LEN).contains(&name.chars().count()) { Ok(name) } else { Err("invalid_device_name".into()) }
}

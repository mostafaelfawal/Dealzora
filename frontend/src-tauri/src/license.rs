//! الترخيص: المرجع الوحيد لحالة التجربة/الترخيص. الـ backend لا يصدّق إلا تصريح الكتابة الذي نصدره من هنا.
//! السرّ المضمّن في الملف التنفيذي يمكن استخراجه من مبرمج متمرّس، والهدف رفع تكلفة الكسر وليس منعه تماماً.

use std::fs;
use std::path::PathBuf;
use std::sync::{ Mutex, MutexGuard, OnceLock };
use std::time::{ SystemTime, UNIX_EPOCH };

use base64::{ engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine };
use ed25519_dalek::{ Signature, Verifier, VerifyingKey };
use hmac::{ Hmac, Mac };
use serde::{ Deserialize, Serialize };
use sha2::{ Digest, Sha256 };

type HmacSha256 = Hmac<Sha256>;
type R<T> = Result<T, String>;

const SCHEMA: u8 = 1;
const DAY: u64 = 86_400;
const TRIAL_DAYS: u64 = 10;
const PERMIT_TTL: u64 = 300; // 5 دقائق
const CLOCK_TOLERANCE: u64 = 600; // سماح لفروق الساعة
const TOUCH_INTERVAL: u64 = 60; // لا نكتب last_seen أكثر من مرة في الدقيقة
/// أي وقت أقدم من هذا مرفوض. ارفعه مع كل إصدار (الحالي ≈ 20 سبتمبر 2026).
const MIN_VALID_UNIX: u64 = 1_789_948_800;

// تُمرَّر وقت البناء: DEALZORA_LICENSE_SECRET (سر عشوائي طويل) و DEALZORA_VENDOR_PUBKEY (المفتاح العام base64url).
const LOCAL_SECRET: &str = match option_env!("DEALZORA_LICENSE_SECRET") {
    Some(s) => s,
    None => "dev-only-license-secret",
};
const VENDOR_PUBKEY: &str = match option_env!("DEALZORA_VENDOR_PUBKEY") {
    Some(s) => s,
    None => "",
};
#[cfg(not(debug_assertions))]
const _: () = assert!(
    option_env!("DEALZORA_LICENSE_SECRET").is_some() &&
        option_env!("DEALZORA_VENDOR_PUBKEY").is_some(),
    "set DEALZORA_LICENSE_SECRET and DEALZORA_VENDOR_PUBKEY for release builds"
);

// ---------------- الأنواع ----------------
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Trial,
    Licensed,
}

#[derive(Serialize, Deserialize, Clone)]
struct Record {
    v: u8,
    machine_id: String,
    kind: Kind,
    shop_name: String,
    license_id: Option<String>,
    started_at: u64,
    expires_at: u64,
    last_seen: u64,
}

#[derive(Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum State {
    NotStarted,
    Trial,
    Licensed,
    Expired,
    Tampered,
    WrongMachine,
}

#[derive(Serialize)]
pub struct Status {
    state: State,
    reason: Option<&'static str>,
    kind: Option<Kind>,
    shop_name: Option<String>,
    expires_at: Option<u64>,
    days_left: Option<u64>,
    machine_id: String, // يُرسله العميل لك لإصدار مفتاح
}

#[derive(Deserialize)]
struct KeyPayload {
    license_id: String,
    machine_id: String,
    shop_name: String,
    expires_at: u64,
}

enum Loaded {
    None,
    Tampered,
    Rec(Record),
}

// ---------------- أدوات ----------------
fn e(code: &str) -> String {
    code.to_string()
}

fn lock() -> MutexGuard<'static, ()> {
    static L: Mutex<()> = Mutex::new(());
    L.lock().unwrap_or_else(|p| p.into_inner())
}

fn now_secs() -> R<u64> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .map_err(|x| x.to_string())
}

fn machine_id() -> R<&'static str> {
    static ID: OnceLock<String> = OnceLock::new();
    if let Some(id) = ID.get() {
        return Ok(id);
    }
    let raw = machine_uid::get().map_err(|x| x.to_string())?;
    let mut h = Sha256::new();
    h.update(b"dealzora|");
    h.update(raw.as_bytes());
    Ok(ID.get_or_init(|| hex::encode(h.finalize())))
}

// ---------------- التوقيع ----------------
fn mac_for(machine_id: &str, body: &str) -> HmacSha256 {
    let mut h = Sha256::new();
    h.update(LOCAL_SECRET.as_bytes());
    h.update(b"|");
    h.update(machine_id.as_bytes());
    let mut mac = HmacSha256::new_from_slice(&h.finalize()).expect("hmac key");
    mac.update(body.as_bytes());
    mac
}

fn seal(rec: &Record) -> String {
    let body = B64.encode(serde_json::to_vec(rec).expect("serialize"));
    let sig = hex::encode(mac_for(&rec.machine_id, &body).finalize().into_bytes());
    format!("{body}.{sig}")
}

fn unseal(blob: &str) -> Option<Record> {
    let (body, sig) = blob.trim().split_once('.')?;
    let rec: Record = serde_json::from_slice(&B64.decode(body).ok()?).ok()?;
    mac_for(&rec.machine_id, body).verify_slice(&hex::decode(sig).ok()?).ok()?;
    (rec.v == SCHEMA).then_some(rec)
}

// ---------------- التخزين (3 أماكن) ----------------
fn file_paths() -> Vec<PathBuf> {
    let mut v = vec![];
    if let Ok(p) = std::env::var("PROGRAMDATA") {
        v.push(PathBuf::from(p).join("Dealzora").join("license.dat"));
    }
    if let Ok(p) = std::env::var("LOCALAPPDATA") {
        v.push(PathBuf::from(p).join("Dealzora").join("cache").join("lic.bin"));
    }
    v
}

#[cfg(windows)]
const REG_PATH: &str = r"Software\Dealzora\Runtime";
#[cfg(windows)]
const REG_VALUE: &str = "lic";

#[cfg(windows)]
fn reg_read() -> Option<String> {
    use winreg::{ enums::HKEY_CURRENT_USER, RegKey };
    RegKey::predef(HKEY_CURRENT_USER).open_subkey(REG_PATH).ok()?.get_value(REG_VALUE).ok()
}
#[cfg(windows)]
fn reg_write(s: &str) {
    use winreg::{ enums::HKEY_CURRENT_USER, RegKey };
    if let Ok((key, _)) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(REG_PATH) {
        let _ = key.set_value(REG_VALUE, &s);
    }
}
#[cfg(not(windows))]
fn reg_read() -> Option<String> {
    None
}
#[cfg(not(windows))]
fn reg_write(_: &str) {}

fn store_count() -> usize {
    file_paths().len() + usize::from(cfg!(windows))
}

fn read_blobs() -> Vec<String> {
    let mut v: Vec<String> = file_paths()
        .iter()
        .filter_map(|p| fs::read_to_string(p).ok())
        .collect();
    v.extend(reg_read());
    v.retain(|s| !s.trim().is_empty());
    v
}

fn persist(rec: &Record) {
    let blob = seal(rec);
    for p in file_paths() {
        if let Some(dir) = p.parent() {
            let _ = fs::create_dir_all(dir);
        }
        let _ = fs::write(&p, &blob);
    }
    reg_write(&blob);
}

/// يرجع (الحالة المحمّلة، عدد النسخ السليمة). نأخذ أحدث نسخة سليمة، والتالفة تُتجاهل ما دامت توجد سليمة.
fn load() -> (Loaded, usize) {
    let blobs = read_blobs();
    let (mut best, mut valid): (Option<Record>, usize) = (None, 0);
    for b in &blobs {
        if let Some(r) = unseal(b) {
            valid += 1;
            if best.as_ref().map_or(true, |x| r.last_seen > x.last_seen) {
                best = Some(r);
            }
        }
    }
    match best {
        Some(r) => (Loaded::Rec(r), valid),
        None if blobs.is_empty() => (Loaded::None, 0),
        None => (Loaded::Tampered, 0),
    }
}

// ---------------- التقييم ----------------
fn status_of(
    mid: &str,
    state: State,
    reason: Option<&'static str>,
    rec: Option<&Record>,
    now: u64
) -> Status {
    let active = matches!(state, State::Trial | State::Licensed);
    Status {
        state,
        reason,
        kind: rec.map(|r| r.kind),
        shop_name: rec.map(|r| r.shop_name.clone()),
        expires_at: rec.map(|r| r.expires_at),
        days_left: rec.filter(|_| active).map(|r| r.expires_at.saturating_sub(now).div_ceil(DAY)),
        machine_id: mid.to_string(),
    }
}

fn evaluate(mid: &str, loaded: Loaded, now: u64) -> (Status, Option<Record>) {
    let bad = |state, reason| (status_of(mid, state, Some(reason), None, now), None);
    if now < MIN_VALID_UNIX {
        return bad(State::Tampered, "clock_invalid");
    }
    let mut rec = match loaded {
        Loaded::None => {
            return (status_of(mid, State::NotStarted, None, None, now), None);
        }
        Loaded::Tampered => {
            return bad(State::Tampered, "bad_signature");
        }
        Loaded::Rec(r) => r,
    };
    if rec.machine_id != mid {
        return bad(State::WrongMachine, "machine_mismatch");
    }
    if now + CLOCK_TOLERANCE < rec.last_seen {
        return bad(State::Tampered, "clock_rollback");
    }
    if now >= rec.last_seen + TOUCH_INTERVAL {
        rec.last_seen = now;
    }
    let state = if now >= rec.expires_at {
        State::Expired
    } else if rec.kind == Kind::Trial {
        State::Trial
    } else {
        State::Licensed
    };
    (status_of(mid, state, None, Some(&rec), now), Some(rec))
}

/// يقرأ، يقيّم، ويحدّث last_seen / يرمّم النسخ الناقصة عند الحاجة.
fn refresh(mid: &str, now: u64) -> (Status, Option<Record>) {
    let (loaded, valid) = load();
    let before = if let Loaded::Rec(r) = &loaded { Some(r.last_seen) } else { None };
    let (status, rec) = evaluate(mid, loaded, now);
    if let Some(r) = &rec {
        if Some(r.last_seen) != before || valid < store_count() {
            persist(r);
        }
    }
    (status, rec)
}

// ---------------- الواجهة العامة ----------------
pub fn status() -> R<Status> {
    let _g = lock();
    let now = now_secs()?;
    Ok(refresh(machine_id()?, now).0)
}

pub fn start_trial(shop_name: &str) -> R<Status> {
    let _g = lock();
    let (now, mid) = (now_secs()?, machine_id()?);
    let shop = shop_name.split_whitespace().collect::<Vec<_>>().join(" ");
    if !(2..=100).contains(&shop.chars().count()) {
        return Err(e("invalid_shop_name"));
    }
    if refresh(mid, now).0.state != State::NotStarted {
        return Err(e("trial_not_available")); // بدأت/انتهت/معطوبة: لا تجربة جديدة
    }
    persist(
        &(Record {
            v: SCHEMA,
            machine_id: mid.to_string(),
            kind: Kind::Trial,
            shop_name: shop,
            license_id: None,
            started_at: now,
            expires_at: now + TRIAL_DAYS * DAY,
            last_seen: now,
        })
    );
    Ok(refresh(mid, now).0)
}

fn unavailable<T>(_: T) -> String {
    e("activation_unavailable")
}

pub fn activate(key: &str) -> R<Status> {
    let _g = lock();
    let (now, mid) = (now_secs()?, machine_id()?);

    let pk: [u8; 32] = B64.decode(VENDOR_PUBKEY)
        .map_err(unavailable)?
        .try_into()
        .map_err(|_| e("activation_unavailable"))?;
    let vk = VerifyingKey::from_bytes(&pk).map_err(unavailable)?;

    let (body, sig) = key
        .trim()
        .split_once('.')
        .ok_or_else(|| e("invalid_key"))?;
    let sig = Signature::from_slice(&B64.decode(sig).map_err(|_| e("invalid_key"))?).map_err(|_|
        e("invalid_key")
    )?;
    vk.verify(body.as_bytes(), &sig).map_err(|_| e("invalid_key"))?;
    let lic: KeyPayload = serde_json
        ::from_slice(&B64.decode(body).map_err(|_| e("invalid_key"))?)
        .map_err(|_| e("invalid_key"))?;

    if lic.machine_id != mid {
        return Err(e("key_wrong_machine"));
    }
    if now >= lic.expires_at {
        return Err(e("key_expired"));
    }
    if matches!(refresh(mid, now).0.state, State::Tampered | State::WrongMachine) {
        return Err(e("license_tampered"));
    }
    persist(
        &(Record {
            v: SCHEMA,
            machine_id: mid.to_string(),
            kind: Kind::Licensed,
            shop_name: lic.shop_name,
            license_id: Some(lic.license_id),
            started_at: now,
            expires_at: lic.expires_at,
            last_seen: now,
        })
    );
    Ok(refresh(mid, now).0)
}

/// وقت انتهاء تصريح الكتابة: لا يتجاوز انتهاء الترخيص نفسه. أي حالة غير فعالة ترجع خطأ.
pub fn permit_expiry() -> R<u64> {
    let _g = lock();
    let now = now_secs()?;
    match refresh(machine_id()?, now) {
        (Status { state: State::Trial | State::Licensed, .. }, Some(r)) => {
            Ok((now + PERMIT_TTL).min(r.expires_at))
        }
        (s, _) =>
            Err(
                e(match s.state {
                    State::NotStarted => "license_not_started",
                    State::Expired => "license_expired",
                    State::WrongMachine => "license_wrong_machine",
                    _ => "license_tampered",
                })
            ),
    }
}

const DB_SECRET: &str = match option_env!("DEALZORA_DB_SECRET") {
    Some(s) => s,
    None => "dev-only-db-secret",
};

/// كلمة مرور SQLCipher: ثابتة لنفس الجهاز، فلا تحتاج تخزيناً.
pub fn db_password() -> R<String> {
    let mut mac = HmacSha256::new_from_slice(DB_SECRET.as_bytes()).map_err(|x| x.to_string())?;
    mac.update(b"db|");
    mac.update(machine_id()?.as_bytes());
    Ok(hex::encode(mac.finalize().into_bytes()))
}

/// device_id بصيغة UUID (36 حرفاً) ثابت لنفس الجهاز.
pub fn device_id() -> R<String> {
    let h = hex::encode(Sha256::digest(format!("device|{}", machine_id()?)));
    Ok(format!("{}-{}-{}-{}-{}", &h[0..8], &h[8..12], &h[12..16], &h[16..20], &h[20..32]))
}

#[cfg(debug_assertions)]
pub fn reset_dev() -> R<()> {
    let _g = lock();
    for p in file_paths() {
        let _ = fs::remove_file(p);
    }
    #[cfg(windows)]
    {
        use winreg::{ enums::HKEY_CURRENT_USER, RegKey };
        let _ = RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(REG_PATH);
    }
    Ok(())
}

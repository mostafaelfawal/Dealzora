//! مجلد بيانات البرنامج الخاص بالمستخدم على كل نظام:
//! - ويندوز: %LOCALAPPDATA%\Dealzora
//! - ماك:    ~/Library/Application Support/Dealzora
//! - لينكس:  $XDG_DATA_HOME/Dealzora (الافتراضي ~/.local/share/Dealzora)
//!
//! يجب أن يطابق app/core/paths.py في الـ backend (السجلات في نفس المجلد).

use std::path::PathBuf;

#[cfg(windows)]
pub fn local_dir() -> Option<PathBuf> {
    std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join("Dealzora"))
}

#[cfg(target_os = "macos")]
pub fn local_dir() -> Option<PathBuf> {
    home().map(|h| h.join("Library").join("Application Support").join("Dealzora"))
}

#[cfg(all(unix, not(target_os = "macos")))]
pub fn local_dir() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute())
        .or_else(|| home().map(|h| h.join(".local").join("share")))?;
    Some(base.join("Dealzora"))
}

/// مجلد المستخدم (يونكس فقط؛ ويندوز يعتمد على LOCALAPPDATA).
#[cfg(unix)]
pub fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from).filter(|p| p.is_absolute())
}

/// مجلد السجلات: <مجلد البيانات>/logs
pub fn logs_dir() -> Option<PathBuf> {
    local_dir().map(|d| d.join("logs"))
}

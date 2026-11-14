//! طباعة مباشرة بدون نافذة الطباعة: نرسل بايتات خام (ESC/POS) إلى طابعة ويندوز عبر الـ spooler
//! بنوع البيانات "RAW"، فتصل للطابعة كما هي دون أن يعالجها التعريف.
//!
//! يعمل مع أي طابعة حرارية معرّفة في ويندوز (USB أو شبكة أو منفذ COM) بدون أي برنامج إضافي.
//! الإيصال نفسه يُرسم في الواجهة كصورة (العربي يطلع كما يظهر على الشاشة) ثم يُحوَّل لأوامر ESC/POS.

use base64::{ engine::general_purpose::STANDARD as B64, Engine };
use serde::Serialize;

#[derive(Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

/// الطابعات المعرّفة في ويندوز (المحلية والمشتركة على الشبكة).
#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    imp::list()
}

/// يرسل البايتات (base64) للطابعة كمهمة طباعة واحدة. لا ينتظر انتهاء الطباعة الفعلية،
/// فقط وصول المهمة للـ spooler.
#[tauri::command]
pub async fn print_raw(printer: String, data: String, job_name: String) -> Result<(), String> {
    let bytes = B64.decode(data.as_bytes()).map_err(|_| "بيانات الطباعة غير صالحة".to_string())?;
    if bytes.is_empty() {
        return Err("لا يوجد ما يُطبع".into());
    }
    tauri::async_runtime
        ::spawn_blocking(move || imp::print_raw(&printer, &job_name, &bytes)).await
        .map_err(|e| e.to_string())?
}

#[cfg(windows)]
mod imp {
    use super::PrinterInfo;
    use std::ffi::c_void;
    use std::io::Error;
    use std::ptr::{ null, null_mut };

    type Handle = *mut c_void;

    #[repr(C)]
    struct DocInfo1W {
        doc_name: *const u16,
        output_file: *const u16,
        datatype: *const u16,
    }

    #[repr(C)]
    struct PrinterInfo4W {
        printer_name: *mut u16,
        server_name: *mut u16,
        attributes: u32,
    }

    const PRINTER_ENUM_LOCAL: u32 = 0x2;
    const PRINTER_ENUM_CONNECTIONS: u32 = 0x4;

    #[link(name = "winspool")]
    unsafe extern "system" {
        fn OpenPrinterW(name: *const u16, handle: *mut Handle, defaults: *const c_void) -> i32;
        fn ClosePrinter(handle: Handle) -> i32;
        fn StartDocPrinterW(handle: Handle, level: u32, info: *const DocInfo1W) -> u32;
        fn EndDocPrinter(handle: Handle) -> i32;
        fn StartPagePrinter(handle: Handle) -> i32;
        fn EndPagePrinter(handle: Handle) -> i32;
        fn WritePrinter(handle: Handle, buf: *const c_void, count: u32, written: *mut u32) -> i32;
        fn EnumPrintersW(
            flags: u32,
            name: *const u16,
            level: u32,
            buf: *mut u8,
            size: u32,
            needed: *mut u32,
            returned: *mut u32
        ) -> i32;
        fn GetDefaultPrinterW(buf: *mut u16, size: *mut u32) -> i32;
    }

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// SAFETY: المؤشر لنص UTF-16 منتهٍ بصفر (من ويندوز) أو null.
    unsafe fn from_wide(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        let mut len = 0;
        while unsafe { *ptr.add(len) } != 0 {
            len += 1;
        }
        String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(ptr, len) })
    }

    fn default_printer() -> Option<String> {
        let mut size = 0u32;
        unsafe { GetDefaultPrinterW(null_mut(), &mut size) };
        if size == 0 {
            return None;
        }
        let mut buf = vec![0u16; size as usize];
        // SAFETY: المخزن بالحجم الذي طلبته الدالة.
        let ok = unsafe { GetDefaultPrinterW(buf.as_mut_ptr(), &mut size) } != 0;
        ok.then(|| unsafe { from_wide(buf.as_ptr()) })
    }

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let (mut needed, mut count) = (0u32, 0u32);
        // أول نداء لمعرفة الحجم المطلوب فقط (يفشل بـ ERROR_INSUFFICIENT_BUFFER).
        unsafe { EnumPrintersW(flags, null(), 4, null_mut(), 0, &mut needed, &mut count) };
        if needed == 0 {
            return Ok(Vec::new());
        }
        // u64 لضمان محاذاة البنى داخل المخزن.
        let mut buf = vec![0u64; (needed as usize).div_ceil(8)];
        // SAFETY: المخزن بالحجم المطلوب، وويندوز يملؤه بمصفوفة PRINTER_INFO_4W.
        let ok = unsafe {
            EnumPrintersW(flags, null(), 4, buf.as_mut_ptr().cast(), needed, &mut needed, &mut count)
        };
        if ok == 0 {
            return Err(format!("تعذّر قراءة الطابعات: {}", Error::last_os_error()));
        }
        let default = default_printer();
        let infos = buf.as_ptr().cast::<PrinterInfo4W>();
        let printers = (0..count as usize)
            .map(|i| {
                let name = unsafe { from_wide((*infos.add(i)).printer_name) };
                let is_default = default.as_deref() == Some(name.as_str());
                PrinterInfo { name, is_default }
            })
            .filter(|p| !p.name.is_empty())
            .collect();
        Ok(printers)
    }

    pub fn print_raw(printer: &str, job_name: &str, bytes: &[u8]) -> Result<(), String> {
        let name = wide(printer);
        let mut handle: Handle = null_mut();
        // SAFETY: اسم منتهٍ بصفر ومؤشر صالح لاستلام المقبض.
        if unsafe { OpenPrinterW(name.as_ptr(), &mut handle, null()) } == 0 {
            return Err(format!("الطابعة «{printer}» غير موجودة: {}", Error::last_os_error()));
        }
        let result = write_job(handle, job_name, bytes);
        unsafe { ClosePrinter(handle) };
        result.map_err(|e| format!("تعذّرت الطباعة على «{printer}»: {e}"))
    }

    fn write_job(handle: Handle, job_name: &str, bytes: &[u8]) -> Result<(), Error> {
        let doc = wide(job_name);
        let datatype = wide("RAW");
        let info = DocInfo1W {
            doc_name: doc.as_ptr(),
            output_file: null(),
            datatype: datatype.as_ptr(),
        };
        // SAFETY: المقبض مفتوح، والنصوص حية طوال المهمة.
        if unsafe { StartDocPrinterW(handle, 1, &info) } == 0 {
            return Err(Error::last_os_error());
        }
        let result = (|| {
            if unsafe { StartPagePrinter(handle) } == 0 {
                return Err(Error::last_os_error());
            }
            let mut sent = 0usize;
            while sent < bytes.len() {
                let chunk = &bytes[sent..];
                let mut written = 0u32;
                let len = chunk.len().min(u32::MAX as usize) as u32;
                if unsafe { WritePrinter(handle, chunk.as_ptr().cast(), len, &mut written) } == 0 {
                    return Err(Error::last_os_error());
                }
                if written == 0 {
                    return Err(Error::other("الطابعة لم تستقبل البيانات"));
                }
                sent += written as usize;
            }
            unsafe { EndPagePrinter(handle) };
            Ok(())
        })();
        unsafe { EndDocPrinter(handle) };
        result
    }
}

#[cfg(not(windows))]
mod imp {
    use super::PrinterInfo;

    pub fn list() -> Result<Vec<PrinterInfo>, String> {
        Ok(Vec::new())
    }

    pub fn print_raw(_printer: &str, _job_name: &str, _bytes: &[u8]) -> Result<(), String> {
        Err("الطباعة المباشرة متاحة على ويندوز فقط".into())
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn lists_installed_printers() {
        let printers = super::list_printers().expect("list printers");
        for p in &printers {
            println!("{} {}", p.name, if p.is_default { "(default)" } else { "" });
        }
    }
}

//! مواصفات الجهاز لتقرير هل نشغّل الحركة (animations) في الواجهة أم لا.
//! أجهزة المحلات غالباً ضعيفة (Celeron بنواتين و 4 جيجا رام)، والحركة عليها تبطّئ الكاشير.

use serde::Serialize;

/// أقل من هذا = جهاز ضعيف. جهاز "4 جيجا" يظهر عادةً ~3.8 جيجا بعد حجز الـ GPU المدمج.
const LOW_END_MEMORY_MB: u64 = 4_600;
const LOW_END_CPU_CORES: usize = 2;

#[derive(Serialize)]
pub struct HardwareInfo {
    /// عدد الأنوية المنطقية (threads).
    pub cpu_cores: usize,
    /// الرام الكلي بالميجا، أو None لو تعذّرت قراءته.
    pub total_memory_mb: Option<u64>,
    /// القرار النهائي: true = أوقف الحركة تلقائياً.
    pub low_end: bool,
}

#[tauri::command]
pub fn get_hardware_info() -> HardwareInfo {
    let cpu_cores = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    let total_memory_mb = total_memory_mb();
    let low_end =
        cpu_cores <= LOW_END_CPU_CORES ||
        total_memory_mb.is_some_and(|mb| mb < LOW_END_MEMORY_MB);
    HardwareInfo { cpu_cores, total_memory_mb, low_end }
}

#[cfg(windows)]
fn total_memory_mb() -> Option<u64> {
    #[repr(C)]
    struct MemoryStatusEx {
        length: u32,
        memory_load: u32,
        total_phys: u64,
        avail_phys: u64,
        total_page_file: u64,
        avail_page_file: u64,
        total_virtual: u64,
        avail_virtual: u64,
        avail_extended_virtual: u64,
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GlobalMemoryStatusEx(buffer: *mut MemoryStatusEx) -> i32;
    }

    let mut status = MemoryStatusEx {
        length: std::mem::size_of::<MemoryStatusEx>() as u32,
        memory_load: 0,
        total_phys: 0,
        avail_phys: 0,
        total_page_file: 0,
        avail_page_file: 0,
        total_virtual: 0,
        avail_virtual: 0,
        avail_extended_virtual: 0,
    };
    // SAFETY: البنية مطابقة لـ MEMORYSTATUSEX وحقل الطول مضبوط كما تطلب الدالة.
    let ok = unsafe { GlobalMemoryStatusEx(&mut status) } != 0;
    ok.then(|| status.total_phys / (1024 * 1024))
}

#[cfg(not(windows))]
fn total_memory_mb() -> Option<u64> {
    None
}

#[cfg(test)]
mod tests {
    #[test]
    fn reads_real_specs() {
        let info = super::get_hardware_info();
        assert!(info.cpu_cores >= 1);
        #[cfg(windows)]
        assert!(info.total_memory_mb.is_some_and(|mb| mb > 256));
        println!("cores={} ram_mb={:?} low_end={}", info.cpu_cores, info.total_memory_mb, info.low_end);
    }
}

import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * يفتح محادثة واتساب برسالة جاهزة. داخل تطبيق سطح المكتب يمر عبر Rust (open_whatsapp)
 * الذي يقبل روابط https://wa.me/ فقط، والنص مُرمَّز بالكامل.
 */
export async function openWhatsapp(phone: string, text: string): Promise<void> {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  if (isTauri()) await invoke("open_whatsapp", { url });
  else window.open(url, "_blank", "noopener,noreferrer");
}

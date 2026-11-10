import { useEffect, useRef, useState } from "react";

/** هل السحب الحالي ملفات من الجهاز (وليس نصاً أو عنصراً من الصفحة)؟ */
export const isFileDrag = (e: DragEvent) =>
  Boolean(e.dataTransfer?.types.includes("Files"));

/**
 * يلتقط سحب الملفات فوق النافذة كلها ويرجّع dragging لإظهار طبقة "أفلت هنا".
 *
 * يعمل داخل Tauri لأن dragDropEnabled=false في tauri.conf.json: بدونه يعترض
 * Tauri الإفلات على مستوى النافذة ولا تصل أحداث drop للصفحة أصلاً.
 *
 * عدّاد dragenter/dragleave لأن الحدثين يتكرران مع كل عنصر داخلي يمر عليه المؤشر.
 */
export function useFileDrop({
  enabled = true,
  onDrop,
}: {
  enabled?: boolean;
  onDrop: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const onDropRef = useRef(onDrop);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      depth.current = 0;
      setDragging(false);
    };

    const handleEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth.current += 1;
      setDragging(true);
    };

    const handleOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); // يسمح بالإفلات
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const handleLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      // relatedTarget = null: المؤشر خرج من النافذة كلها.
      if (depth.current === 0 || e.relatedTarget === null) reset();
    };

    const handleDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      reset();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onDropRef.current(files);
    };

    window.addEventListener("dragenter", handleEnter);
    window.addEventListener("dragover", handleOver);
    window.addEventListener("dragleave", handleLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragenter", handleEnter);
      window.removeEventListener("dragover", handleOver);
      window.removeEventListener("dragleave", handleLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("blur", reset);
      reset();
    };
  }, [enabled]);

  return { dragging: enabled && dragging };
}

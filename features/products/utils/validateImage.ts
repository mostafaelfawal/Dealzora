import toast from "react-hot-toast";

export function validateImage(file: File): boolean {
  if (!file.type.startsWith("image/")) {
    toast.error("الملف يجب أن يكون صورة");
    return false;
  }

  const maxSizeMB = 5;
  if (file.size > maxSizeMB * 1024 * 1024) {
    toast.error(`حجم الصورة يجب أن يكون أقل من ${maxSizeMB} ميجابايت`);
    return false;
  }

  return true;
}

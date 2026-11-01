import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "next-themes";

export default function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-right"
      richColors
      dir="rtl"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}

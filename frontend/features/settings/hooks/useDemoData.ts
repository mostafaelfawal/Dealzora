import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import { clearDemo, fetchDemoStatus, seedDemo } from "../api/devtools.api";

export const IS_DEV = process.env.NODE_ENV === "development";

const demoKey = ["devtools", "demo"] as const;

/** حالة البيانات التجريبية. 404 من backend ليس في وضع debug = غير مفعّل. */
export function useDemoStatus() {
  return useQuery({
    queryKey: demoKey,
    queryFn: fetchDemoStatus,
    enabled: IS_DEV,
    retry: false,
  });
}

/** إنشاء وحذف البيانات التجريبية. كلاهما يمس كل الجداول، فنُبطل كل الكاش بعده. */
export function useDemoMutations({ onSettled }: { onSettled: () => void }) {
  const qc = useQueryClient();
  const refreshAll = () => void qc.invalidateQueries();

  const seed = useMutation({
    mutationFn: seedDemo,
    onSuccess: (r) => {
      refreshAll();
      toast.success(`تم إنشاء بيانات ${r.days} يوماً`, {
        description: `${r.sales} فاتورة · ${r.purchases} فاتورة شراء · ${r.products} صنف · ${r.customers} عميل (${r.records} سجل في ${r.seconds} ث)`,
        duration: 10_000,
      });
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر إنشاء البيانات التجريبية")),
    onSettled,
  });

  const clear = useMutation({
    mutationFn: clearDemo,
    onSuccess: (r) => {
      refreshAll();
      toast.success(`تم حذف ${r.deleted} سجل تجريبي`, {
        description: "بياناتك الحقيقية كما هي.",
      });
    },
    onError: (e) =>
      toast.error(extractErrorMessage(e, "تعذّر حذف البيانات التجريبية")),
    onSettled,
  });

  return { seed, clear, busy: seed.isPending || clear.isPending };
}

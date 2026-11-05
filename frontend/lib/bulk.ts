import { toast } from "sonner";

export interface BulkItem {
  id: string;
  version: number;
}

export interface BulkResultDto {
  succeeded: string[];
  failed: { id: string; code: string; message: string }[];
}

export const toBulkPayload = (items: BulkItem[]) => ({
  items: items.map((item) => ({ id: item.id, base_version: item.version })),
});

/** doneLabel: "تم حذف" / "تم تعطيل"، وnoun: "صنف" / "عميل". */
export function showBulkResult(
  result: BulkResultDto,
  doneLabel: string,
  noun: string,
) {
  const ok = result.succeeded.length;
  const failed = result.failed.length;
  const reasons = [...new Set(result.failed.map((f) => f.message))]
    .slice(0, 2)
    .join("، ");

  if (failed === 0) {
    toast.success(`${doneLabel} ${ok} ${noun}`);
  } else if (ok === 0) {
    toast.error(`تعذّر تنفيذ العملية على ${failed} ${noun}`, {
      description: reasons,
    });
  } else {
    toast.warning(`${doneLabel} ${ok} ${noun}، وتعذّر ${failed}`, {
      description: reasons,
    });
  }
}

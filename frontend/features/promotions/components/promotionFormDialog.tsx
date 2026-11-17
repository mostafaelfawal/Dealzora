import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Promotion } from "../types/promotion";
import PromotionForm from "./PromotionForm";

export function PromotionFormDialog({
  open,
  promotion,
  onClose,
}: {
  open: boolean;
  promotion: Promotion | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-start">
          <DialogTitle>{promotion ? "تعديل العرض" : "عرض جديد"}</DialogTitle>
          <DialogDescription>
            يُطبَّق العرض تلقائياً في الكاشير على الأصناف المختارة، دون أن يقوم
            الكاشير بأي إجراء.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PromotionForm
            key={promotion?.id ?? "new"}
            promotion={promotion}
            onDone={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { IconCircleCheck } from "@tabler/icons-react";
import Link from "next/link";

import { MotionDiv, popIn } from "@/components/shared/motion";
import { Num } from "@/components/shared/Num";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { PRODUCT_ROUTES } from "../config/productRoutes";
import type { ImportReport } from "../lib/productImport";
import { ImportSteps } from "./importSteps";

function FailedRows({ failed }: { failed: ImportReport["failed"] }) {
  return (
    <ul
      aria-label="الصفوف التي فشل استيرادها"
      className="max-h-40 divide-y overflow-y-auto border text-xs"
    >
      {failed.map((item) => (
        <li
          key={item.row}
          className="flex items-center justify-between gap-3 px-3 py-1.5"
        >
          <span className="text-muted-foreground">
            الصف <Num>{item.row}</Num>
          </span>
          <span className="text-destructive">{item.message}</span>
        </li>
      ))}
    </ul>
  );
}

/** الخطوة 3: ملخص النتيجة والصفوف التي فشلت. */
export function ImportDoneStep({
  report,
  onClose,
}: {
  report: ImportReport;
  onClose: () => void;
}) {
  const saved = report.created + report.updated;

  return (
    <>
      <DialogHeader className="sr-only">
        <DialogTitle>انتهى الاستيراد</DialogTitle>
        <DialogDescription>نتيجة استيراد الأصناف من Excel.</DialogDescription>
      </DialogHeader>
      <ImportSteps current="done" />

      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <MotionDiv variants={popIn} initial="hidden" animate="show">
          <IconCircleCheck
            className={cn(
              "size-14",
              saved > 0 ? "text-success" : "text-muted-foreground",
            )}
          />
        </MotionDiv>
        <div className="space-y-1">
          <p className="text-base font-semibold">
            تم حفظ <Num>{saved}</Num> صنف
          </p>
          <p className="text-xs text-muted-foreground">
            جديد: <Num>{report.created}</Num> · محدَّث:{" "}
            <Num>{report.updated}</Num> · متخطّى: <Num>{report.skipped}</Num> ·
            فشل: <Num>{report.failed.length}</Num>
          </p>
        </div>
      </div>

      {report.failed.length > 0 && <FailedRows failed={report.failed} />}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onClose}
          className="font-normal"
        >
          إغلاق
        </Button>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={PRODUCT_ROUTES.list} onClick={onClose} />}
        >
          عرض الأصناف
        </Button>
      </div>
    </>
  );
}

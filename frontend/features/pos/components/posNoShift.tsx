import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** لا وردية مفتوحة = لا بيع. نقفل الشاشة بدلاً من ترك الكاشير يبيع ثم يتفاجأ لاحقاً. */
export function PosNoShift() {
  return (
    <main className="flex h-dvh items-start justify-center bg-background p-4 pt-[15dvh]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>لا توجد وردية مفتوحة</CardTitle>
          <CardDescription>
            افتح وردية أولاً لتتمكن من تسجيل المبيعات ومتابعة رصيد الدرج.
          </CardDescription>
        </CardHeader>
        <CardContent />
        <CardFooter className="gap-2">
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/shifts/open" />}
          >
            فتح وردية
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="/admin/dashboard" />}
          >
            رجوع إلى لوحة التحكم
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

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

/** مفيش وردية مفتوحة = مفيش بيع. بنقفل الشاشة بدل ما نسيب الكاشير يبيع وبعدين يتفاجئ. */
export function PosNoShift() {
  return (
    <main className="flex h-dvh items-start justify-center bg-background p-4 pt-[15dvh]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>مفيش وردية مفتوحة</CardTitle>
          <CardDescription>
            افتح وردية الأول عشان تقدر تسجّل مبيعات وتتابع رصيد الدرج.
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
            render={<Link href="/main" />}
          >
            رجوع للوحة التحكم
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}

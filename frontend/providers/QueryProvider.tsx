"use client";

import {
  QueryClient,
  QueryClientProvider,
  isServer,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // البيانات تُعتبر حديثة لمدة دقيقة، فلا إعادة جلب عند كل mount.
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // لا إعادة محاولة تلقائية للكتابة (تفادياً لتكرار العملية).
        retry: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  // على السيرفر: client جديد لكل طلب حتى لا تتسرب بيانات بين المستخدمين.
  if (isServer) return makeQueryClient();
  // في المتصفح: نفس الـ client دائماً.
  return (browserQueryClient ??= makeQueryClient());
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState يضمن ثبات الـ client بين الـ re-renders.
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

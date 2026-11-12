"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { useFallbackInterval } from "@/lib/realtime";
import { useAppDispatch } from "@/lib/store/hooks";

import { fetchCatalogVersion, fetchPosCatalog } from "../api/posCatalog.api";
import { cartActions } from "../store/cartSlice";
import { syncCartWithCatalog } from "../store/posActions";
import { catalogActions } from "../store/catalogSlice";

/** احتياط فقط عند انقطاع البث اللحظي: كل كم ثانية نسأل هل تغيّر شيء؟ (طلب صغير جداً) */
const VERSION_POLL_MS = 10_000;

/**
 * مع تعدد الأجهزة: المدير قد يغيّر سعراً أو صنفاً من جهاز آخر، وكاشير آخر يبيع فيتغير الرصيد.
 * نتابع «بصمة» الكتالوج ونعيد التحميل الكامل فقط عند تغيّرها، فتتحدث الأسعار خلال ثوانٍ.
 * (لو بيع حصل بسعر قديم قبل التحديث، السيرفر يرفضه أصلاً ويحدّث الأسعار.)
 */
function useCatalogFreshness() {
  const qc = useQueryClient();
  const last = useRef<string | null>(null);
  const interval = useFallbackInterval(VERSION_POLL_MS);
  const { data: version } = useQuery({
    queryKey: ["pos", "catalog-version"],
    queryFn: fetchCatalogVersion,
    refetchInterval: interval,
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: false,
  });

  useEffect(() => {
    if (!version) return;
    if (last.current !== null && last.current !== version) {
      void qc.invalidateQueries({ queryKey: ["pos", "catalog"] });
    }
    last.current = version;
  }, [version, qc]);
}

/** يحمّل الأصناف والعملاء من الـ API ويضعهم في الـ store. */
export function usePosCatalog() {
  const dispatch = useAppDispatch();
  useCatalogFreshness();
  const query = useQuery({
    queryKey: ["pos", "catalog"],
    queryFn: fetchPosCatalog,
    staleTime: 60_000,
  });

  const { data, isError, error } = query;

  useEffect(() => {
    if (!data) return;
    const { nextNumber, ...catalog } = data;
    dispatch(catalogActions.setCatalog(catalog));
    dispatch(syncCartWithCatalog(catalog.products));
    dispatch(cartActions.syncNextNumber(nextNumber));
  }, [data, dispatch]);

  useEffect(() => {
    if (isError)
      toast.error(extractErrorMessage(error, "تعذّر تحميل أصناف الكاشير"));
  }, [isError, error]);

  return query;
}

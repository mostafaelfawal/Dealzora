"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";
import { useAppDispatch } from "@/lib/store/hooks";

import { fetchPosCatalog } from "../api/posCatalog.api";
import { catalogActions } from "../store/catalogSlice";

/** يحمّل الأصناف والعملاء من الـ API ويضعهم في الـ store. */
export function usePosCatalog() {
  const dispatch = useAppDispatch();
  const query = useQuery({
    queryKey: ["pos", "catalog"],
    queryFn: fetchPosCatalog,
    staleTime: 60_000,
  });

  const { data, isError, error } = query;

  useEffect(() => {
    if (data) dispatch(catalogActions.setCatalog(data));
  }, [data, dispatch]);

  useEffect(() => {
    if (isError)
      toast.error(extractErrorMessage(error, "تعذّر تحميل أصناف الكاشير"));
  }, [isError, error]);

  return query;
}
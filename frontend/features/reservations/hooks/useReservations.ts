import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { extractErrorMessage } from "@/lib/errors";

import {
  cancelReservation,
  fetchReservation,
  fetchReservations,
  setReservationReady,
  updateReservation,
} from "../api/reservations.api";
import {
  RESERVATIONS_PAGE_SIZE,
  reservationKeys,
} from "../config/reservationOptions";
import type { ReservationFilter } from "../types/reservation";

export const useReservations = (
  filter: ReservationFilter,
  q: string,
  page: number,
) =>
  useQuery({
    queryKey: reservationKeys.list(filter, q, page),
    queryFn: () =>
      fetchReservations({
        filter,
        q,
        page,
        pageSize: RESERVATIONS_PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

export const useReservation = (id: string | null) =>
  useQuery({
    queryKey: reservationKeys.detail(id ?? ""),
    queryFn: () => fetchReservation(id as string),
    enabled: Boolean(id),
  });

function useRefresh() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: reservationKeys.all });
}

const onError = (fallback: string) => (error: unknown) =>
  toast.error(extractErrorMessage(error, fallback));

export function useSetReady() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, ready }: { id: string; ready: boolean }) =>
      setReservationReady(id, ready),
    onSuccess: (r) => {
      toast.success(
        r.status === "ready"
          ? `الحجز #${r.number} جاهز للاستلام`
          : `أُعيد الحجز #${r.number} إلى قيد التجهيز`,
      );
      refresh();
    },
    onError: onError("تعذّر تحديث الحجز"),
  });
}

export function useUpdateReservation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({
      id,
      pickupOn,
      note,
    }: {
      id: string;
      pickupOn: string | null;
      note: string | null;
    }) => updateReservation(id, { pickupOn, note }),
    onSuccess: (r) => {
      toast.success(`حُفظ الحجز #${r.number}`);
      refresh();
    },
    onError: onError("تعذّر حفظ الحجز"),
  });
}

export function useCancelReservation() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (id: string) => cancelReservation(id),
    onSuccess: (r) => {
      toast.success(`أُلغي الحجز #${r.number}`, {
        description:
          r.deposit > 0
            ? "العربون باقٍ رصيداً للعميل لدى المحل: يُدفع منه في أي فاتورة أو يُصرف نقداً من صفحة العملاء."
            : undefined,
        duration: r.deposit > 0 ? 10_000 : 5000,
      });
      refresh();
    },
    onError: onError("تعذّر إلغاء الحجز"),
  });
}

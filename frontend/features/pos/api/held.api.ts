import { toMs } from "@/lib/apiMap";
import { api } from "@/lib/axios";

import type { HeldInvoice, PosInvoice } from "../types/pos";

/** الفواتير المعلّقة على الجهاز الأساسي (تظهر لكل أجهزة الكاشير، وتُحذف عند قفل الوردية). */
interface HeldDto {
  id: string;
  held_at: string;
  invoice: PosInvoice;
  item_count: number;
  total: number;
  customer_name: string | null;
  cashier_name: string | null;
  device_name: string | null;
}

const toHeld = (d: HeldDto): HeldInvoice => ({
  id: d.id,
  heldAt: toMs(d.held_at),
  invoice: d.invoice,
  cashierName: d.cashier_name,
  deviceName: d.device_name,
});

export const fetchHeld = async (): Promise<HeldInvoice[]> =>
  (await api.get<HeldDto[]>("/held")).data.map(toHeld);

export const holdInvoiceRemote = async (
  invoice: PosInvoice,
): Promise<HeldInvoice> =>
  toHeld((await api.post<HeldDto>("/held", { invoice })).data);

/** يرجّعها ويحذفها من المعلّقة في نفس اللحظة (جهاز واحد فقط يأخذها). */
export const recallHeldRemote = async (id: string): Promise<PosInvoice> =>
  (await api.post<PosInvoice>(`/held/${id}/recall`)).data;

export const discardHeldRemote = async (id: string) => {
  await api.delete(`/held/${id}`);
};

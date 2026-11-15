import { saveFile, type SavedFile } from "@/lib/saveFile";
import { getCachedPlan } from "@/lib/plan";
import { getTaxConfig, TAX_TYPE_LABEL } from "@/lib/tax";

import { getProducts, type GetProductsParams } from "../api/products.api";
import type { Product } from "../types/product";

const EXPORT_PAGE_SIZE = 96; // أكبر قيمة موجودة في PAGE_SIZES
const MAX_PAGES = 500; // حماية من حلقة لا نهائية

/** نفس أسماء الأعمدة التي يتعرف عليها autoMapColumns، فيصلح الملف للاستيراد مباشرة. */
const HEADERS = [
  "اسم الصنف",
  "الباركود",
  "القسم",
  "الوحدة",
  "سعر الشراء",
  "سعر البيع",
  "الرصيد الحالي",
  "الحد الأدنى",
  "الحالة",
  "كود الميزان",
  "سعر الجملة",
];
const WIDTHS = [32, 18, 16, 10, 12, 12, 14, 12, 10, 12, 12];
/** أعمدة الضريبة: تُصدَّر فقط لو المحل فعّل الضريبة (ويقرأها الاستيراد دائماً). */
const TAX_HEADERS = ["نوع الضريبة", "نسبة الضريبة %"];
const TAX_WIDTHS = [14, 12];
/** أعمدة الإيصال الإلكتروني: تُصدَّر لخطة سلسلة فقط (والاستيراد يقرأها). */
const ETA_HEADERS = ["نوع كود المنظومة", "كود المنظومة"];
const ETA_WIDTHS = [16, 20];

type Cell = string | number;
interface SheetSpec {
  name: string;
  rows: Cell[][];
  widths?: number[];
}

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * يبني الملف في الذاكرة ثم يحفظه عبر saveFile.
 * لا نستخدم XLSX.writeFile: يعتمد على <a download> الذي لا يؤكد الحفظ داخل Tauri.
 */
async function saveWorkbook(
  sheets: SheetSpec[],
  fileName: string,
): Promise<SavedFile> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const spec of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(spec.rows);
    if (spec.widths) sheet["!cols"] = spec.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, sheet, spec.name);
  }
  // الورقة من اليمين لليسار.
  workbook.Workbook = { Views: [{ RTL: true }] };
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as
    ArrayBuffer | Uint8Array;
  return saveFile(new Uint8Array(bytes), fileName, XLSX_MIME);
}

const today = () => new Date().toISOString().slice(0, 10);

/** يجلب كل الصفحات بنفس الفلاتر الحالية. */
export async function fetchAllProducts(
  params: GetProductsParams,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Product[]> {
  const items: Product[] = [];
  let total = Infinity;
  for (let page = 1; items.length < total && page <= MAX_PAGES; page++) {
    const result = await getProducts({
      ...params,
      page,
      page_size: EXPORT_PAGE_SIZE,
    });
    total = result.total;
    items.push(...result.items);
    onProgress?.(items.length, total);
    if (result.items.length === 0) break;
  }
  return items;
}

const taxCells = (p: Product): Cell[] => [
  TAX_TYPE_LABEL[p.taxType],
  p.taxType === "taxable" ? p.taxRate : 0,
];

const toRow = (p: Product): Cell[] => [
  p.name,
  p.barcode, // نص، فلا تضيع الأصفار ولا يتحول لصيغة علمية
  p.categoryName ?? "",
  p.unit,
  p.costPrice ?? "",
  p.salePrice,
  p.stock,
  p.minStock,
  p.isActive ? "مفعّل" : "معطّل",
  p.scaleCode ?? "",
  p.wholesalePrice ?? "",
];

export interface ExportResult {
  /** 0 = لا أصناف مطابقة، ولم يُنشأ ملف. */
  count: number;
  file: SavedFile | null;
}

/** يصدّر الأصناف المطابقة للفلاتر ويرجّع عددها والملف المحفوظ. */
export async function exportProducts(
  params: GetProductsParams,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ExportResult> {
  const products = await fetchAllProducts(params, onProgress);
  if (products.length === 0) return { count: 0, file: null };
  const withTax = getTaxConfig().enabled;
  const withEta = Boolean(getCachedPlan()?.features.includes("e_receipt"));
  const headers = [
    ...HEADERS,
    ...(withTax ? TAX_HEADERS : []),
    ...(withEta ? ETA_HEADERS : []),
  ];
  const widths = [
    ...WIDTHS,
    ...(withTax ? TAX_WIDTHS : []),
    ...(withEta ? ETA_WIDTHS : []),
  ];
  const row = (p: Product): Cell[] => [
    ...toRow(p),
    ...(withTax ? taxCells(p) : []),
    ...(withEta ? [p.etaItemType ?? "", p.etaItemCode ?? ""] : []),
  ];

  const file = await saveWorkbook(
    [{ name: "الأصناف", rows: [headers, ...products.map(row)], widths }],
    `products-${today()}.xlsx`,
  );
  return { count: products.length, file };
}

/** نموذج جاهز للتعبئة: ورقة بيانات بمثالين + ورقة تعليمات. */
export async function downloadProductsTemplate(): Promise<SavedFile> {
  return saveWorkbook(
    [
      {
        name: "الأصناف",
        rows: [
          HEADERS.slice(0, 8),
          ["أرز مصري 1 كجم", "6221001000011", "بقالة", "كيس", 30.4, 38, 48, 10],
          ["سكر 1 كجم", "", "بقالة", "كجم", 25, 30, 20, 5],
        ],
        widths: WIDTHS.slice(0, 8),
      },
      {
        name: "تعليمات",
        rows: [
          ["تعليمات التعبئة"],
          ["الصف الأول أسماء الأعمدة، لا تغيّره."],
          ["المطلوب فقط: اسم الصنف وسعر البيع."],
          ["الباركود: أرقام أو حروف إنجليزية من 3 إلى 32 خانة."],
          ["لو الباركود موجود مسبقاً يُحدَّث الصنف أو يُتخطّى حسب اختيارك."],
          ["الرصيد الحالي يُستخدم للأصناف الجديدة فقط (رصيد افتتاحي)."],
          ["القسم يجب أن يطابق اسم قسم موجود، وإلا يُترك بدون قسم."],
          [
            "اختياري: «نوع الضريبة» (خاضع / معفى / نسبة صفر) و«نسبة الضريبة %» (مثل 14). الفارغ = النسبة الافتراضية للمحل.",
          ],
          ["احذف المثالين قبل الرفع."],
        ],
        widths: [70],
      },
    ],
    "products-template.xlsx",
  );
}

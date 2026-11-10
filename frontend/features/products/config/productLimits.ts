export const MAX_NAME_LEN = 200;
export const MAX_UNIT_NAME_LEN = 30;
export const MAX_BARCODE_LEN = 32;
export const BARCODE_PATTERN = /^[0-9A-Za-z-]{3,32}$/;

export const MAX_MONEY = 1_000_000_000;
export const MAX_QTY = 1_000_000 * 1000;

/** نفس DECIMAL_UNITS في backend/products/constants.py. */
export const BACKEND_DECIMAL_UNITS: ReadonlySet<string> = new Set([
  "كيلو",
  "كجم",
  "جرام",
  "لتر",
  "متر",
]);

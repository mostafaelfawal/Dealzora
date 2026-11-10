import {
  IGNORE,
  IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
  type MappingValue,
} from "../config/importFields";

/**
 * يربط عموداً بحقل. كل حقل يُربط بعمود واحد فقط:
 * ربطه بعمود جديد يفك ربطه من القديم.
 */
export function assignColumn(
  mapping: ColumnMapping,
  column: string,
  value: MappingValue,
): ColumnMapping {
  const next = { ...mapping };
  if (value !== IGNORE) {
    for (const key of Object.keys(next)) {
      if (next[key] === value) next[key] = IGNORE;
    }
  }
  next[column] = value;
  return next;
}

export interface MappingCoverage {
  covered: ReadonlySet<MappingValue>;
  coveredCount: number;
  missingRequired: ImportField[];
}

/** أي الحقول مربوطة، وأي الحقول المطلوبة ما زالت ناقصة. */
export function mappingCoverage(mapping: ColumnMapping): MappingCoverage {
  const covered = new Set(Object.values(mapping));
  return {
    covered,
    coveredCount: IMPORT_FIELDS.filter((f) => covered.has(f.key)).length,
    missingRequired: IMPORT_FIELDS.filter(
      (f) => f.required && !covered.has(f.key),
    ),
  };
}

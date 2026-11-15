/** منظومة الإيصال الإلكتروني (شكل الـ backend كما هو: الحقول snake_case، لا مال ولا كميات). */

export type EtaEnvironment = "preprod" | "prod";
export type EtaItemType = "EGS" | "GS1";
export type SecretState = "unset" | "set" | "unreadable";
export type SecretAction = "keep" | "set" | "clear";

export interface EtaConfig {
  enabled: boolean;
  environment: EtaEnvironment;
  rin: string | null;
  company_trade_name: string | null;
  activity_code: string | null;
}

export interface EtaBranch {
  branch_code: string | null;
  country: string;
  governate: string | null;
  region_city: string | null;
  street: string | null;
  building_number: string | null;
  postal_code: string | null;
  floor: string | null;
  room: string | null;
  landmark: string | null;
  additional_information: string | null;
}

export interface EtaDevice {
  device_id: string;
  name: string;
  is_main: boolean;
  pos_serial: string | null;
  pos_os_version: string | null;
  pos_model_framework: string | null;
  client_id: string | null;
  /** الحالة فقط: السر نفسه لا يرجع من السيرفر أبداً. */
  client_secret: SecretState;
  preshared_key: SecretState;
}

export interface EtaDeviceInput {
  pos_serial: string | null;
  pos_os_version: string | null;
  pos_model_framework: string | null;
  client_id: string | null;
  client_secret_action: SecretAction;
  client_secret: string | null;
  preshared_key_action: SecretAction;
  preshared_key: string | null;
}

export interface EtaUnit {
  id: string;
  name: string;
  eta_unit_type: string | null;
  suggested: string | null;
  product_count: number;
}

export interface EtaCode {
  code: string;
  desc_en: string;
  desc_ar: string;
  ref: string | null;
}

export type CodeTableName =
  | "units"
  | "activities"
  | "tax_types"
  | "non_taxable_tax_types"
  | "tax_subtypes"
  | "payment_methods"
  | "buyer_types";

export type ReadinessSection =
  "tax" | "shop" | "branch" | "devices" | "units" | "products";

export interface ReadinessItem {
  key: string;
  section: ReadinessSection;
  severity: "blocker" | "warning";
  title: string;
  detail: string | null;
  count: number | null;
  samples: string[];
  ref_id: string | null;
}

export interface Readiness {
  ready: boolean;
  blockers: number;
  warnings: number;
  items: ReadinessItem[];
}

export type LicenseState =
  | "not_started"
  | "trial"
  | "licensed"
  | "expired"
  | "tampered"
  | "wrong_machine";

export interface LicenseStatus {
  state: LicenseState;
  reason: string | null;
  kind: "trial" | "licensed" | null;
  shop_name: string | null;
  expires_at: number | null;
  days_left: number | null;
  machine_id: string;
}

export interface SetupPayload {
  shopName: string;
  username: string;
  password: string;
}

export type SetupStep = "idle" | "trial" | "account" | "login";

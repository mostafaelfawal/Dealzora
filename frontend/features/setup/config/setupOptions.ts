export const TRIAL_DAYS = 10;

export const SHOP_NAME_MIN = 2;
export const SHOP_NAME_MAX = 100;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 50;
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export const SETUP_FIELD_IDS = {
  shopName: "setup-shop-name",
  username: "setup-username",
  password: "setup-password",
  confirm: "setup-confirm",
} as const;

export const SETUP_ROUTE = "/setup";

export const TRIAL_PERKS = [
  `${TRIAL_DAYS} أيام تجربة كاملة بكل المزايا`,
  "بدون بطاقة بنكية ولا التزام",
  "بياناتك مشفّرة ومحفوظة على جهازك فقط",
] as const;
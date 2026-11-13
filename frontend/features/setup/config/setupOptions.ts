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

/** خطة «بَسطة» المجانية للأبد (نفس حدود backend/app/core/plan.py). */
export const TRIAL_PERKS = [
  "خطة «بَسطة» مجانية للأبد: بيع نقدي وطباعة ومرتجعات حتى 300 صنف",
  "بدون بطاقة بنكية ولا التزام، ورقِّ خطتك وقت ما تحتاج",
  "بياناتك مشفّرة ومحفوظة على جهازك فقط",
] as const;

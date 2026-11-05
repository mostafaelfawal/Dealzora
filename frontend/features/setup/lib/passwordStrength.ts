export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ["", "ضعيفة", "مقبولة", "جيدة", "قوية"] as const;

export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: "" };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) =>
    r.test(password),
  ).length;
  const len = [...password].length;
  let score = 0;
  if (len >= 10) score++;
  if (len >= 14) score++;
  if (classes >= 3) score++;
  if (len >= 12 && classes === 4) score++;
  const s = Math.min(score, 4) as Strength["score"];
  return { score: s, label: LABELS[s] };
}

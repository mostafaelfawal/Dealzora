/**
 * الرمز السري للقفل: تعيين (جديد ← تأكيد)، تغيير (الحالي ← جديد ← تأكيد)، أو إيقاف (الحالي).
 * أي تغيير يتطلب الرمز الحالي، فمن يمسك الهاتف مفتوحاً لا يقدر يغيّره أو يلغيه.
 */
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { Screen } from "@/components/shared/Screen";
import { signOut } from "@/features/auth/lib/session";
import { PinField } from "@/features/lock/components/PinField";
import {
  clearPin,
  pinProblem,
  savePin,
  verifyPin,
} from "@/features/lock/lib/pin";
import { space } from "@/theme/colors";

type Mode = "set" | "change" | "remove";
type Step = "current" | "new" | "confirm";

const TITLE: Record<Step, string> = {
  current: "اكتب الرمز الحالي",
  new: "اختر رمزاً جديداً (4 إلى 8 أرقام)",
  confirm: "اكتب الرمز الجديد مرة أخرى",
};

const done = () => (router.canGoBack() ? router.back() : router.replace("/"));

export default function PinRoute() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode =
    params.mode === "change" || params.mode === "remove" ? params.mode : "set";
  const [step, setStep] = useState<Step>(mode === "set" ? "new" : "current");
  const [value, setValue] = useState("");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (step === "current") {
        const r = await verifyPin(value);
        setValue("");
        if (r.ok) {
          setError(null);
          if (mode === "remove") {
            await clearPin();
            done();
          } else setStep("new");
        } else if (r.reason === "wiped") await signOut();
        else
          setError(
            r.waitMs > 0
              ? `رمز خاطئ. انتظر ${Math.ceil(r.waitMs / 1000)} ثانية`
              : "رمز خاطئ",
          );
        return;
      }
      if (step === "new") {
        const problem = pinProblem(value);
        if (problem) return setError(problem);
        setFirst(value);
        setValue("");
        setError(null);
        setStep("confirm");
        return;
      }
      if (value !== first) {
        setValue("");
        setFirst("");
        setStep("new");
        setError("الرمزان غير متطابقين: اختر الرمز من جديد");
        return;
      }
      await savePin(value);
      done();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حفظ الرمز");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Card>
        <View style={styles.body}>
          <AppText weight="semibold" size="lg" center>
            {TITLE[step]}
          </AppText>
          <PinField
            key={step}
            value={value}
            onChange={(v) => {
              setValue(v);
              setError(null);
            }}
            onSubmit={() => void next()}
            error={error}
            autoFocus
            label={step === "confirm" ? "تأكيد الرمز" : "الرمز السري"}
          />
          <Button
            title={
              step === "confirm"
                ? "حفظ الرمز"
                : mode === "remove" && step === "current"
                  ? "إيقاف القفل بالرمز"
                  : "التالي"
            }
            variant={mode === "remove" ? "destructive" : "primary"}
            onPress={() => void next()}
            loading={busy}
            disabled={value.length < 4}
          />
        </View>
      </Card>
      <AppText size="xs" tone="muted">
        الرمز يُطلب عند فتح التطبيق وبعد دقيقة في الخلفية. 10 محاولات خاطئة تُخرجك
        من الحساب على هذا الهاتف، فاختر رمزاً تتذكره ولا تستخدم تاريخ ميلادك.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingVertical: space.md },
});

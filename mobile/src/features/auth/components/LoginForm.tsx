/**
 * دخول الهاتف: كود ربط الهاتف (يحدد المحل، مرة واحدة) + اسم المستخدم وكلمة المرور نفسها في البرنامج.
 * عنوان الخادم يُكتب مرة واحدة هنا (أو يأتي افتراضياً مع نسخة التطبيق).
 */
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type TextInputInstance } from "react-native";

import { errorMessage } from "@/api/errors";
import { isInsecureRemote, normalizeServerUrl } from "@/api/url";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { TextField } from "@/components/shared/TextField";
import { formatPairingCode } from "@/lib/format";
import { getServerUrl, setServerUrl } from "@/lib/serverUrl";
import { radius, space } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

import { useAuth } from "../hooks/useAuth";
import { signIn } from "../lib/session";

const CODE_LEN = 14; // XXXX-XXXX-XXXX

export function LoginForm() {
  const { colors } = useTheme();
  const { notice } = useAuth();
  const [server, setServer] = useState("");
  const [editServer, setEditServer] = useState(false);
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const userRef = useRef<TextInputInstance>(null);
  const passRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    void getServerUrl().then((url) => {
      setServer(url ?? "");
      setEditServer(!url);
    });
  }, []);

  const serverUrl = normalizeServerUrl(server);
  const serverError = server && !serverUrl ? "عنوان غير صالح" : null;
  const insecure = serverUrl ? isInsecureRemote(serverUrl) : false;
  const ready = !!serverUrl && code.length === CODE_LEN && username.trim().length >= 3 && password.length > 0;

  async function submit() {
    if (!ready || submitting || !serverUrl) return;
    setSubmitting(true);
    setError(null);
    try {
      await setServerUrl(serverUrl);
      await signIn({ code, username, password });
      // التنقّل يتم تلقائياً مع تغيّر حالة الدخول.
    } catch (e) {
      setError(errorMessage(e));
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.form}>
      {notice && (
        <View style={[styles.notice, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <AppText size="sm">{notice}</AppText>
        </View>
      )}

      {editServer ? (
        <TextField
          label="عنوان خادم المزامنة"
          value={server}
          onChangeText={setServer}
          placeholder="sync.example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          ltr
          error={serverError ?? (insecure ? "اتصال غير مشفّر: استخدم https لعنوان على الإنترنت" : null)}
          hint="نفس العنوان المكتوب في إعدادات المزامنة في البرنامج"
        />
      ) : (
        <View style={styles.serverRow}>
          <AppText size="sm" tone="muted" style={styles.flex} numberOfLines={1}>
            الخادم: {serverUrl?.replace(/^https?:\/\//, "")}
          </AppText>
          <Button title="تغيير" variant="ghost" onPress={() => setEditServer(true)} style={styles.smallBtn} />
        </View>
      )}

      <TextField
        label="كود ربط الهاتف"
        value={code}
        onChangeText={(t) => setCode(formatPairingCode(t))}
        placeholder="XXXX-XXXX-XXXX"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CODE_LEN}
        ltr
        returnKeyType="next"
        onSubmitEditing={() => userRef.current?.focus()}
        hint="اطلبه من البرنامج على أي جهاز في فروع المحل. صالح 15 دقيقة ومرة واحدة"
      />
      <TextField
        ref={userRef}
        label="اسم المستخدم"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        ltr
        returnKeyType="next"
        onSubmitEditing={() => passRef.current?.focus()}
      />
      <TextField
        ref={passRef}
        label="كلمة المرور"
        value={password}
        onChangeText={setPassword}
        secret
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        hint="نفس كلمة مرورك في البرنامج (للمالك ومديري الفروع)"
      />

      {error && (
        <View
          accessibilityRole="alert"
          style={[styles.notice, { backgroundColor: colors.destructiveSoft, borderColor: colors.destructive }]}
        >
          <AppText size="sm" tone="destructive">
            {error}
          </AppText>
        </View>
      )}

      <Button title="دخول" icon="log-in-outline" onPress={submit} disabled={!ready} loading={submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg },
  notice: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  serverRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  smallBtn: { minHeight: 36, paddingHorizontal: space.sm },
});

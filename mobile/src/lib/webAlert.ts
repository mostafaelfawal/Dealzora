/**
 * Alert.alert في نسخة الويب: react-native-web لا ينفّذه (لا يظهر شيء ولا يُستدعى أي زر)، فتأكيدات
 * مثل «تسجيل الخروج» و«حفظ» كانت تتعطل. هنا نستبدله بنوافذ المتصفح:
 *   زر واحد أو بلا أزرار ← alert ثم الزر.
 *   أكثر من زر ← confirm: «موافق» = آخر زر غير «إلغاء» (زر الإجراء في كل شاشات التطبيق)، و«إلغاء» = زر الإلغاء.
 * يُستورد مرة واحدة في الجذر، ولا أثر له في الهاتف.
 */
import { Alert, Platform } from "react-native";

if (Platform.OS === "web" && typeof window !== "undefined") {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join("\n\n");
    const list = buttons ?? [];
    if (list.length <= 1) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    const cancel = list.find((b) => b.style === "cancel");
    const action = [...list].reverse().find((b) => b !== cancel);
    if (window.confirm(text)) action?.onPress?.();
    else cancel?.onPress?.();
  };
}

/**
 * أسعار الأصناف المشتركة (المالك فقط): بحث بالاسم أو الباركود، وتعديل سعر البيع/الجملة لكل الفروع.
 * نفس قواعد البرنامج (البيع > 0، الجملة أقل من البيع)، وتأكيد صريح «سيصل كل الفروع»، والتعارض برسالة لا كتابة فوقه.
 * الفواتير السابقة لا تتأثر: السعر محفوظ في سطر كل فاتورة.
 */
import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";

import { errorMessage } from "@/api/errors";
import type { CatalogProduct } from "@/api/types";
import { AppText } from "@/components/shared/AppText";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { Screen } from "@/components/shared/Screen";
import { Sheet } from "@/components/shared/Sheet";
import { TextField } from "@/components/shared/TextField";
import { useCatalogSearch, useUpdatePrice } from "@/features/prices/usePrices";
import { parseMoneyInput } from "@/features/reports/lib/reportText";
import { OwnerOnly } from "@/features/security/components/OwnerOnly";
import { useIsOwner } from "@/features/security/hooks/useSecurity";
import { useOnline } from "@/hooks/useOnline";
import { formatPiastres } from "@/lib/format";
import { space } from "@/theme/colors";

export default function PricesRoute() {
  return (
    <OwnerOnly>
      <Prices />
    </OwnerOnly>
  );
}

function Prices() {
  const owner = useIsOwner();
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const q = useCatalogSearch(text, owner);
  const rows = q.data ?? [];

  return (
    <Screen>
      <TextField
        label="ابحث عن صنف"
        value={text}
        onChangeText={setText}
        placeholder="الاسم أو الباركود"
        autoCorrect={false}
        returnKeyType="search"
        hint="الأصناف المشتركة بين الفروع فقط"
      />
      {q.isFetching && <AppText tone="muted">جارٍ البحث…</AppText>}
      {q.isError && <EmptyState icon="alert-circle-outline" title="تعذّر البحث" description={errorMessage(q.error)} />}
      {rows.map((p) => (
        <Pressable key={p.gid} accessibilityRole="button" onPress={() => setEditing(p)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Card>
            <View style={styles.head}>
              <View style={styles.flex}>
                <AppText weight="semibold">{p.name}</AppText>
                <AppText size="xs" tone="muted">
                  {p.barcode ? `${p.barcode} · ` : ""}
                  {p.unit}
                  {p.is_active ? "" : " · موقوف"}
                </AppText>
              </View>
              <View style={styles.prices}>
                <Money amount={p.sale_price} weight="bold" size="sm" />
                {p.wholesale_price !== null && (
                  <AppText size="xs" tone="muted">
                    جملة {formatPiastres(p.wholesale_price)}
                  </AppText>
                )}
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
      {q.data && rows.length === 0 && text.trim().length >= 2 && (
        <EmptyState icon="search-outline" title="لا نتائج" description="جرّب جزءاً من الاسم أو أول أرقام الباركود" />
      )}
      {editing && <PriceSheet p={editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

function PriceSheet({ p, onClose }: { p: CatalogProduct; onClose: () => void }) {
  const update = useUpdatePrice();
  const online = useOnline();
  const [sale, setSale] = useState(String(p.sale_price / 100));
  const [wholesale, setWholesale] = useState(p.wholesale_price === null ? "" : String(p.wholesale_price / 100));

  const saleP = parseMoneyInput(sale);
  const wholeP = wholesale.trim() === "" ? null : parseMoneyInput(wholesale);
  const saleErr = saleP === null || saleP <= 0 ? "سعر البيع يجب أن يكون أكبر من صفر" : null;
  const wholeErr =
    wholesale.trim() !== "" && wholeP === null
      ? "مبلغ غير صالح"
      : wholeP !== null && saleP !== null && wholeP >= saleP
        ? "سعر الجملة يجب أن يكون أقل من سعر البيع"
        : null;
  const changed = saleP !== p.sale_price || wholeP !== p.wholesale_price;

  const confirm = () => {
    if (saleP === null) return;
    Alert.alert(
      "تأكيد تعديل السعر",
      `«${p.name}»: سعر البيع ${formatPiastres(p.sale_price)} ← ${formatPiastres(saleP)}` +
        (wholeP !== p.wholesale_price ? `\nالجملة: ${p.wholesale_price === null ? "—" : formatPiastres(p.wholesale_price)} ← ${wholeP === null ? "بلا" : formatPiastres(wholeP)}` : "") +
        "\n\nسيصل لكل الفروع مع مزامنتها التالية. الفواتير السابقة لا تتغير.",
      [
        { text: "رجوع", style: "cancel" },
        { text: "تعديل لكل الفروع", onPress: () => update.mutate({ p, sale_price: saleP, wholesale_price: wholeP }, { onSuccess: onClose }) },
      ],
    );
  };

  return (
    <Sheet title={p.name} onClose={onClose}>
      <AppText size="sm" tone="muted">
        آخر تعديل: {p.updated_by ?? "—"}
      </AppText>
      <TextField label="سعر البيع (ج.م)" value={sale} onChangeText={setSale} keyboardType="decimal-pad" ltr error={saleErr} />
      <TextField
        label="سعر الجملة (ج.م، اختياري)"
        value={wholesale}
        onChangeText={setWholesale}
        keyboardType="decimal-pad"
        ltr
        error={wholeErr}
        hint="اتركه فارغاً لإلغاء سعر الجملة"
      />
      <AppText size="sm" weight="medium" tone="warning">
        سيصل لكل الفروع مع مزامنتها التالية.
      </AppText>
      <Button
        title="حفظ السعر"
        icon="pricetag-outline"
        onPress={confirm}
        loading={update.isPending}
        disabled={!online || !changed || !!saleErr || !!wholeErr}
      />
      <Button title="إلغاء" variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.sm },
  flex: { flex: 1 },
  prices: { alignItems: "flex-end", maxWidth: 130 },
});

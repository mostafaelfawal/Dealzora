"use client";

import {
  IconDeviceDesktop,
  IconLoader2,
  IconPencil,
  IconPlugConnected,
} from "@tabler/icons-react";
import { useState, type FormEvent } from "react";

import { FormField } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import {
  useEtaDevices,
  useSaveEtaDevice,
  useTestConnection,
} from "../hooks/useEta";
import type {
  EtaDevice,
  EtaDeviceInput,
  SecretAction,
  SecretState,
} from "../types/eta";
import { orNull } from "./etaCodeSelect";

const SECRET_LABEL: Record<SecretState, string> = {
  set: "مُعيَّن",
  unset: "غير مُعيَّن",
  unreadable: "يحتاج إعادة إدخال",
};

function SecretBadge({ state }: { state: SecretState }) {
  return (
    <span
      className={cn(
        "text-xs",
        state === "set"
          ? "text-success"
          : state === "unreadable"
            ? "text-destructive"
            : "text-muted-foreground",
      )}
    >
      {SECRET_LABEL[state]}
    </span>
  );
}

/**
 * حقل سر: لا نعرض القيمة الحالية أبداً (السيرفر لا يرسلها). الفارغ = بدون تغيير،
 * والكتابة = استبدال، وزر «مسح» لإزالته.
 */
function SecretField({
  id,
  label,
  state,
  value,
  cleared,
  onChange,
  onClear,
  max,
}: {
  id: string;
  label: string;
  state: SecretState;
  value: string;
  cleared: boolean;
  onChange: (v: string) => void;
  onClear: () => void;
  max: number;
}) {
  return (
    <FormField
      id={id}
      label={
        <span className="flex items-center gap-2">
          {label} <SecretBadge state={cleared ? "unset" : state} />
        </span>
      }
      hint={
        state === "set" && !cleared
          ? "اتركه فارغاً للإبقاء على القيمة الحالية"
          : undefined
      }
    >
      <div className="flex gap-2">
        <Input
          id={id}
          type="password"
          autoComplete="new-password"
          dir="ltr"
          maxLength={max}
          value={value}
          placeholder={state === "set" && !cleared ? "••••••••" : ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 font-mono"
        />
        {state !== "unset" && !cleared && (
          <Button type="button" variant="outline" className="h-10" onClick={onClear}>
            مسح
          </Button>
        )}
      </div>
    </FormField>
  );
}

const secretAction = (value: string, cleared: boolean): SecretAction =>
  value ? "set" : cleared ? "clear" : "keep";

function DeviceDialog({
  device,
  onClose,
}: {
  device: EtaDevice;
  onClose: () => void;
}) {
  const save = useSaveEtaDevice();
  const [f, setF] = useState({
    serial: device.pos_serial ?? "",
    os: device.pos_os_version ?? "",
    framework: device.pos_model_framework ?? "",
    clientId: device.client_id ?? "",
    secret: "",
    secretCleared: false,
    psk: "",
    pskCleared: false,
  });
  const patch = (p: Partial<typeof f>) => setF({ ...f, ...p });

  function submit(e: FormEvent) {
    e.preventDefault();
    const data: EtaDeviceInput = {
      pos_serial: orNull(f.serial),
      pos_os_version: orNull(f.os),
      pos_model_framework: orNull(f.framework),
      client_id: orNull(f.clientId),
      client_secret_action: secretAction(f.secret, f.secretCleared),
      client_secret: f.secret || null,
      preshared_key_action: secretAction(f.psk, f.pskCleared),
      preshared_key: f.psk || null,
    };
    save.mutate({ id: device.device_id, data }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-start">
          <DialogTitle>بيانات «{device.name}» في المنظومة</DialogTitle>
          <DialogDescription>
            من بيانات الجهاز المسجّل على بوابة المنظومة. الأسرار تُحفظ مشفّرة
            ولا تظهر مرة أخرى.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="eta-dev-serial" label="الرقم التسلسلي (POS Serial)">
              <Input
                id="eta-dev-serial"
                dir="ltr"
                maxLength={100}
                value={f.serial}
                onChange={(e) => patch({ serial: e.target.value })}
                className="h-10 font-mono"
              />
            </FormField>
            <FormField id="eta-dev-client" label="Client ID">
              <Input
                id="eta-dev-client"
                dir="ltr"
                maxLength={100}
                value={f.clientId}
                onChange={(e) => patch({ clientId: e.target.value })}
                className="h-10 font-mono"
              />
            </FormField>
            <FormField id="eta-dev-os" label="إصدار نظام التشغيل (POS OS Version)">
              <Input
                id="eta-dev-os"
                dir="ltr"
                maxLength={50}
                value={f.os}
                onChange={(e) => patch({ os: e.target.value })}
                className="h-10 font-mono"
              />
            </FormField>
            <FormField id="eta-dev-fw" label="POS Model Framework">
              <Input
                id="eta-dev-fw"
                dir="ltr"
                maxLength={10}
                value={f.framework}
                onChange={(e) => patch({ framework: e.target.value })}
                className="h-10 font-mono"
              />
            </FormField>
          </div>
          <SecretField
            id="eta-dev-secret"
            label="Client Secret"
            state={device.client_secret}
            value={f.secret}
            cleared={f.secretCleared}
            onChange={(secret) => patch({ secret })}
            onClear={() => patch({ secret: "", secretCleared: true })}
            max={100}
          />
          <SecretField
            id="eta-dev-psk"
            label="المفتاح المشترك (Pre-shared key)"
            state={device.preshared_key}
            value={f.psk}
            cleared={f.pskCleared}
            onChange={(psk) => patch({ psk })}
            onClear={() => patch({ psk: "", pskCleared: true })}
            max={200}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={save.isPending}>
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** «اختبار الاتصال»: مصادقة فقط ببيانات الجهاز، والنتيجة تحته مباشرة. */
function TestConnection({ deviceId }: { deviceId: string }) {
  const test = useTestConnection();
  const result = test.data;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5"
        disabled={test.isPending}
        onClick={() => test.mutate(deviceId)}
      >
        {test.isPending ? (
          <IconLoader2 className="size-4 animate-spin" />
        ) : (
          <IconPlugConnected className="size-4" />
        )}
        اختبار الاتصال
      </Button>
      {result && (
        <p
          role="status"
          className={cn(
            "max-w-64 text-end text-xs wrap-break-word",
            result.ok ? "text-success" : "text-destructive",
          )}
        >
          {result.ok
            ? `${result.message} (${result.environment === "prod" ? "الفعلية" : "التجريبية"})`
            : result.message}
          {result.correlation_id && (
            <span className="block font-mono text-[10px] text-muted-foreground" dir="ltr">
              {result.correlation_id}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/** كل جهاز يصدر إيصالات (الأساسي وأجهزة الكاشير المقترنة) يحتاج بياناته في المنظومة. */
export function EtaDevices() {
  const { data } = useEtaDevices();
  const [editing, setEditing] = useState<EtaDevice | null>(null);
  if (!data) return <Skeleton className="h-24 w-full" />;

  return (
    <>
      <ul className="divide-y border">
        {data.map((d) => (
          <li key={d.device_id} className="flex items-center gap-3 p-3">
            <IconDeviceDesktop className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1 space-y-0.5 text-sm">
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground" dir="auto">
                {d.pos_serial ? (
                  <bdi className="font-mono">{d.pos_serial}</bdi>
                ) : (
                  "بدون رقم تسلسلي"
                )}
                {" · Client Secret: "}
                <SecretBadge state={d.client_secret} />
              </p>
            </div>
            <TestConnection deviceId={d.device_id} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setEditing(d)}
            >
              <IconPencil className="size-4" /> تعديل
            </Button>
          </li>
        ))}
      </ul>
      {editing && (
        <DeviceDialog
          key={editing.device_id}
          device={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

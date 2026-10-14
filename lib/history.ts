import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActivityRecord } from "@/types";

const STORAGE_KEY = "firma-clara:activity";

function isActivityRecord(value: unknown): value is ActivityRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Partial<ActivityRecord>;
  return typeof record.id === "string"
    && (record.action === "sign" || record.action === "verify")
    && (["PDF", "P7S", "XML", "JWS"] as const).includes(record.format as "PDF" | "P7S" | "XML" | "JWS")
    && typeof record.fileName === "string"
    && typeof record.fileSize === "number"
    && record.fileSize >= 0
    && (["valid", "invalid", "indeterminate", "signed"] as const).includes(record.status as ActivityRecord["status"])
    && typeof record.createdAt === "string"
    && !Number.isNaN(Date.parse(record.createdAt));
}

export function getLocalHistory(): ActivityRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isActivityRecord).slice(0, 25) : [];
  } catch {
    return [];
  }
}

export async function saveActivity(record: Omit<ActivityRecord, "id" | "createdAt">): Promise<ActivityRecord> {
  const activity: ActivityRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const current = getLocalHistory();
      localStorage.setItem(STORAGE_KEY, JSON.stringify([activity, ...current].slice(0, 25)));
      window.dispatchEvent(new CustomEvent("firma-clara:history"));
    } catch {
      // El historial es complementario y nunca debe impedir una firma o verificación.
    }
  }

  try {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await supabase.from("activities").insert({
          user_id: data.user.id,
          action: activity.action,
          format: activity.format,
          file_name: activity.fileName,
          file_size: activity.fileSize,
          status: activity.status,
          digest: activity.digest ?? null,
        });
      }
    }
  } catch {
    // La sincronización remota también es opcional.
  }

  return activity;
}

export function clearLocalHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("firma-clara:history"));
  } catch {
    // Algunos navegadores pueden bloquear el almacenamiento local.
  }
}

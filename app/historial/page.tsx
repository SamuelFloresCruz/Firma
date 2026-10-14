"use client";

import Link from "next/link";
import { FileCheck2, History, PenLine, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { clearLocalHistory, getLocalHistory } from "@/lib/history";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ActivityRecord } from "@/types";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(date);
}

export default function HistoryPage() {
  const [items, setItems] = useState<ActivityRecord[]>([]);

  useEffect(() => {
    const refresh = async () => {
      const local = getLocalHistory();
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return setItems(local);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return setItems(local);
      const { data } = await supabase.from("activities").select("*").order("created_at", { ascending: false }).limit(50);
      if (!data) return setItems(local);
      setItems(data.map((row) => ({
        id: row.id,
        action: row.action,
        format: row.format,
        fileName: row.file_name,
        fileSize: row.file_size,
        status: row.status,
        digest: row.digest ?? undefined,
        createdAt: row.created_at,
      })) as ActivityRecord[]);
    };
    const onHistory = () => { void refresh(); };
    void refresh();
    window.addEventListener("firma-clara:history", onHistory);
    const subscription = getSupabaseBrowserClient()?.auth.onAuthStateChange(() => { void refresh(); });
    return () => {
      window.removeEventListener("firma-clara:history", onHistory);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  async function clear() {
    clearLocalHistory();
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      if (data.user) await supabase.from("activities").delete().eq("user_id", data.user.id);
    }
    setItems([]);
  }

  return (
    <>
      <section className="page-hero section-pad">
        <span className="eyebrow"><History size={15} /> Actividad</span>
        <h1>Tu recorrido reciente.</h1>
        <p>El historial local conserva únicamente metadatos y huellas digitales. Nunca guarda el contenido de tus documentos.</p>
      </section>
      <section className="history-wrap">
        <div className="history-toolbar"><p>{items.length} {items.length === 1 ? "operación guardada" : "operaciones guardadas"} en este navegador</p>{items.length > 0 && <button className="button button-ghost button-small" onClick={clear}><Trash2 size={15} /> Limpiar historial</button>}</div>
        {items.length === 0 ? (
          <div className="empty-state"><span><History size={28} /></span><h2>Todavía no hay actividad</h2><p>Firma o verifica un archivo y aparecerá aquí.</p><Link href="/firmar" className="button button-primary" style={{ marginTop: 12 }}>Crear primera firma</Link></div>
        ) : (
          <div className="history-list">
            {items.map((item) => (
              <article className="history-item" key={item.id}>
                <span className="history-icon">{item.action === "sign" ? <PenLine size={19} /> : <FileCheck2 size={19} />}</span>
                <div><strong>{item.fileName}</strong><small>{item.action === "sign" ? "Firma creada" : "Verificación realizada"} · {item.format} · {(item.fileSize / 1024).toFixed(1)} KB</small></div>
                <span className={`status-badge ${item.status}`}>{item.status === "signed" ? "Firmado" : item.status === "valid" ? "Válido" : item.status === "invalid" ? "Inválido" : "Sin decisión"}</span>
                <time>{formatDate(item.createdAt)}</time>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

"use client";

import { LogIn, LogOut, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

function authErrorMessage(message: string): string {
  if (message.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (message.includes("User already registered")) return "Ya existe una cuenta con este correo.";
  if (message.includes("Email signups are disabled")) return "El registro por correo está desactivado en Supabase.";
  if (message.includes("Password should be")) return "La contraseña no cumple la longitud mínima configurada.";
  return message;
}

export function AuthButton() {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password"));
    setBusy(true);
    setMessage("");
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) setMessage(authErrorMessage(result.error.message));
      else if (mode === "signup" && !result.data.session) setMessage("Revisa tu correo para confirmar la cuenta.");
      else setOpen(false);
    } catch {
      setMessage("No se pudo conectar con Supabase. Inténtalo nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await getSupabaseBrowserClient()?.auth.signOut();
  }

  if (!configured) {
    return <span className="local-mode"><span /> Modo local</span>;
  }

  return (
    <>
      {user ? (
        <button className="user-chip" onClick={logout} title="Cerrar sesión">
          <UserRound size={16} />
          <span>{user.email?.split("@")[0]}</span>
          <LogOut size={15} />
        </button>
      ) : (
        <button className="button button-small button-ghost" onClick={() => setOpen(true)}>
          <LogIn size={16} /> Entrar
        </button>
      )}

      {open && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close" onClick={() => setOpen(false)} aria-label="Cerrar"><X size={20} /></button>
            <span className="eyebrow">Cuenta opcional</span>
            <h2 id="auth-title">{mode === "login" ? "Continúa donde lo dejaste" : "Crea tu espacio personal"}</h2>
            <p>Accede de forma segura con tu cuenta. Los documentos y las llaves permanecen en tu dispositivo.</p>
            <form onSubmit={submit} className="stack-form">
              <label>Correo electrónico<input name="email" type="email" required maxLength={254} autoComplete="email" placeholder="tu@correo.com" /></label>
              <label>Contraseña<input name="password" type="password" minLength={6} required autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Mínimo 6 caracteres" /></label>
              {message && <div className="form-message">{message}</div>}
              <button className="button button-primary" disabled={busy}>{busy ? "Procesando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
            </form>
            <button className="text-button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
              {mode === "login" ? "¿Primera vez? Crear una cuenta" : "Ya tengo una cuenta"}
            </button>
          </section>
        </div>
      )}
    </>
  );
}

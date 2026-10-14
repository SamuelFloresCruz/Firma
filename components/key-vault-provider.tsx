"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createKeyPair, type GeneratedKeyPair } from "@/lib/crypto";

interface KeyVaultContextValue {
  keys: GeneratedKeyPair | null;
  busy: boolean;
  generate: () => Promise<GeneratedKeyPair>;
}

const KeyVaultContext = createContext<KeyVaultContextValue | null>(null);

export function KeyVaultProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<GeneratedKeyPair | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = useCallback(async () => {
    setBusy(true);
    try {
      const nextKeys = await createKeyPair();
      setKeys(nextKeys);
      return nextKeys;
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(() => ({ keys, busy, generate }), [keys, busy, generate]);
  return <KeyVaultContext.Provider value={value}>{children}</KeyVaultContext.Provider>;
}

export function useKeyVault(): KeyVaultContextValue {
  const context = useContext(KeyVaultContext);
  if (!context) throw new Error("useKeyVault debe usarse dentro de KeyVaultProvider.");
  return context;
}

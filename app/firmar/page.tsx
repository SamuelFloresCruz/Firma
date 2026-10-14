"use client";

import { FormEvent, useState } from "react";
import { Check, Download, FileKey2, Info, KeyRound, PenLine, RotateCcw } from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { useKeyVault } from "@/components/key-vault-provider";
import { downloadBlob, signFile, validateFileForSigning } from "@/lib/crypto";
import { saveActivity } from "@/lib/history";
import type { SignatureFormat, SignatureManifest } from "@/types";

const formatInfo: Record<SignatureFormat, { accept: string; hint: string; description: string }> = {
  PDF: { accept: ".pdf,application/pdf", hint: "Documento PDF · máximo 20 MB", description: "La firma se añade sin alterar la visualización del PDF." },
  P7S: { accept: "*/*", hint: "Cualquier archivo · máximo 20 MB", description: "Crea una firma separada; necesitarás el original para verificarla." },
  XML: { accept: ".xml,text/xml,application/xml", hint: "Documento XML · máximo 20 MB", description: "Envuelve el XML en un contenedor firmado y verificable." },
  JWS: { accept: ".json,.txt,application/json,text/plain", hint: "JSON o texto · máximo 20 MB", description: "Genera un JWS compacto real utilizando el algoritmo RS256." },
};

interface SignResult {
  blob: Blob;
  fileName: string;
  manifest: SignatureManifest;
}

export default function SignPage() {
  const [format, setFormat] = useState<SignatureFormat>("PDF");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<SignResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { keys, generate, busy: keyBusy } = useKeyVault();

  function chooseFormat(next: SignatureFormat) {
    setFormat(next);
    setFile(null);
    setResult(null);
    setError("");
  }

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    setResult(null);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setError("Selecciona un archivo antes de continuar.");
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const organization = String(data.get("organization") ?? "").trim();
    if (!name || !email) return setError("Completa el nombre y el correo del firmante.");

    setBusy(true);
    setError("");
    try {
      await validateFileForSigning(file, format);
      const activeKeys = keys ?? await generate();
      const signed = await signFile(file, format, { name, email, organization }, activeKeys);
      setResult(signed);
      void saveActivity({ action: "sign", format, fileName: file.name, fileSize: file.size, status: "signed", digest: signed.manifest.digest });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo firmar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setFile(null);
    setResult(null);
    setError("");
  }

  return (
    <>
      <section className="page-hero section-pad">
        <span className="eyebrow"><PenLine size={15} /> Firmar documento</span>
        <h1>Crear firma digital</h1>
        <p>Selecciona el archivo, completa los datos del firmante y descarga el resultado.</p>
      </section>

      <div className="workspace">
        <section className="workspace-main">
          {result ? (
            <div aria-live="polite">
              <div className="result-banner valid"><span><Check size={23} /></span><div><h2>Firma creada</h2><p>El archivo está listo para descargar.</p></div></div>
              <div className="detail-grid">
                <div className="detail-item"><span>Archivo generado</span><strong>{result.fileName}</strong></div>
                <div className="detail-item"><span>Formato</span><strong>{result.manifest.format}</strong></div>
                <div className="detail-item"><span>Algoritmo</span><strong>RS256 · SHA-256</strong></div>
                <div className="detail-item"><span>Firmante</span><strong>{result.manifest.signer.name}</strong></div>
                <div className="detail-item" style={{ gridColumn: "1 / -1" }}><span>Huella del contenido</span><strong>{result.manifest.digest}</strong></div>
              </div>
              <div className="success-actions">
                <button className="button button-primary" onClick={() => downloadBlob(result.blob, result.fileName)}><Download size={17} /> Descargar archivo firmado</button>
                <button className="button button-secondary" onClick={restart}><RotateCcw size={16} /> Firmar otro</button>
              </div>
              {result.manifest.format === "P7S" && <div className="side-note" style={{ marginTop: 20 }}>Conserva el documento original junto con el archivo `.p7s`; la firma separada no contiene el documento.</div>}
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="workspace-title"><span>1</span><div><h2>Formato</h2><p>Selecciona el tipo de firma.</p></div></div>
              <div className="format-tabs">
                {(["PDF", "P7S", "XML", "JWS"] as SignatureFormat[]).map((item) => <button type="button" className={`format-tab ${format === item ? "active" : ""}`} key={item} onClick={() => chooseFormat(item)}>{item}</button>)}
              </div>
              <p className="side-note"><Info size={13} /> {formatInfo[format].description}</p>

              <div className="section-divider" />
              <div className="workspace-title"><span>2</span><div><h2>Documento</h2><p>Selecciona el archivo que vas a firmar.</p></div></div>
              <FileDropzone file={file} onFile={selectFile} accept={formatInfo[format].accept} hint={formatInfo[format].hint} />

              <div className="section-divider" />
              <div className="workspace-title"><span>3</span><div><h2>Datos del firmante</h2><p>Se incluirán en la firma.</p></div></div>
              <div className="stack-form">
                <div className="field-grid">
                  <label>Nombre completo<input name="name" required maxLength={120} placeholder="Ej. Ana Pérez" /></label>
                  <label>Correo electrónico<input name="email" required type="email" maxLength={254} placeholder="ana@universidad.edu" /></label>
                </div>
                <label>Universidad u organización <span style={{ fontWeight: 500, color: "#82908c" }}>(opcional)</span><input name="organization" maxLength={160} placeholder="Universidad Mayor de…" /></label>
              </div>

              <div className="section-divider" />
              <div className={`key-state ${keys ? "ready" : ""}`}>
                <span><KeyRound size={20} /></span>
                <div><strong>{keys ? "Llave lista para firmar" : "La llave se creará al firmar"}</strong><small>{keys ? keys.fingerprint : "RSA 2048 · permanecerá solo en esta pestaña"}</small></div>
                {keys && <Check size={19} />}
              </div>
              {error && <div className="form-message" style={{ marginTop: 14 }}>{error}</div>}
              <button type="submit" className="button button-primary button-block button-large" style={{ marginTop: 17 }} disabled={!file || busy || keyBusy}><FileKey2 size={19} />{busy || keyBusy ? "Creando firma…" : `Firmar como ${format}`}</button>
            </form>
          )}
        </section>

        <aside className="workspace-side">
          <div className="side-card"><div className="side-note">La identidad del firmante es autodeclarada.</div></div>
        </aside>
      </div>
    </>
  );
}

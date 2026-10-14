"use client";

import { useEffect, useState } from "react";
import { FileCheck2, FileSearch, ScanSearch, Upload } from "lucide-react";
import { FileDropzone } from "@/components/file-dropzone";
import { ValidationView } from "@/components/validation-view";
import { inferFormat, verifyFile } from "@/lib/crypto";
import { saveActivity } from "@/lib/history";
import type { ValidationResult } from "@/types";

export default function VerifyPage() {
  const [file, setFile] = useState<File | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setResult(null); setError(""); setOriginal(null); }, [file]);

  async function runValidation() {
    if (!file) return setError("Selecciona un archivo firmado.");
    setBusy(true);
    setError("");
    try {
      const nextResult = await verifyFile(file, original);
      setResult(nextResult);
      void saveActivity({
        action: "verify",
        format: nextResult.format,
        fileName: file.name,
        fileSize: file.size,
        status: nextResult.status === "valid" ? "valid" : nextResult.status === "invalid" ? "invalid" : "indeterminate",
        digest: nextResult.digest,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo analizar el archivo.");
    } finally {
      setBusy(false);
    }
  }

  function selectOriginal(nextFile?: File) {
    setResult(null);
    setError("");
    if (!nextFile) return setOriginal(null);
    if (nextFile.size === 0) {
      setOriginal(null);
      return setError("El documento original está vacío.");
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setOriginal(null);
      return setError("El documento original supera el límite de 20 MB.");
    }
    setOriginal(nextFile);
  }

  const isP7s = file ? inferFormat(file.name) === "P7S" : false;

  return (
    <>
      <section className="page-hero section-pad">
        <span className="eyebrow"><ScanSearch size={15} /> Verificar documento</span>
        <h1>Validar firma digital</h1>
        <p>Selecciona un archivo para comprobar su firma e integridad.</p>
      </section>

      <div className="workspace">
        <section className="workspace-main">
          <div className="workspace-title"><span>1</span><div><h2>Archivo firmado</h2><p>Formatos admitidos: PDF, P7S, XML y JWS.</p></div></div>
          <FileDropzone file={file} onFile={setFile} accept=".pdf,.p7s,.xml,.jws" hint="PDF, P7S, XML o JWS · máximo 20 MB" />

          {isP7s && (
            <div className="original-picker">
              <label><Upload size={16} /><span>{original ? `Original: ${original.name}` : "Seleccionar el documento original requerido por P7S"}</span><input type="file" aria-label="Documento original para verificar P7S" onChange={(event) => { selectOriginal(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
            </div>
          )}

          {error && <div className="form-message" style={{ marginTop: 14 }}>{error}</div>}
          <button className="button button-primary button-block button-large" style={{ marginTop: 17 }} disabled={!file || busy} onClick={runValidation}><FileSearch size={19} /> {busy ? "Verificando…" : "Verificar firma"}</button>

          {result && <><div className="section-divider" /><ValidationView result={result} /></>}
        </section>

        <aside className="workspace-side">
          <div className="side-card"><h3><FileCheck2 size={17} /> Validación</h3><ul><li>Firma RSA.</li><li>Huella SHA-256.</li><li>Datos del firmante.</li></ul></div>
        </aside>
      </div>
    </>
  );
}

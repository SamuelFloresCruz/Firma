import { AlertTriangle, Check, CircleX, Clock3, Fingerprint, ShieldAlert } from "lucide-react";
import type { ValidationResult } from "@/types";

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" }).format(new Date(value));
}

export function ValidationView({ result }: { result: ValidationResult }) {
  const StatusIcon = result.status === "valid" ? Check : result.status === "invalid" ? CircleX : AlertTriangle;

  return (
    <div aria-live="polite">
      <div className={`result-banner ${result.status}`}>
        <span><StatusIcon size={23} /></span>
        <div><h2>{result.title}</h2><p>{result.summary}</p></div>
      </div>

      <div className="checks-list">
        {result.checks.map((check) => (
          <div className={`check-row ${check.status}`} key={check.label}>
            <span>{check.status === "passed" ? <Check size={16} /> : check.status === "failed" ? <CircleX size={16} /> : <ShieldAlert size={16} />}</span>
            <div><strong>{check.label}</strong><p>{check.detail}</p></div>
          </div>
        ))}
      </div>

      {result.manifest && (
        <div className="detail-grid">
          <div className="detail-item"><span>Firmante</span><strong>{result.manifest.signer.name}</strong></div>
          <div className="detail-item"><span>Correo</span><strong>{result.manifest.signer.email}</strong></div>
          <div className="detail-item"><span>Fecha de firma</span><strong><Clock3 size={11} /> {displayDate(result.manifest.signedAt)}</strong></div>
          <div className="detail-item"><span>Algoritmo</span><strong>{result.manifest.algorithm} · {result.manifest.digestAlgorithm}</strong></div>
          <div className="detail-item"><span>Huella de la llave</span><strong className="fingerprint-value" title={result.manifest.signer.fingerprint}><Fingerprint size={11} /> {result.manifest.signer.fingerprint}</strong></div>
          <div className="detail-item"><span>Archivo original</span><strong>{result.manifest.originalName}</strong></div>
        </div>
      )}
    </div>
  );
}

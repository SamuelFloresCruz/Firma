import Link from "next/link";
import {
  ArrowRight,
  FileBadge,
  FileCheck2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  PenLine,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

const formats = [
  { code: "PDF", name: "Documento PDF", tone: "coral", detail: "Firma integrada" },
  { code: "P7S", name: "Firma separada", tone: "violet", detail: "Archivo original + firma" },
  { code: "XML", name: "Documento XML", tone: "blue", detail: "Contenido estructurado" },
  { code: "JWS", name: "Firma web", tone: "green", detail: "Formato compacto RS256" },
];

export default function HomePage() {
  return (
    <>
      <section className="hero section-pad">
        <div className="hero-copy">
          <div className="eyebrow"><ShieldCheck size={15} /> Firma digital</div>
          <h1>Firma y verifica<br /><span>documentos.</span></h1>
          <p className="hero-lead">Procesa archivos PDF, P7S, XML y JWS directamente en tu navegador.</p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/firmar"><PenLine size={19} /> Firmar un archivo <ArrowRight size={18} /></Link>
            <Link className="button button-secondary button-large" href="/verificar"><ScanSearch size={19} /> Verificar una firma</Link>
          </div>
          <div className="privacy-line"><LockKeyhole size={16} /><span>Tus archivos y llaves privadas no salen de tu dispositivo.</span></div>
        </div>

        <div className="hero-visual" aria-label="Representación de una firma digital verificada">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="trust-card">
            <div className="trust-card-top">
              <div className="document-icon"><FileBadge /></div>
              <div><span>contrato-firmado.pdf</span><small>1.8 MB · PDF</small></div>
              <span className="status-dot" />
            </div>
            <div className="signature-wave"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
            <div className="verified-seal"><ShieldCheck size={30} /><div><strong>Integridad válida</strong><span>SHA-256 · RS256</span></div></div>
            <div className="trust-meta"><span><Fingerprint size={15} /> Huella coincidente</span></div>
          </div>
          <div className="float-chip chip-key"><KeyRound size={16} /> Firma digital</div>
          <div className="float-chip chip-format">4 formatos</div>
        </div>
      </section>

      <section className="format-strip" aria-labelledby="formats-title">
        <div className="section-heading inline-heading">
          <div><span className="eyebrow">Compatibilidad</span><h2 id="formats-title">Formatos disponibles</h2></div>
        </div>
        <div className="format-grid">
          {formats.map((format) => (
            <article className="format-card" key={format.code}>
              <span className={`format-code ${format.tone}`}>{format.code}</span>
              <div><h3>{format.name}</h3><p>{format.detail}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="how-section section-pad">
        <div className="section-heading centered">
          <span className="eyebrow">Proceso</span>
          <h2>Simple y directo</h2>
        </div>
        <div className="steps-grid">
          <article><span className="step-number">01</span><div className="step-icon"><FileCheck2 /></div><h3>Selecciona</h3><p>Carga el documento y elige el formato.</p></article>
          <article><span className="step-number">02</span><div className="step-icon"><KeyRound /></div><h3>Firma</h3><p>La operación se realiza localmente con tu llave.</p></article>
          <article><span className="step-number">03</span><div className="step-icon"><ShieldCheck /></div><h3>Verifica</h3><p>Comprueba la firma y la integridad del archivo.</p></article>
        </div>
      </section>
    </>
  );
}

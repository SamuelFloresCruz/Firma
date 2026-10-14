import Link from "next/link";
import { ArrowRight, FileCode2, Fingerprint, GraduationCap, KeyRound, ShieldCheck } from "lucide-react";

export default function LearnPage() {
  return (
    <>
      <section className="page-hero section-pad">
        <span className="eyebrow"><GraduationCap size={15} /> Guía rápida</span>
        <h1>Entiende lo que firmas.</h1>
        <p>Una explicación directa de las piezas que convierten un archivo común en una evidencia verificable.</p>
      </section>
      <div className="learn-wrap">
        <nav className="learn-nav" aria-label="Temas de la guía"><a href="#proceso">El proceso</a><a href="#formatos">Formatos</a><a href="#confianza">Confianza</a><a href="#alcance">Alcance</a></nav>

        <section className="learn-section" id="proceso">
          <h2>¿Qué sucede al firmar?</h2>
          <p>No se “dibuja” una rúbrica sobre el archivo. Primero se calcula una huella matemática única; luego esa huella queda vinculada a la llave privada mediante una operación criptográfica.</p>
          <div className="concept-flow">
            <div><FileCode2 /><strong>Documento</strong></div><ArrowRight />
            <div><Fingerprint /><strong>Huella SHA-256</strong></div><ArrowRight />
            <div><KeyRound /><strong>Firma RSA</strong></div>
          </div>
          <p>Durante la verificación se repite el cálculo. Si cambia incluso un carácter, la nueva huella deja de coincidir y el resultado pasa a ser inválido.</p>
        </section>

        <section className="learn-section" id="formatos">
          <h2>Los cuatro formatos disponibles</h2>
          <p>Cada formato resuelve una necesidad distinta. Todos emplean RSA con SHA-256.</p>
          <table className="compare-table">
            <thead><tr><th>Formato</th><th>Contenido</th><th>Firma</th><th>Uso habitual</th></tr></thead>
            <tbody>
              <tr><td>PDF</td><td>Documento visual</td><td>Incrustada al final</td><td>Contratos e informes</td></tr>
              <tr><td>P7S</td><td>Cualquier archivo</td><td>Separada</td><td>Comprender detached signatures</td></tr>
              <tr><td>XML</td><td>Datos estructurados</td><td>Documento envolvente</td><td>Trámites y mensajes</td></tr>
              <tr><td>JWS</td><td>Texto o JSON</td><td>Compacta en 3 segmentos</td><td>APIs y comunicación web</td></tr>
            </tbody>
          </table>
        </section>

        <section className="learn-section" id="confianza">
          <h2>Confianza de la firma</h2>
          <p>La aplicación comprueba que una llave concreta firmó el contenido y que el archivo no cambió después de la firma.</p>
          <div className="concept-flow">
            <div><KeyRound /><strong>Llave generada</strong></div><ArrowRight />
            <div><ShieldCheck /><strong>Integridad comprobable</strong></div><ArrowRight />
            <div><Fingerprint /><strong>Resultado verificable</strong></div>
          </div>
          <p>Los datos del firmante y la huella de la llave pública quedan incluidos para facilitar su identificación durante la verificación.</p>
        </section>

        <section className="learn-section" id="alcance">
          <h2>Qué implementa esta versión</h2>
          <p>Firma y verificación local con Web Crypto; JWS compacto; contenedores verificables para PDF, P7S y XML; generación temporal de pares RSA; historial de metadatos e integración opcional con Supabase.</p>
          <p>Los archivos creados con otros sistemas se identifican y se informa cuando requieren un validador compatible con su estándar.</p>
          <Link href="/firmar" className="button button-primary" style={{ marginTop: 8 }}>Firmar un documento <ArrowRight size={17} /></Link>
        </section>
      </div>
    </>
  );
}

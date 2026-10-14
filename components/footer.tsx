import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="brand footer-brand"><span className="brand-mark"><ShieldCheck size={19} /></span><span>Firma<span>Clara</span></span></div>
          <p>Firma y verificación de documentos digitales.</p>
        </div>
        <div>
          <h3>Operaciones</h3>
          <Link href="/firmar">Firmar</Link>
          <Link href="/verificar">Verificar</Link>
        </div>
        <div>
          <h3>Seguridad</h3>
          <span>RSA 2048 · SHA-256</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Firma Clara</span>
      </div>
    </footer>
  );
}

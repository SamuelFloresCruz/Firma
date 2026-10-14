"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileCheck2, History, Menu, PenLine, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { AuthButton } from "@/components/auth-button";

const links = [
  { href: "/firmar", label: "Firmar", icon: PenLine },
  { href: "/verificar", label: "Verificar", icon: FileCheck2 },
  { href: "/historial", label: "Historial", icon: History },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand" aria-label="Firma Clara, inicio" onClick={() => setOpen(false)}>
          <span className="brand-mark"><ShieldCheck size={22} strokeWidth={2.4} /></span>
          <span>Firma<span>Clara</span></span>
        </Link>

        <nav className={`nav-links ${open ? "is-open" : ""}`} aria-label="Navegación principal">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
          <div className="mobile-auth"><AuthButton /></div>
        </nav>

        <div className="desktop-auth"><AuthButton /></div>
        <button className="menu-button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? "Cerrar menú" : "Abrir menú"}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

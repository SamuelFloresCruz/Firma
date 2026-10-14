import type { Metadata, Viewport } from "next";
import "./globals.css";
import { KeyVaultProvider } from "@/components/key-vault-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: { default: "Firma Clara", template: "%s · Firma Clara" },
  description: "Firma y verifica documentos digitales de forma local.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071a17",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <KeyVaultProvider>
          <div className="site-shell">
            <Header />
            <main>{children}</main>
            <Footer />
          </div>
        </KeyVaultProvider>
      </body>
    </html>
  );
}

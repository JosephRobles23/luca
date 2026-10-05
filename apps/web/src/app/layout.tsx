import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_BOOT } from "@/components/ThemeToggle";
import { SITE } from "@/lib/seo";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Favicon, iconos y la imagen para redes salen de los archivos de src/app (ver scripts/brand-assets.py).
// La URL canónica va en cada página: si se pusiera aquí, todas heredarían la de la portada.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s · Luca" },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["gastos personales", "finanzas personales", "BCP", "Yape", "Perú", "Google Sheets", "presupuesto", "control de gastos", "privacidad", "MCP"],
  authors: [{ name: "Luca", url: SITE.url }],
  creator: "Luca",
  category: "finance",
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: { type: "website", siteName: SITE.name, locale: SITE.locale, url: "/", title: SITE.title, description: SITE.description },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0b0b" }, { media: "(prefers-color-scheme: light)", color: "#f4efe8" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head>
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { THEME_BOOT } from "@/components/ThemeToggle";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Luca",
  description: "Tus gastos de BCP y Yape, ordenados. En tu Google: Luca no guarda ninguna transacción.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0b0b" }, { media: "(prefers-color-scheme: light)", color: "#f4efe8" }],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={geist.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} /></head>
      <body className="font-sans antialiased min-h-screen">{children}</body>
    </html>
  );
}

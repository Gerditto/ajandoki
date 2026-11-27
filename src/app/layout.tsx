import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// A next/font buildeléskor letölti és saját domainről szolgálja ki a betűket:
// futás közben nincs Google Fonts hívás (GDPR).
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Súgj! – a meglepetés biztonságban van",
  description: "Kívánságlisták, titkos foglalás és ajándékhúzás a családnak és a barátoknak.",
  applicationName: "Súgj!",
  appleWebApp: { capable: true, title: "Súgj!", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2e8" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1813" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hu" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// A next/font buildeléskor letölti és saját domainről szolgálja ki a betűket:
// futás közben nincs Google Fonts hívás (GDPR).
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: "Ajándoki – a meglepetés biztonságban van",
  description: "Kívánságlisták, titkos foglalás és ajándékhúzás a családnak és a barátoknak.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#15131a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="hu" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

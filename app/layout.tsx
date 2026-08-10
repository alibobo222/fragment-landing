import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { siteConfig } from "@/config/site";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

// Grand titrage : Overused Grotesk (grotesque contemporain). Les titres sont
// réglés sur la graisse du logotype FRAGMENT (600, semi-gras) — voir globals.css.
// Police VARIABLE auto-hébergée (axe de graisse complet 300→900) — chargée via
// next/font/local : subset + preload automatiques, `display: swap` (pas de FOIT),
// zéro requête tierce (aucun impact perf / cohérent avec l'export statique).
const overusedGrotesk = localFont({
  src: "./fonts/OverusedGrotesk-VF.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  variable: "--font-display-src",
  // Repli calé sur la MÊME graisse que les titres (600) : « Arial Black »,
  // choisi du temps où les titres étaient en 900, écraserait le dessin.
  fallback: ["Helvetica Neue", "Arial", "system-ui", "sans-serif"],
  preload: true,
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

// Mono technique (annotations, indices, légendes, fiche technique) — évoque
// le dessin d'architecture / la nomenclature industrielle.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

const title = `${siteConfig.productName} — ${siteConfig.baseline}`;
const description =
  "Noir Minéral est une lampe sculpturale brutaliste, composée de matières que vous choisissez : porcelaine, brique, verre, inox, laiton. Une forme, plusieurs matières, votre composition.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: title,
    template: `%s — ${siteConfig.brandName}`,
  },
  description,
  applicationName: siteConfig.brandName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteConfig.siteUrl,
    siteName: siteConfig.brandName,
    title,
    description,
    images: [
      {
        url: "/images/og.webp",
        width: 1200,
        height: 630,
        alt: "La lampe sculpturale Noir Minéral.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/og.webp"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Données structurées Organization (sans valeurs fictives).
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.brandName,
    url: siteConfig.siteUrl,
    email: siteConfig.contactEmail,
    ...(siteConfig.instagramUrl ? { sameAs: [siteConfig.instagramUrl] } : {}),
  };

  return (
    <html lang="fr" className={`${overusedGrotesk.variable} ${inter.variable} ${mono.variable}`}>
      <body>
        <a
          href="#configurateur"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
        >
          Aller au configurateur
        </a>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <Analytics />
      </body>
    </html>
  );
}

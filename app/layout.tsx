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

// siteUrl porte le sous-chemin GitHub Pages (/fragment-landing) : une URL
// relative commençant par "/" résolue contre metadataBase l'écraserait
// (RFC 3986). On le réinjecte donc explicitement dans les chemins relatifs.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: title,
    template: `%s — ${siteConfig.brandName}`,
  },
  description,
  applicationName: siteConfig.brandName,
  alternates: { canonical: `${basePath}/` },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: siteConfig.siteUrl,
    siteName: siteConfig.brandName,
    title,
    description,
    images: [
      {
        url: `${basePath}/images/og/noir-mineral.jpg`,
        width: 1200,
        height: 630,
        // JPEG volontaire, PAS de WebP : plusieurs plateformes d'aperçu ne
        // savent pas le rendre et l'image disparaîtrait de la carte.
        type: "image/jpeg",
        alt:
          "Lampe de table Noir Minéral : abat-jour incliné en acier noirci, grille perforée apparente, douille inox et câble textile bleu, sur pied cylindrique.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${basePath}/images/og/noir-mineral.jpg`],
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
        {/* ANCRAGE À L'OUVERTURE.

            ⚠️ CE DISPOSITIF CORRIGE UN SYMPTÔME MESURÉ, PAS UNE CAUSE
            IDENTIFIÉE. Deux relevés indépendants sur iPhone / Safari iOS,
            ouverts depuis un lien WhatsApp, donnent scrollY = 108 à l'arrivée,
            au pixel près — donc déterministe, ni geste ni restauration
            arbitraire. Mais on ne sait TOUJOURS PAS ce qui produit ce
            décalage. Les 108 px valent la hauteur du chrome haut de Safari
            relevée sur la même capture, ce qui est une piste, pas une preuve.
            Conséquence directe : rien ne garantit que les trois points de
            contrôle ci-dessous couvrent l'instant où le vrai déclencheur agit.
            Si le défaut persiste sur l'appareil, la variante à essayer est un
            point de contrôle déclenché par `visualViewport.resize` plutôt que
            par un délai fixe — le décalage semble lié à la mise en place des
            barres de Safari, qui émet cet événement. Non implémentée : on ne
            pose pas un second dispositif tant que le premier n'a pas été jugé.

            TROIS GARDE-FOUS, et le recalage n'a lieu que si les trois tiennent :
              - type de navigation « navigate » — jamais un rechargement, jamais
                un retour arrière, dont la restauration est légitime et utile ;
              - aucune ancre dans l'URL — /#contact doit mener au formulaire ;
              - scrollY < 200 — au-delà, c'est une position profonde qu'on ne
                contrarie pas.
            L'entrée PerformanceNavigationTiming peut ne pas être peuplée au
            tout premier rendu : `type()` renvoie alors null, la condition
            échoue, et rien ne bouge. On préfère ne rien faire à faire à tort.

            DÉSARMEMENT AU PREMIER GESTE. Arriver et faire glisser aussitôt est
            le geste normal après un scan de QR code. Sans cela, le contrôle à
            300 ms ramènerait ce visiteur en haut en pleine lecture — pire que
            le défaut d'origine. Le moindre toucher, molette, pointeur ou touche
            de navigation désarme définitivement les contrôles restants. Un
            recalage ne doit jamais contrarier une intention.

            TROIS POINTS D'EXÉCUTION : le décalage peut survenir après la mise
            en page, et un contrôle unique au démarrage serait écrasé.

            scroll-behavior: smooth est actif sur html (globals.css) : un
            scrollTo produirait un glissement visible. On neutralise la
            propriété le temps du saut et on la rétablit — plutôt que le mot-clé
            « instant », dont le support est plus récent que celui-ci. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var arme=true," +
              "GESTES=['touchstart','wheel','pointerdown','keydown']," +
              "NAV={ArrowUp:1,ArrowDown:1,ArrowLeft:1,ArrowRight:1,PageUp:1,PageDown:1,Home:1,End:1,' ':1};" +
              "function desarmer(){if(!arme)return;arme=false;" +
              "for(var i=0;i<GESTES.length;i++)removeEventListener(GESTES[i],garde,true)}" +
              "function garde(e){if(e.type==='keydown'&&!NAV[e.key])return;desarmer()}" +
              "for(var j=0;j<GESTES.length;j++)addEventListener(GESTES[j],garde,{passive:true,capture:true});" +
              "function type(){var e=performance.getEntriesByType('navigation')[0];return e?e.type:null}" +
              "function recaler(){if(!arme)return;if(type()!=='navigate')return;if(location.hash)return;" +
              "var y=window.scrollY||document.documentElement.scrollTop;if(y===0||y>=200)return;" +
              "var d=document.documentElement,p=d.style.scrollBehavior;d.style.scrollBehavior='auto';" +
              "window.scrollTo(0,0);d.style.scrollBehavior=p}" +
              "recaler();addEventListener('load',recaler);" +
              "setTimeout(function(){recaler();desarmer()},300)})();",
          }}
        />
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

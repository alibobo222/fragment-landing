"use client";

import { useEffect } from "react";
import Script from "next/script";
import { siteConfig } from "@/config/site";
import { track } from "@/lib/analytics";

/**
 * Charge le script du fournisseur analytics configuré (le cas échéant) et
 * envoie l'événement d'arrivée `qr_landing_view` une seule fois par session.
 * Sans configuration, aucun script n'est chargé et le site reste fonctionnel.
 */
export function Analytics() {
  useEffect(() => {
    track("qr_landing_view", { source: getSourceParam() });
  }, []);

  const { analyticsProvider: provider, analyticsId: id } = siteConfig;

  if (provider === "plausible" && id) {
    return (
      <Script
        defer
        data-domain={id}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  if (provider === "ga" && id) {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
        </Script>
      </>
    );
  }

  if (provider === "matomo" && id) {
    return (
      <Script id="matomo-init" strategy="afterInteractive">
        {`var _paq=window._paq=window._paq||[];_paq.push(['trackPageView']);_paq.push(['enableLinkTracking']);`}
      </Script>
    );
  }

  return null;
}

function getSourceParam(): string {
  if (typeof window === "undefined") return "direct";
  const params = new URLSearchParams(window.location.search);
  return params.get("source") ?? "direct";
}

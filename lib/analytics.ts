/**
 * Module de tracking neutre.
 *
 * Compatible Plausible, Matomo et Google Analytics selon `siteConfig`.
 * Le site reste 100 % fonctionnel si aucun outil n'est configuré :
 * les événements sont alors simplement journalisés en console (dev) ou ignorés.
 */

import { siteConfig } from "@/config/site";

export type AnalyticsEvent =
  | "qr_landing_view"
  | "configurator_started"
  | "material_variant_selected"
  | "configurator_contact_click"
  | "contact_form_started"
  | "contact_form_submitted";

type EventProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: EventProps }) => void;
    _paq?: unknown[];
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

/** Envoie un événement au fournisseur configuré, sans jamais casser le rendu. */
export function track(event: AnalyticsEvent, props: EventProps = {}): void {
  if (typeof window === "undefined") return;

  try {
    switch (siteConfig.analyticsProvider) {
      case "plausible":
        window.plausible?.(event, { props });
        break;
      case "matomo":
        window._paq?.push([
          "trackEvent",
          "etnisi",
          event,
          JSON.stringify(props),
        ]);
        break;
      case "ga":
        window.gtag?.("event", event, props);
        break;
      case "none":
      default:
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.debug(`[analytics] ${event}`, props);
        }
        break;
    }
  } catch {
    // Le tracking ne doit jamais interrompre l'expérience utilisateur.
  }
}

/** Lit le paramètre ?source= de l'URL (ex. ?source=qr) côté client. */
export function getSource(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("source");
}

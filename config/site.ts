/**
 * Configuration centrale du site Etnisi.
 *
 * Toute information commerciale, de contact ou non vérifiée doit être renseignée
 * ICI, jamais inventée dans les composants. Les champs marqués `TODO` sont
 * volontairement vides : ils s'affichent proprement comme « Information à venir »
 * ou sont masqués tant qu'ils ne sont pas remplis.
 */

export type PurchaseMode = "checkout" | "preorder" | "inquiry";
export type AnalyticsProvider = "plausible" | "matomo" | "ga" | "none";

export interface SiteConfig {
  productName: string;
  /** Marque / atelier (logo FRAGMENT). Distinct de la collection produit. */
  brandName: string;
  /** Nom de la collection / gamme de la lampe (« Noir Minéral »). */
  collectionName: string;
  baseline: string;
  /** Prix TTC. `null` tant qu'il n'est pas fixé — ne jamais inventer. */
  price: number | null;
  currency: string;
  /** Détermine le comportement du CTA final. */
  purchaseMode: PurchaseMode;
  /** URL de paiement (Stripe Checkout, etc.). Requis si purchaseMode = "checkout". */
  checkoutUrl: string | null;
  contactEmail: string;
  instagramUrl: string | null;
  legalNoticeUrl: string | null;
  privacyUrl: string | null;
  /** Endpoint recevant les demandes/réservations. `null` = mode démonstration. */
  leadEndpoint: string | null;
  analyticsProvider: AnalyticsProvider;
  /** Domaine Plausible / Site ID Matomo / Measurement ID GA. */
  analyticsId: string | null;
  /** URL canonique absolue du site en production. */
  siteUrl: string;
}

export const siteConfig: SiteConfig = {
  productName: "Noir Minéral",
  // Marque affichée dans le logo (voir /public/images/brand/fragment-wordmark.png).
  brandName: "FRAGMENT",
  collectionName: "Noir Minéral",
  baseline: "La lumière prend position.",

  // TODO: fixer le prix de vente public. Tant que `null`, aucun prix ni donnée
  // structurée Product avec offre n'est affiché.
  price: null,
  currency: "EUR",

  // Mode commercial : "checkout" | "preorder" | "inquiry".
  // Sans URL de paiement ni endpoint, on reste en mode "inquiry" (demande).
  purchaseMode: "inquiry",

  // TODO: renseigner l'URL Stripe Checkout pour activer purchaseMode "checkout".
  checkoutUrl: null,

  // TODO: remplacer par l'adresse de contact réelle de l'atelier.
  contactEmail: "contact@noirmineral.studio",

  // TODO: renseigner le compte Instagram s'il existe, sinon laisser `null`.
  instagramUrl: null,

  // TODO: publier puis lier les pages légales.
  legalNoticeUrl: null,
  privacyUrl: null,

  // TODO: brancher l'API de réception des demandes (ex: /api/lead vers un CRM,
  // Formspree, Resend...). Tant que `null`, le formulaire fonctionne en mode
  // démonstration et l'indique clairement au développeur (pas au visiteur).
  leadEndpoint: null,

  analyticsProvider: "none",
  analyticsId: null,

  // TODO: remplacer par le domaine de production une fois déployé.
  siteUrl: "https://noirmineral.studio",
};

/** Libellé du CTA final dérivé du mode commercial. */
export function orderCtaLabel(mode: PurchaseMode = siteConfig.purchaseMode): string {
  switch (mode) {
    case "checkout":
      return "Commander cette lampe";
    case "preorder":
      return "Réserver cette configuration";
    case "inquiry":
    default:
      return "Demander cette configuration";
  }
}

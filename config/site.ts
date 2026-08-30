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
  /**
   * URL de la fonction Edge Supabase `contact`, qui enregistre la demande puis
   * envoie la notification par Resend. Lue depuis l'environnement au moment du
   * build : l'export étant statique, la valeur est figée dans le bundle — d'où
   * le préfixe `NEXT_PUBLIC_`. Ce n'est pas un secret, c'est une URL publique
   * appelée depuis le navigateur ; la fonction se protège elle-même.
   * `null` = non configuré : le formulaire retombe sur le client mail.
   */
  contactEndpoint: string | null;
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
  contactEmail: "studionoirmineral@outlook.fr",

  // TODO: renseigner le compte Instagram s'il existe, sinon laisser `null`.
  instagramUrl: null,

  legalNoticeUrl: "/mentions-legales/",
  privacyUrl: "/confidentialite/",

  // Renseignée par `NEXT_PUBLIC_CONTACT_ENDPOINT` au build (voir .env.example et
  // le workflow GitHub Actions). Absente en local tant qu'on n'a pas servi la
  // fonction : le formulaire retombe alors sur le client mail, sans rien casser.
  contactEndpoint: process.env.NEXT_PUBLIC_CONTACT_ENDPOINT || null,

  analyticsProvider: "none",
  analyticsId: null,

  // URL GitHub Pages réelle du dépôt (alibobo222/fragment-landing).
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

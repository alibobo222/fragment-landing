/**
 * Échantillons de la gamme Wasterial® (partenaire ETNISI), affichés dans le
 * bandeau défilant de la section 02 « Matières »
 * (components/chapters/MaterialsMarquee.tsx).
 *
 * Source de vérité de ce bandeau, au même titre que `data/product.ts` l'est
 * pour les configurations : le composant en dérive, jamais l'inverse.
 *
 * Photos déposées par l'atelier sous
 * public/images/materials/raw/<id>.png, préparées par
 * `scripts/prepare-assets.mjs` (npm run assets) en deux largeurs WebP —
 * <id>-mobile.webp et <id>-desktop.webp — jamais référencées ailleurs qu'ici.
 *
 * Libellés : préfixe « Wasterial® - » systématique, puis le nom tel que
 * déposé par l'atelier dans le dossier source, sans reformulation. Deux
 * réserves signalées et laissées telles quelles (validé explicitement) :
 *   - « Coquilles d'huîtres » : cette photo (plus récente que celle déjà
 *     utilisée dans data/product.ts) rend un beige sableux, alors que la
 *     matière du même nom y est vert olive. Pas de nom inventé pour trancher
 *     l'écart, juste ce commentaire.
 *   - « Béton bleuté » : la photo montre du verre pilé bleu turquoise, pas un
 *     béton. Nom déposé par l'atelier, conservé tel quel.
 */

export interface MaterialSample {
  id: string;
  /** Libellé affiché sous l'échantillon — texte, jamais incrusté dans l'image. */
  name: string;
  /** Chemin de la variante DESKTOP (public/images/materials/<id>-desktop.webp).
   *  Le composant dérive le chemin mobile en substituant le suffixe. */
  image: string;
  alt: string;
}

/**
 * Dérive le chemin de la variante MOBILE depuis `image` (variante desktop) —
 * une seule fonction, réutilisée par le composant et par le test d'existence
 * des textures, pour que les deux ne puissent jamais diverger.
 */
export function materialMobileImage(image: string): string {
  return image.replace(/-desktop\.webp$/, "-mobile.webp");
}

export const materials: MaterialSample[] = [
  {
    id: "brique",
    name: "Wasterial® - Brique",
    image: "/images/materials/brique-desktop.webp",
    alt: "Échantillon Wasterial® - Brique : grain rouge terracotta, finement moucheté de noir.",
  },
  {
    id: "coquilles-de-moules",
    name: "Wasterial® - Coquilles de moules",
    image: "/images/materials/coquilles-de-moules-desktop.webp",
    alt: "Échantillon Wasterial® - Coquilles de moules : grain noir profond, mouchetures discrètes.",
  },
  {
    id: "verre-de-bouteille",
    name: "Wasterial® - Verre de bouteille",
    image: "/images/materials/verre-de-bouteille-desktop.webp",
    alt: "Échantillon Wasterial® - Verre de bouteille : éclats de verre vert bouteille, facettes cristallines.",
  },
  {
    id: "verre-bleu",
    name: "Wasterial® - Verre bleu",
    image: "/images/materials/verre-bleu-desktop.webp",
    alt: "Échantillon Wasterial® - Verre bleu : grain bleu nuit fin et régulier.",
  },
  {
    id: "coquilles-huitres",
    name: "Wasterial® - Coquilles d'huîtres",
    image: "/images/materials/coquilles-huitres-desktop.webp",
    alt: "Échantillon Wasterial® - Coquilles d'huîtres : grain beige sableux, fragments coquillers visibles.",
  },
  {
    id: "pierre-bleue",
    name: "Wasterial® - Pierre bleue",
    image: "/images/materials/pierre-bleue-desktop.webp",
    alt: "Échantillon Wasterial® - Pierre bleue : surface gris-vert mate, grain fin.",
  },
  {
    id: "sable-fonderie",
    name: "Wasterial® - Sable de fonderie",
    image: "/images/materials/sable-fonderie-desktop.webp",
    alt: "Échantillon Wasterial® - Sable de fonderie : grain brun-gris finement moucheté.",
  },
  {
    id: "beton-bleute",
    name: "Wasterial® - Béton bleuté",
    image: "/images/materials/beton-bleute-desktop.webp",
    alt: "Échantillon Wasterial® - Béton bleuté : éclats bleu turquoise anguleux, inclusions sombres.",
  },
  {
    id: "travertin",
    name: "Wasterial® - Travertin",
    image: "/images/materials/travertin-desktop.webp",
    alt: "Échantillon Wasterial® - Travertin : grain beige-taupe poreux, petites inclusions claires.",
  },
];

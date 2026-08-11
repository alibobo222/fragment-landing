/**
 * Associe un libellé de matière à sa vignette de texture réelle (si elle existe
 * dans /public/textures/swatch, des dérivés 64 px des textures pleine
 * résolution — voir scripts/prepare-assets.mjs). Aucune texture inventée : on
 * renvoie `null` quand aucune image ne correspond, et l'interface retombe sur
 * une pastille de couleur.
 */
export function materialTexture(label: string): string | null {
  const l = label.toLowerCase();
  if (/brique/.test(l)) return "/textures/swatch/brique.webp";
  if (/billes de verre|verre bleu/.test(l)) return "/textures/swatch/verre-bleu.webp";
  if (/verre de bouteille/.test(l)) return "/textures/swatch/verre-bouteille.webp";
  if (/coquilles? d'?huîtres?|huitre/.test(l)) return "/textures/swatch/coquilles-huitres.webp";
  if (/coquilles de moules|westerial/.test(l)) return "/textures/swatch/westerial-coquilles-moules.webp";
  if (/béton bleut|beton bleut/.test(l)) return "/textures/swatch/beton-bleute.webp";
  // Vignette dédiée, et non le placage bois plein cadre 3D.
  if (/bois/.test(l)) return "/textures/swatch/bois-brule.webp";
  return null;
}

/**
 * Associe un libellé de matière à sa vignette de texture réelle (si elle existe
 * dans /public/textures). Aucune texture inventée : on renvoie `null` quand
 * aucune image ne correspond, et l'interface retombe sur une pastille de couleur.
 */
export function materialTexture(label: string): string | null {
  const l = label.toLowerCase();
  if (/brique/.test(l)) return "/textures/brique.png";
  if (/billes de verre|verre bleu/.test(l)) return "/textures/verre-bleu.png";
  if (/verre de bouteille/.test(l)) return "/textures/verre-bouteille.png";
  if (/coquilles? d'?huîtres?|huitre/.test(l)) return "/textures/coquilles-huitres.png";
  if (/coquilles de moules|westerial/.test(l)) return "/textures/westerial-coquilles-moules.png";
  if (/béton bleut|beton bleut/.test(l)) return "/textures/beton-bleute.png";
  return null;
}

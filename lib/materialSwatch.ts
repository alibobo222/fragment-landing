/**
 * Vignette de texture réelle d'une matière (si elle existe dans
 * /public/textures), lue directement sur la donnée produit — plus aucune
 * détection par expression régulière sur le libellé. `textureImage` absent →
 * l'interface retombe sur une pastille de couleur (`finish.color`).
 */
import type { PartFinish } from "@/data/product";

export function materialTexture(finish: PartFinish): string | null {
  return finish.textureImage ?? null;
}

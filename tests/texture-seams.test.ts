import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SEAMLESS_TEXTURES } from "../scripts/prepare-assets.mjs";

/**
 * Verrouille le raccord des textures composites (ÉTAPE 2 du retour « effet de
 * patchwork ») : un raccord se vérifie, il ne se juge pas à l'œil. Mesure la
 * discontinuité de bord — moyenne des différences ABSOLUES de luminance,
 * pixel à pixel, entre la première et la dernière colonne (gauche/droite) et
 * entre la première et la dernière ligne (haut/bas) — de chaque texture
 * traitée par `makeSeamlessTexture` (scripts/prepare-assets.mjs). Une
 * moyenne simple des DIFFÉRENCES DE MOYENNES ne suffit pas : un motif décalé
 * peut avoir la même luminance moyenne des deux côtés tout en montrant une
 * couture nette (vérifié sur ce projet : c'était le cas).
 *
 * SEUIL = 20 (échelle de luminance 0–255) : au-dessus de la pire valeur
 * observée après traitement (17,12 — beton-bleute.png, le motif d'éclats de
 * verre le plus haute fréquence du lot, structurellement le plus difficile à
 * raccorder), en dessous de la totalité des valeurs mesurées avant traitement
 * pour les textures qui dépassaient déjà ce seuil (corten 29,8, béton bleuté
 * 43,3, placage bois 20,2/21,2) — donc un vrai garde-fou de régression, pas un
 * seuil qui laisserait repasser l'état d'origine.
 */
const THRESHOLD = 20;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const texturesDir = join(root, "public", "textures");

async function edgeDiscontinuity(path: string) {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const lum = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const px = (x: number, y: number) => (y * width + x) * channels;

  let lrSum = 0;
  for (let y = 0; y < height; y++) {
    lrSum += Math.abs(lum(px(0, y)) - lum(px(width - 1, y)));
  }
  let tbSum = 0;
  for (let x = 0; x < width; x++) {
    tbSum += Math.abs(lum(px(x, 0)) - lum(px(x, height - 1)));
  }
  return { lr: lrSum / height, tb: tbSum / width };
}

describe("raccord des textures composites (ÉTAPE 2)", () => {
  it.each(SEAMLESS_TEXTURES)("%s : discontinuité de bord < seuil", async (name) => {
    const path = join(texturesDir, name);
    const { lr, tb } = await edgeDiscontinuity(path);
    expect(lr, `${name} — bord gauche/droite : ${lr.toFixed(2)}`).toBeLessThan(THRESHOLD);
    expect(tb, `${name} — bord haut/bas : ${tb.toFixed(2)}`).toBeLessThan(THRESHOLD);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Verrouille l'existence sur disque de toutes les textures référencées par le
 * code. Sans ce test, un fichier non suivi par git peut être supprimé (ou ne
 * jamais être déposé) sans qu'aucune erreur ne le signale avant l'exécution :
 * la plupart des textures de ce fichier n'ont aucun repli et échouent
 * silencieusement à charger, et le nuancier du configurateur affiche une
 * image cassée sans échec visible ailleurs. C'est arrivé trois fois sur ce
 * projet — bois-brule.png, verre-bleu (matière inversée), renature.png —
 * toujours découvert a posteriori. Ce test l'attrape avant, à la compilation.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf-8");
}

/** Toutes les constantes `const XXX_URL = "/textures/…";` de lampTextures.ts. */
function extractLampTextureUrls(): string[] {
  const source = readSource("lib/lampTextures.ts");
  const matches = source.matchAll(/const\s+\w+_URL\s*=\s*"(\/textures\/[^"]+)"/g);
  return [...matches].map((m) => m[1]);
}

/** Tous les `textureImage: "/textures/…"` de data/product.ts. */
function extractProductTextureImages(): string[] {
  const source = readSource("data/product.ts");
  const matches = source.matchAll(/textureImage:\s*"(\/textures\/[^"]+)"/g);
  return [...matches].map((m) => m[1]);
}

describe("textures référencées par le code", () => {
  const lampUrls = extractLampTextureUrls();
  const productUrls = extractProductTextureImages();

  it("trouve au moins une constante *_URL dans lib/lampTextures.ts", () => {
    // Garde-fou : si la regex cesse de matcher (ex. constantes renommées),
    // ce test échoue au lieu de laisser passer silencieusement une liste vide.
    expect(lampUrls.length).toBeGreaterThan(0);
  });

  it("trouve au moins un textureImage dans data/product.ts", () => {
    expect(productUrls.length).toBeGreaterThan(0);
  });

  it.each(lampUrls)("lib/lampTextures.ts : %s existe dans public/", (url) => {
    const path = join(publicDir, url.replace(/^\//, ""));
    expect(existsSync(path), `Fichier manquant : public${url}`).toBe(true);
  });

  it.each(productUrls)("data/product.ts : %s existe dans public/", (url) => {
    const path = join(publicDir, url.replace(/^\//, ""));
    expect(existsSync(path), `Fichier manquant : public${url}`).toBe(true);
  });
});

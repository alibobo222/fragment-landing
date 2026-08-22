/**
 * EMPREINTE DES ENTRÉES DU RENDU PACKSHOT — module PARTAGÉ.
 *
 * Utilisé par DEUX consommateurs qui ne doivent JAMAIS calculer cette empreinte
 * chacun à sa façon (ils divergeraient) :
 *   - scripts/render-packshots.mjs, qui ÉCRIT tests/packshot-manifest.json
 *     à la fin de chaque génération ;
 *   - tests/packshot-manifest.test.ts, qui la RECALCULE et échoue si elle a
 *     changé sans régénération derrière.
 *
 * Fichier en .mjs (pas .ts) : render-packshots.mjs est un script Node brut, sans
 * transpilation TypeScript — seul un module .mjs est importable des deux côtés
 * (le test, lui, tourne sous Vitest/Vite, qui sait importer du .mjs nativement).
 *
 * LISTE DES ENTRÉES — établie par lecture du graphe d'imports réel de la route
 * /packshot (app/packshot/page.tsx → components/packshot/Packshot.tsx →
 * components/hero/Lamp3D.tsx), pas supposée :
 *   - data/product.ts        (les variantes : matières, couleurs, textures — la
 *                              fiche technique, data/specs.ts, est un fichier
 *                              séparé et n'a AUCUN effet sur le rendu, elle
 *                              n'a donc pas sa place dans cette liste)
 *   - data/lampModel.ts       (mapping GLB↔rôles, résolution des matières, éclairage)
 *   - config/packshot.ts      (direction artistique : caméra, cadrage, éclairage)
 *   - lib/lampTextures.ts     (profils PBR, shaders triplanar, textures procédurales
 *                              ET réelles — c'est aussi lui qui référence tous les
 *                              fichiers de public/textures/, voir plus bas)
 *   - components/packshot/Packshot.tsx  (branchement DA → Lamp3D)
 *   - components/hero/Lamp3D.tsx        (le moteur de rendu lui-même)
 *   - app/packshot/page.tsx             (fond/reset CSS de la page capturée —
 *                                         influence directement les pixels shootés)
 *   - scripts/render-packshots.mjs      (cadrage/recadrage post-capture : une
 *                                         modification de MARGIN ou de l'algorithme
 *                                         de détection du sujet change le résultat
 *                                         final sans toucher au rendu 3D lui-même)
 *   - public/models/lampe-optimisee.glb (la géométrie)
 *   - tous les fichiers de public/textures/ réellement chargés par le moteur 3D
 *     — extraction automatique des constantes `*_URL` de lampTextures.ts
 *     ci-dessous, jamais une liste tenue à la main qui se désynchroniserait à
 *     la première texture ajoutée ou retirée
 *
 * VOLONTAIREMENT EXCLU : les `textureImage` de data/product.ts (pastilles du
 * nuancier 2D de Configurator.tsx) ne sont chargées par AUCUN fichier du
 * graphe de rendu ci-dessus (vérifié par recherche) — les inclure ferait
 * échouer le garde-fou à chaque régénération de nuancier (`npm run assets`)
 * sans qu'un seul pixel de packshot n'ait changé. lib/materialSwatch.ts et
 * lib/materialLabel.ts, pour la même raison (pastilles/libellés de
 * l'interface), sont exclus aussi. `lib/socketThread.ts`, mentionné dans une
 * première liste, n'existe pas dans ce projet — pas d'entrée correspondante.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CODE_INPUTS = [
  "data/product.ts",
  "data/lampModel.ts",
  "config/packshot.ts",
  "lib/lampTextures.ts",
  "components/packshot/Packshot.tsx",
  "components/hero/Lamp3D.tsx",
  "app/packshot/page.tsx",
  "scripts/render-packshots.mjs",
];

const MODEL_INPUT = "public/models/lampe-optimisee.glb";

/**
 * Toutes les constantes `const XXX_URL = "/textures/…"` de lampTextures.ts.
 * Extraction PARTAGÉE avec tests/texture-assets.test.ts (qui l'importe d'ici
 * plutôt que de la réécrire) — une seule regex, jamais deux qui pourraient
 * lister des fichiers différents.
 */
export function extractLampTextureUrls() {
  const source = readFileSync(join(ROOT, "lib/lampTextures.ts"), "utf-8");
  const matches = source.matchAll(/const\s+\w+_URL\s*=\s*"(\/textures\/[^"]+)"/g);
  return [...matches].map((m) => m[1]);
}

/**
 * Tous les `textureImage: "/textures/…"` de data/product.ts — les PASTILLES du
 * nuancier de `Configurator.tsx` (interface 2D), jamais lues par le moteur 3D
 * (vérifié : aucune occurrence de `textureImage` dans components/hero/,
 * lib/lampTextures.ts ni data/lampModel.ts). Exportée pour
 * tests/texture-assets.test.ts (qui audite TOUS les fichiers référencés, UI
 * comprise) — mais volontairement PAS incluse dans `computePackshotManifest`
 * ci-dessous : un changement de pastille ne change pas un seul pixel d'un
 * packshot, l'inclure ferait un faux positif à chaque régénération de
 * nuancier (`npm run assets`).
 */
export function extractProductTextureImages() {
  const source = readFileSync(join(ROOT, "data/product.ts"), "utf-8");
  const matches = source.matchAll(/textureImage:\s*"(\/textures\/[^"]+)"/g);
  return [...matches].map((m) => m[1]);
}

function sha256File(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

/**
 * Calcule l'empreinte combinée de toutes les entrées du rendu.
 *
 * @returns {{ hash: string, files: Array<{path: string, sha256: string|null}>, missing: string[] }}
 *   `missing` liste les entrées attendues mais absentes du disque — un fichier
 *   manquant produit un hash `null`, jamais une exception ni un hash silencieux.
 */
export function computePackshotManifest() {
  // Uniquement les URL du moteur 3D (voir le commentaire de
  // extractProductTextureImages ci-dessus pour l'exclusion volontaire des
  // pastilles du nuancier).
  const textureUrls = [...new Set(extractLampTextureUrls())]
    .map((u) => "public" + u)
    .sort();

  const allInputs = [...CODE_INPUTS, MODEL_INPUT, ...textureUrls].sort();

  const files = allInputs.map((relPath) => ({
    path: relPath.replace(/\\/g, "/"),
    sha256: sha256File(relPath),
  }));

  const missing = files.filter((f) => f.sha256 === null).map((f) => f.path);

  const combined = createHash("sha256");
  for (const f of files) combined.update(`${f.path}:${f.sha256 ?? "MISSING"}\n`);

  return { hash: combined.digest("hex"), files, missing };
}

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
 *   - data/product.ts        (PROJECTION NORMALISÉE seulement — voir plus bas,
 *                              pas le fichier entier : data/specs.ts a déjà
 *                              montré qu'un couplage de fichier entier fait
 *                              des faux positifs sur du texte sans effet visuel ;
 *                              ici le problème est interne à product.ts lui-même)
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
 * PROJECTION NORMALISÉE DE data/product.ts — pas le fichier hâché en entier.
 * Le hachage par fichier entier périmait les vignettes à chaque renommage de
 * variante, chaque commentaire ajouté, chaque reformatage : aucun de ces
 * changements ne bouge un seul pixel. `buildRenderProjection` importe le
 * module par un spécificateur RELATIF (Node type-strippe le .ts nativement,
 * voir data/package.json ; Vite, sous Vitest, le résout tout aussi bien —
 * une URL absolue file:// s'est révélée fragile sous Vite avec un chemin
 * contenant des espaces) et n'en retient que ce que le moteur de rendu lit
 * RÉELLEMENT — vérifié champ par champ dans finishFor (data/lampModel.ts) et
 * Lamp3D.tsx, pas supposé :
 *   - variant.id                    — identifie CE qui est rendu ; en ajouter,
 *     retirer ou renommer un change le jeu de vignettes
 *   - {shade,assembly,base,cable,socket}.material / .color — les DEUX SEULS
 *     champs de PartFinish que `finishFor` transmet à `applyProfile`
 *     (Lamp3D.tsx) ; `label` et `textureImage` n'y sont jamais lus
 *   - defaultPerforation            — Packshot.tsx ne passe aucune prop
 *     `perforation` à Lamp3D : le packshot rend TOUJOURS cette seule valeur
 *   - defaultVariantId              — pilote le placage bois intérieur
 *     (`isConfig01`, Lamp3D.tsx) ; en changer déplace ce placage d'une
 *     configuration à une autre, sans toucher `data/product.ts` ailleurs
 *
 * EXCLUS de la projection bien qu'ils appartiennent à ProductVariant ou
 * PartFinish — vérifiés NON lus par le moteur 3D (grep exhaustif sur
 * components/hero/, data/lampModel.ts, components/packshot/) :
 *   - name, index, materialsSummary, description, alt — texte éditorial
 *   - accent, accentOnDark — variables CSS pour l'UI (SelectionProvider),
 *     jamais lues par Lamp3D.tsx ni par la route /packshot
 *   - textureImage (sur CHAQUE pièce, y compris shadeInner et socket) —
 *     PASTILLES 2D du nuancier (materialSwatch.ts, Configurator.tsx) ; le
 *     placage intérieur réel (Renature/bois) vient d'URLs codées en dur dans
 *     lib/lampTextures.ts, jamais de `shadeInner.textureImage`
 *   - shadeInner (le champ entier) — même raison : aucune lecture dans le
 *     graphe de rendu, l'interrupteur bois/Renature/aucun est un test sur
 *     `variant.id`, pas sur ce champ
 *   - perforationOptions — la liste des choix offerts au picker LIVE, jamais
 *     lue par Packshot.tsx (qui ne rend QUE `defaultPerforation`)
 *
 * VOLONTAIREMENT EXCLU (pastilles du nuancier 2D, sans effet sur le rendu) :
 * lib/materialSwatch.ts et lib/materialLabel.ts, pour la même raison que
 * textureImage ci-dessus. `lib/socketThread.ts`, mentionné dans une première
 * liste, n'existe pas dans ce projet — pas d'entrée correspondante.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const CODE_INPUTS = [
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
 * comprise) — lecture texte volontaire ici : cette fonction vérifie une
 * EXISTENCE sur disque, pas une empreinte de rendu, la distinction qui motive
 * `buildRenderProjection` plus bas ne s'y applique pas.
 */
export function extractProductTextureImages() {
  const source = readFileSync(join(ROOT, "data/product.ts"), "utf-8");
  const matches = source.matchAll(/textureImage:\s*"(\/textures\/[^"]+)"/g);
  return [...matches].map((m) => m[1]);
}

/**
 * Extensions dont le contenu est du TEXTE. Liste EXPLICITE, jamais une
 * détection heuristique du binaire : c'est un réglage qui doit se relire, et
 * une heuristique qui se trompe corromprait silencieusement une empreinte.
 *
 * Toute extension absente d'ici est traitée comme BINAIRE, donc hachée octet
 * pour octet — le défaut sûr : normaliser un .png ou un .glb le corromprait.
 */
const EXTENSIONS_TEXTE = new Set([".ts", ".tsx", ".mjs", ".js", ".json", ".css", ".svg"]);

/** @param {string} relPath @returns {boolean} */
export function estTexte(relPath) {
  return EXTENSIONS_TEXTE.has(extname(relPath).toLowerCase());
}

/**
 * Empreinte d'une entrée — sur son CONTENU, pas sur son encodage de plateforme.
 *
 * Le dépôt stocke du LF (voir .gitattributes, `* text=auto`) mais chaque poste
 * garde ses fins de ligne natives : le MÊME fichier est en CRLF sur Windows et
 * en LF sur la CI Ubuntu. Hacher les octets bruts faisait donc diverger deux
 * arbres identiques, et le garde-fou signalait des vignettes « périmées » alors
 * que rien n'avait changé — un rouge sur du bruit, qui apprend à ignorer le
 * rouge. Normaliser en LF avant de hacher rend l'empreinte identique partout.
 *
 * Les binaires (images, GLB) passent intacts : aucune substitution.
 *
 * Seul CRLF → LF est normalisé. Un CR isolé n'est pas touché : il n'apparaît
 * dans aucune des sources du projet, et le convertir reviendrait à réécrire du
 * contenu au lieu d'un encodage de fin de ligne.
 *
 * @param {Buffer} contenu octets du fichier (disque ou objet git)
 * @param {string} relPath chemin, qui détermine texte ou binaire
 * @returns {string} sha256 hexadécimal
 */
export function hashEntry(contenu, relPath) {
  const octets = estTexte(relPath)
    ? Buffer.from(contenu.toString("utf8").replace(/\r\n/g, "\n"), "utf8")
    : contenu;
  return createHash("sha256").update(octets).digest("hex");
}

function sha256File(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) return null;
  return hashEntry(readFileSync(abs), relPath);
}

/**
 * Projection normalisée de data/product.ts — voir le doc de tête pour le
 * détail champ par champ, inclusions et exclusions. Importe le module
 * (au lieu de lire le fichier comme du texte) : insensible au formatage, aux
 * commentaires, à l'ordre des propriétés non significatif — seul un
 * changement de VALEUR d'un champ retenu modifie la projection.
 */
async function buildRenderProjection() {
  const mod = await import("../data/product.ts");
  const pick = (partFinish) =>
    partFinish ? { material: partFinish.material, color: partFinish.color } : null;
  return {
    defaultVariantId: mod.defaultVariantId,
    defaultPerforation: mod.defaultPerforation,
    variants: mod.variants.map((v) => ({
      id: v.id,
      shade: pick(v.shade),
      assembly: pick(v.assembly),
      socket: pick(v.socket),
      base: pick(v.base),
      cable: pick(v.cable),
    })),
  };
}

/**
 * Calcule l'empreinte combinée de toutes les entrées du rendu : hachage brut
 * pour le code/les assets, projection normalisée pour data/product.ts.
 * Asynchrone : `buildRenderProjection` importe un module ES.
 *
 * @returns {Promise<{ hash: string, files: Array<{path: string, sha256: string|null}>, missing: string[] }>}
 *   `missing` liste les entrées attendues mais absentes du disque — un fichier
 *   manquant produit un hash `null`, jamais une exception ni un hash silencieux.
 */
export async function computePackshotManifest() {
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

  const projection = await buildRenderProjection();
  const projectionHash = createHash("sha256")
    .update(JSON.stringify(projection))
    .digest("hex");
  files.push({ path: "data/product.ts#projection", sha256: projectionHash });
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const missing = files.filter((f) => f.sha256 === null).map((f) => f.path);

  const combined = createHash("sha256");
  for (const f of files) combined.update(`${f.path}:${f.sha256 ?? "MISSING"}\n`);

  return { hash: combined.digest("hex"), files, missing };
}

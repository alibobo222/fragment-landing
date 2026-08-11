/**
 * Découpe les deux planches sources fournies par l'atelier en visuels
 * individuels optimisés (WebP) placés sous /public/images.
 *
 * Sources (conservées, jamais modifiées) :
 *   ../Etnisi/Capture d’écran 2026-07-23 192037.png  (planche 6 variantes, 652x600)
 *   ../Etnisi/Capture d’écran 2026-07-23 192123.png  (photos prototype + éclaté, 1322x742)
 *
 * Usage : npm run assets
 */
import sharp from "sharp";
import { mkdir, access, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const srcDir = join(root, "..", "Etnisi");
const outVariants = join(root, "public", "images", "variants");
const outPrototype = join(root, "public", "images", "prototype");
const texturesDir = join(root, "public", "textures");

const BOARD = join(srcDir, "Capture d’écran 2026-07-23 192037.png");
const PHOTOS = join(srcDir, "Capture d’écran 2026-07-23 192123.png");

/** Image de placage bois (intérieur abat-jour config 01, tuilage ×8 — voir
 *  WOOD_VENEER_SCALE dans lib/lampTextures.ts). Sa résolution native dépasse
 *  très largement ce que ce tuilage rend visible. */
const WOOD_VENEER = "placage-bois.jpg";

/** planche variantes : grille 3×2, colonnes de 217px, rendus sur fond blanc. */
const variantCrops = [
  { name: "porcelaine-acier-noir", left: 6, top: 30, width: 206, height: 182 },
  { name: "brique-aluminium", left: 223, top: 30, width: 206, height: 182 },
  { name: "verre-bouteille-inox", left: 440, top: 30, width: 206, height: 182 },
  { name: "coquille-laiton", left: 6, top: 360, width: 206, height: 182 },
  { name: "verre-bleu-acier-anodise", left: 223, top: 360, width: 206, height: 182 },
  { name: "porcelaine-epoxy-mat", left: 440, top: 360, width: 206, height: 182 },
];

/** photos prototype + vue éclatée. */
const prototypeCrops = [
  { name: "trois-quarts", left: 0, top: 8, width: 372, height: 726 },
  { name: "profil", left: 374, top: 8, width: 372, height: 350 },
  { name: "assemblage", left: 374, top: 366, width: 372, height: 372 },
  { name: "eclate", left: 792, top: 205, width: 528, height: 534 },
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Découpe les planches éditoriales (variantes + prototype) — dépend des
 * sources ../Etnisi/, absentes du dépôt. Ignoré proprement (pas d'échec) si
 * elles ne sont pas là : c'est un outil de dépose de l'atelier, pas une étape
 * requise après `git clone`.
 */
async function prepareBoardAssets() {
  if (!(await exists(BOARD)) || !(await exists(PHOTOS))) {
    console.log(
      "Planches sources introuvables (../Etnisi/) — découpe des visuels ignorée."
    );
    return;
  }

  await mkdir(outVariants, { recursive: true });
  await mkdir(outPrototype, { recursive: true });

  for (const c of variantCrops) {
    const out = join(outVariants, `${c.name}.webp`);
    await sharp(BOARD)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize({ width: 780, withoutEnlargement: false })
      .webp({ quality: 88 })
      .toFile(out);
    console.log("variante →", out);
  }

  for (const c of prototypeCrops) {
    const out = join(outPrototype, `${c.name}.webp`);
    await sharp(PHOTOS)
      .extract({ left: c.left, top: c.top, width: c.width, height: c.height })
      .resize({ width: 1100, withoutEnlargement: false })
      .webp({ quality: 86 })
      .toFile(out);
    console.log("prototype →", out);
  }

  // Image de partage Open Graph (1200×630) à partir de la meilleure photo.
  await sharp(PHOTOS)
    .extract({ left: 0, top: 8, width: 372, height: 726 })
    .resize({ width: 1200, height: 630, fit: "contain", background: "#f4f1ea" })
    .webp({ quality: 84 })
    .toFile(join(root, "public", "images", "og.webp"));
  console.log("og → public/images/og.webp");
}

/**
 * Allège les textures déjà présentes dans le dépôt (public/textures/).
 * Aucune dépendance externe : s'exécute après n'importe quel `git clone`.
 */
async function prepareTextureAssets() {
  const veneerSrc = join(texturesDir, WOOD_VENEER);
  if (await exists(veneerSrc)) {
    const out = join(texturesDir, WOOD_VENEER.replace(/\.jpg$/, ".webp"));
    await sharp(veneerSrc).resize({ width: 1024 }).webp({ quality: 75 }).toFile(out);
    await rm(veneerSrc);
    console.log("placage bois →", out);
  }
}

async function run() {
  await prepareBoardAssets();
  await prepareTextureAssets();
  console.log("\nAssets générés avec succès.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

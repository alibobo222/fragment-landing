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

/** Textures dont le nuancier du configurateur affiche une vignette réelle
 *  (22 px — voir lib/materialSwatch.ts). Dérivées sous public/textures/swatch/,
 *  pour une fraction du poids des textures pleine résolution réservées au rendu 3D.
 *
 *  ⚠️ ON DÉCOUPE, ON NE RÉDUIT PAS. Une première version ramenait la tuile
 *  entière à 64 px : réduire une texture de ~300 px d'un facteur 5 moyenne le
 *  grain jusqu'à l'aplat. Mesuré sur la brique, l'écart-type de luminance
 *  tombait de 8,0 à 2,1 ; les coquilles de moules finissaient à 96 octets, soit
 *  un carré uniforme. On prélève donc une FENÊTRE à la résolution native, ce
 *  qui conserve le grain (écart-type mesuré après correction : 6,9 et 4,5). */
const SWATCH_SOURCES = [
  "brique.png",
  "verre-bleu.png",
  "verre-bouteille.png",
  "coquilles-huitres.png",
  "westerial-coquilles-moules.png",
  "beton-bleute.png",
  "bois-brule.png",
  // Config 02 (Craie) : intérieur d'abat-jour Renature + pied sable de
  // fonderie (remplace le travertin — image conservée, non référencée par
  // aucune variante).
  "renature.webp",
  "travertin.png",
  "sable-fonderie.png",
  // Config 03 (Terracotta) : pièce d'assemblage en acier corten. Source en
  // .jpg (fournie telle quelle) — voir la sortie toujours .webp ci-dessous.
  "tole-acier-corten.jpg",
  // Config 03 (Terracotta) : douille en métal rouillé.
  "douille-metal-rouille.png",
];

/** Côté de la vignette produite, en pixels. Affichée à 22 px, elle reste nette
 *  jusqu'à un écran à 4× de densité. */
const SWATCH_SIZE = 128;

/** Part du petit côté de la texture prélevée dans la fenêtre. */
const SWATCH_CROP_RATIO = 0.45;

/**
 * Bandeau d'échantillons Wasterial® (section 02, voir
 * components/chapters/MaterialsMarquee.tsx). Sources brutes déposées sous
 * public/images/materials/raw/ (jamais de référence à un chemin OneDrive dans
 * le code — voir data/materials.ts). Recadrage carré CENTRÉ sur l'image
 * entière (pas une fenêtre serrée comme les pastilles ci-dessus : ces photos
 * sont déjà proches de la taille d'affichage, pas de grain à préserver par
 * sur-échantillonnage). Deux largeurs, dimensionnées sur l'affichage réel du
 * bandeau (h-24/w-24 mobile → sm:h-32/sm:w-32 desktop, voir le composant) :
 * grandes assez pour rester nettes en Retina, jamais plus — la plus petite
 * source du lot (coquilles-de-moules, 282 px de côté utile) borne DESKTOP_W
 * pour ne jamais agrandir une photo au-delà de sa résolution native.
 */
const MATERIALS_MOBILE_W = 180;
const MATERIALS_DESKTOP_W = 260;
const materialsRawDir = join(root, "public", "images", "materials", "raw");
const materialsOutDir = join(root, "public", "images", "materials");
const MATERIAL_SLUGS = [
  "brique",
  "coquilles-de-moules",
  "verre-de-bouteille",
  "verre-bleu",
  "coquilles-huitres",
  "pierre-bleue",
  "sable-fonderie",
  "beton-bleute",
  "travertin",
];

/** planche variantes : grille source 3×2, colonnes de 217px, rendus sur fond
 *  blanc. La cellule (440, 360) — ex. « porcelaine-epoxy-mat », configuration
 *  07 retirée du catalogue — n'est plus découpée : la planche source garde
 *  ses 6 cases, seules 5 sont encore extraites. */
const variantCrops = [
  { name: "porcelaine-acier-noir", left: 6, top: 30, width: 206, height: 182 },
  { name: "brique-aluminium", left: 223, top: 30, width: 206, height: 182 },
  { name: "verre-bouteille-inox", left: 440, top: 30, width: 206, height: 182 },
  { name: "coquille-laiton", left: 6, top: 360, width: 206, height: 182 },
  { name: "verre-bleu-acier-anodise", left: 223, top: 360, width: 206, height: 182 },
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

  const swatchDir = join(texturesDir, "swatch");
  await mkdir(swatchDir, { recursive: true });
  for (const name of SWATCH_SOURCES) {
    const src = join(texturesDir, name);
    if (!(await exists(src))) continue;
    const out = join(swatchDir, name.replace(/\.(png|jpe?g|webp)$/i, ".webp"));

    // Fenêtre centrée d'environ 45 % du petit côté : assez large pour montrer
    // le motif (plusieurs briques, plusieurs éclats de verre), assez serrée
    // pour que le rapport de réduction reste proche de 1:1 et n'efface rien.
    const { width = 0, height = 0 } = await sharp(src).metadata();
    const side = Math.round(Math.min(width, height) * SWATCH_CROP_RATIO);

    await sharp(src)
      .extract({
        left: Math.round((width - side) / 2),
        top: Math.round((height - side) / 2),
        width: side,
        height: side,
      })
      .resize({ width: SWATCH_SIZE, height: SWATCH_SIZE, kernel: "lanczos3" })
      .webp({ quality: 88, effort: 6 })
      .toFile(out);
    console.log("pastille →", out);
  }
}

/**
 * Bandeau d'échantillons Wasterial® : recadrage carré centré (côté = petit
 * côté de la source, aucune fenêtre) puis deux tirages WebP par matière —
 * mobile et desktop — voir MATERIALS_MOBILE_W / MATERIALS_DESKTOP_W plus haut.
 * Source absente → avertissement et passage au suivant (pas d'échec dur ici :
 * c'est tests/texture-assets.test.ts qui verrouille l'existence des sorties
 * une fois générées, cette fonction reste un outil de préparation).
 */
async function prepareMaterialAssets() {
  await mkdir(materialsOutDir, { recursive: true });
  for (const slug of MATERIAL_SLUGS) {
    const src = join(materialsRawDir, `${slug}.png`);
    if (!(await exists(src))) {
      console.warn(`  ⚠ source manquante, ignorée : ${src}`);
      continue;
    }
    const { width = 0, height = 0 } = await sharp(src).metadata();
    const side = Math.min(width, height);
    const left = Math.round((width - side) / 2);
    const top = Math.round((height - side) / 2);

    for (const [suffix, w] of [
      ["mobile", MATERIALS_MOBILE_W],
      ["desktop", MATERIALS_DESKTOP_W],
    ]) {
      const out = join(materialsOutDir, `${slug}-${suffix}.webp`);
      await sharp(src)
        .extract({ left, top, width: side, height: side })
        .resize({ width: w, height: w, kernel: "lanczos3", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(out);
      console.log("matière →", out);
    }
  }
}

async function run() {
  await prepareBoardAssets();
  await prepareTextureAssets();
  await prepareMaterialAssets();
  console.log("\nAssets générés avec succès.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

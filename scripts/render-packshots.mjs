/**
 * GÉNÉRATION DES VIGNETTES — un seul shooting, sept configurations.
 *
 * Le script ne redessine rien : il PHOTOGRAPHIE la route `/packshot`, qui monte
 * le vrai composant 3D du produit avec la direction artistique de
 * `config/packshot.ts`. Aucune valeur de cadrage n'est dupliquée ici — c'est ce
 * qui garantit que les vignettes ne peuvent diverger ni du configurateur, ni les
 * unes des autres.
 *
 * Prérequis, une seule fois :
 *   npm i -D playwright && npx playwright install chromium
 *
 * Utilisation, dans deux terminaux :
 *   NEXT_PUBLIC_PACKSHOT=1 npm run dev
 *   npm run packshots
 *
 * `npm run packshots -- --manifest-only` saute le shooting Playwright et
 * recalcule/écrit seulement tests/packshot-manifest.json à partir de l'état
 * actuel du dépôt — à utiliser quand on SAIT qu'aucun pixel n'a changé (ex.
 * après un refactor qui ne touche à aucune entrée de rendu listée dans
 * scripts/packshot-manifest.mjs) et qu'on veut juste re-figer l'empreinte
 * sans payer un shooting complet.
 *
 * À la fin de la génération, écrit tests/packshot-manifest.json : l'empreinte
 * des entrées qui déterminent ce rendu (voir scripts/packshot-manifest.mjs),
 * relue par tests/packshot-manifest.test.ts pour détecter — automatiquement,
 * dans `npm run test` et la CI — le jour où ces vignettes deviennent périmées.
 * Partage volontaire : la DÉTECTION est automatique, la RÉGÉNÉRATION reste
 * manuelle et locale (elle demande Playwright, Chromium et un serveur Next
 * actif — hors de portée d'une CI sans readonly GPU/navigateur dédié, pour un
 * gain nul face à un simple `npm run packshots` avant de commiter).
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { computePackshotManifest } from "./packshot-manifest.mjs";

const BASE = process.env.PACKSHOT_URL ?? "http://localhost:3000";
const OUT = join(process.cwd(), "public", "images", "variants", "packshot");
const MANIFEST_ONLY = process.argv.includes("--manifest-only");

/** Marge minimale autour du sujet, en fraction du cadre. Seul réglage de
 *  composition du script — tout le reste vient de config/packshot.ts. */
const MARGIN = 0.07;

// Identifiants et taille lus dans les sources : impossible d'en oublier un ou de
// les désynchroniser.
const ids = [
  ...readFileSync(join(process.cwd(), "data", "product.ts"), "utf8")
    .matchAll(/^\s{4}id:\s*"([^"]+)"/gm),
].map((m) => m[1]);
if (ids.length === 0) throw new Error("aucune configuration dans data/product.ts");

if (!MANIFEST_ONLY) {
  const size = Number(
    /export const SIZE = (\d+)/.exec(
      readFileSync(join(process.cwd(), "config", "packshot.ts"), "utf8")
    )?.[1] ?? 512
  );

  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  // Rendu à 2× puis réduction : arêtes propres sur la silhouette de la lampe.
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 2,
  });

  const shots = [];
  for (const id of ids) {
    await page.goto(`${BASE}/packshot/?v=${encodeURIComponent(id)}`, {
      waitUntil: "networkidle",
      timeout: 90000,
    });
    // On attend le signal du composant, pas un délai deviné.
    await page.waitForFunction(
      () => document.documentElement.dataset.packshotReady === "1",
      null,
      { timeout: 90000 }
    );
    // Stabilisation : montée des matières et de l'ombre de contact.
    await page.waitForTimeout(1500);
    shots.push({ id, png: await page.screenshot({ omitBackground: false }) });
    console.log("  capturé", id);
  }
  await browser.close();

  /**
   * CADRAGE COMMUN — mesuré UNE SEULE FOIS sur la première capture, puis imposé
   * tel quel aux sept.
   *
   * La géométrie de la lampe est identique d'une configuration à l'autre : une
   * fenêtre unique suffit donc, et l'imposer est ce qui interdit à une vignette de
   * dériver. Surtout, cette normalisation ne doit JAMAIS être faite image par
   * image — ce serait retomber dans le défaut d'origine, où chaque fichier portait
   * son propre recadrage et donc sa propre échelle apparente.
   */
  const meta = await sharp(shots[0].png).metadata();
  const W = meta.width ?? size;
  const H = meta.height ?? size;
  const grey = await sharp(shots[0].png).greyscale().raw().toBuffer();
  let x0 = W;
  let x1 = 0;
  let y0 = H;
  let y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (grey[y * W + x] < 245) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  const side = Math.round(Math.max(x1 - x0, y1 - y0) / (1 - 2 * MARGIN));
  const left = Math.round((x0 + x1) / 2 - side / 2);
  const top = Math.round((y0 + y1) / 2 - side / 2);
  const padL = Math.max(0, -left);
  const padT = Math.max(0, -top);
  const padR = Math.max(0, left + side - W);
  const padB = Math.max(0, top + side - H);
  console.log(`\nsujet ${x1 - x0}×${y1 - y0} px → fenêtre ${side}px (marge ${MARGIN * 100} %)`);

  for (const { id, png } of shots) {
    // Deux passes : sharp ne sait pas étendre puis extraire dans la même chaîne.
    const padded = await sharp(png)
      .extend({ left: padL, top: padT, right: padR, bottom: padB, background: "#ffffff" })
      .png()
      .toBuffer();
    await sharp(padded)
      .extract({ left: left + padL, top: top + padT, width: side, height: side })
      .resize(size, size)
      .webp({ quality: 92 })
      .toFile(join(OUT, `${id}.webp`));
    console.log("  ✓", id);
  }

  console.log(`\n${ids.length} vignettes générées dans public/images/variants/packshot/`);
} else {
  console.log(`--manifest-only : vignettes NON régénérées (${ids.length} configurations).`);
}

// Empreinte des entrées de CE rendu, écrite APRÈS la génération (ou, en mode
// --manifest-only, du seul recalcul) : c'est bien l'état du dépôt qui vient
// de produire ces vignettes qui doit être enregistré, pas un état antérieur
// ou hypothétique.
const manifest = await computePackshotManifest();
if (manifest.missing.length > 0) {
  console.warn(
    "\n⚠️  Entrées introuvables au moment d'écrire le manifeste :\n" +
      manifest.missing.map((f) => `   - ${f}`).join("\n")
  );
}
const manifestPath = join(process.cwd(), "tests", "packshot-manifest.json");
writeFileSync(
  manifestPath,
  JSON.stringify(
    { generatedAt: new Date().toISOString(), ids, hash: manifest.hash, files: manifest.files },
    null,
    2
  ) + "\n"
);
console.log(`manifeste écrit → ${manifestPath}`);

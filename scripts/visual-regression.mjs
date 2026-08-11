/**
 * RÉGRESSION VISUELLE — compare les 7 configurations à une base de référence
 * versionnée (tests/visual-baseline/). Réutilise exactement le mécanisme de
 * scripts/render-packshots.mjs : route /packshot, NEXT_PUBLIC_PACKSHOT=1,
 * attente de data-packshot-ready. Aucune divergence possible avec ce que
 * montre réellement le configurateur — le script ne redessine rien.
 *
 * Usage, dans deux terminaux :
 *   NEXT_PUBLIC_PACKSHOT=1 npm run dev
 *   npm run visual              # compare à la base, échoue si écart > seuil
 *   npm run visual -- --update  # (ré)génère la base après un changement voulu
 *
 * Outil manuel : exige un serveur de dev, donc absent de `npm run test` et de
 * la CI. À lancer avant toute tâche annoncée « sans changement visuel ».
 */
import { chromium } from "playwright";
import sharp from "sharp";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.PACKSHOT_URL ?? "http://localhost:3000";
const BASELINE_DIR = join(process.cwd(), "tests", "visual-baseline");
const DIFF_DIR = join(process.cwd(), "tests", "visual-diff");
const UPDATE = process.argv.includes("--update");

/** Tolérance par canal (0-255) avant qu'un pixel compte comme « différent » —
 *  absorbe le bruit d'anti-aliasing du rendu WebGL, pas un vrai écart. */
const CHANNEL_TOLERANCE = 12;
/**
 * Part de pixels différents au-delà de laquelle une configuration échoue.
 *
 * Les textures de grain (bruit, moucheté, rugosité) sont régénérées par
 * `Math.random()` à CHAQUE chargement de page (voir lib/lampTextures.ts) : deux
 * captures strictement identiques en code diffèrent donc toujours un peu, de
 * façon non déterministe — mesuré jusqu'à 0,61 % sur trois essais consécutifs,
 * concentré sur les reflets spéculaires des pièces métalliques (la rugosité
 * varie pixel à pixel avec le bruit). Le seuil doit rester nettement au-dessus
 * de ce plancher ; une vraie régression (mauvaise matière, mauvaise couleur)
 * touche des régions entières, pas des pixels épars, et se compte en dizaines
 * de pourcents.
 */
const FAIL_RATIO = 0.02; // 2 %

// Identifiants lus dans les sources, comme render-packshots.mjs : impossible
// d'en oublier un ou de les désynchroniser de data/product.ts.
const ids = [
  ...readFileSync(join(process.cwd(), "data", "product.ts"), "utf8").matchAll(
    /^\s{4}id:\s*"([^"]+)"/gm
  ),
].map((m) => m[1]);
if (ids.length === 0) throw new Error("aucune configuration dans data/product.ts");
const size = Number(
  /export const SIZE = (\d+)/.exec(
    readFileSync(join(process.cwd(), "config", "packshot.ts"), "utf8")
  )?.[1] ?? 512
);

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: size, height: size },
  deviceScaleFactor: 2,
});

let failed = false;
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
  const png = await page.screenshot({ omitBackground: false });
  const current = await sharp(png).resize(size, size).png().toBuffer();

  const baselinePath = join(BASELINE_DIR, `${id}.png`);
  if (UPDATE || !existsSync(baselinePath)) {
    await sharp(current).toFile(baselinePath);
    console.log(UPDATE ? "  ↻ base mise à jour :" : "  + base créée :", id);
    continue;
  }

  const [curRaw, baseRaw] = await Promise.all([
    sharp(current).ensureAlpha().raw().toBuffer(),
    sharp(baselinePath).ensureAlpha().raw().toBuffer(),
  ]);
  if (curRaw.length !== baseRaw.length) {
    console.error(`  ✗ ${id} — dimensions différentes de la base, régénère avec --update`);
    failed = true;
    continue;
  }

  // Image de différence : écarts en rouge vif, reste du rendu atténué pour
  // garder le contexte (où, sur la lampe, l'écart se situe).
  const diffImg = Buffer.alloc(curRaw.length);
  let diffPixels = 0;
  const totalPixels = curRaw.length / 4;
  for (let p = 0; p < curRaw.length; p += 4) {
    const dr = Math.abs(curRaw[p] - baseRaw[p]);
    const dg = Math.abs(curRaw[p + 1] - baseRaw[p + 1]);
    const db = Math.abs(curRaw[p + 2] - baseRaw[p + 2]);
    const differs = dr > CHANNEL_TOLERANCE || dg > CHANNEL_TOLERANCE || db > CHANNEL_TOLERANCE;
    if (differs) {
      diffPixels++;
      diffImg[p] = 255;
      diffImg[p + 1] = 0;
      diffImg[p + 2] = 0;
      diffImg[p + 3] = 255;
    } else {
      diffImg[p] = curRaw[p];
      diffImg[p + 1] = curRaw[p + 1];
      diffImg[p + 2] = curRaw[p + 2];
      diffImg[p + 3] = 90;
    }
  }

  const ratio = diffPixels / totalPixels;
  const pct = (ratio * 100).toFixed(3);
  if (ratio > FAIL_RATIO) {
    const diffPath = join(DIFF_DIR, `${id}.png`);
    await sharp(diffImg, { raw: { width: size, height: size, channels: 4 } })
      .png()
      .toFile(diffPath);
    console.error(
      `  ✗ ${id} — ${pct} % de pixels différents (${diffPixels}/${totalPixels}) → ${diffPath}`
    );
    failed = true;
  } else {
    console.log(`  ✓ ${id} — ${pct} % (sous le seuil de ${FAIL_RATIO * 100} %)`);
  }
}
await browser.close();

if (failed) {
  console.error(
    "\nÉcart visuel détecté. Regarde tests/visual-diff/, puis relance avec --update si le changement est voulu."
  );
  process.exit(1);
}
console.log(`\n${ids.length} configurations conformes à la base.`);

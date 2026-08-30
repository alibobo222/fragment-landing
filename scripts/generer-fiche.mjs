/**
 * GÉNÉRATION DE LA FICHE TECHNIQUE EN PDF — à partir de `data/specs.ts`.
 *
 * Lancé par `prebuild` et `predev` : le document est produit à chaque build, en
 * local comme sur Vercel. Il ne peut donc PAS diverger de sa source, et il n'y a
 * aucun test de fraîcheur à maintenir — rien à surveiller, parce qu'il n'y a
 * rien à oublier.
 *
 * Pourquoi pas le patron des packshots (génération manuelle + garde-fou) : ce
 * patron n'existe que parce que les vignettes exigent un navigateur et un GPU,
 * que Vercel n'a pas. Une fiche technique, c'est du texte sur une page. Sans la
 * contrainte qui le justifie, ce patron n'apporterait que ses inconvénients —
 * un oubli possible, rattrapé après coup par une CI rouge.
 *
 * Le PDF n'est donc PAS versionné (voir .gitignore) : il est produit, pas tenu.
 *
 * RÈGLE PRODUIT, entière : un champ `null` de `productSpecs` n'est jamais
 * comblé. Il apparaît comme non renseigné, ou disparaît — jamais avec une valeur
 * inventée.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { productSpecs } from "../data/specs.ts";
import { siteConfig } from "../config/site.ts";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = join(RACINE, "public", "documents", "fiche-technique.pdf");

// A4 en points typographiques (72 pt = 1 pouce).
const PAGE = { l: 595.28, h: 841.89 };
const MARGE = 56;
const ENCRE = rgb(0.03, 0.03, 0.04); // --color-ink
const GRIS = rgb(0.42, 0.42, 0.38); // --color-ink-muted
const FILET = rgb(0.8, 0.78, 0.74); // --color-line

/**
 * Date FIXE, volontairement. pdf-lib horodate le document à la création : sans
 * cela, deux builds du même contenu produiraient deux fichiers différents, et
 * l'on perdrait la reproductibilité qui fait tout l'intérêt d'un artefact
 * dérivé. La date n'apparaît nulle part dans le document.
 */
const DATE_FIXE = new Date(Date.UTC(2026, 0, 1));

async function generer() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("FRAGMENT — Noir Minéral · Fiche technique");
  pdf.setAuthor(siteConfig.brandName);
  pdf.setSubject("Caractéristiques techniques de la lampe Noir Minéral");
  pdf.setProducer("");
  pdf.setCreator("");
  pdf.setCreationDate(DATE_FIXE);
  pdf.setModificationDate(DATE_FIXE);

  const page = pdf.addPage([PAGE.l, PAGE.h]);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);

  let y = PAGE.h - MARGE;

  // — Titre
  page.drawText("FRAGMENT", { x: MARGE, y, size: 22, font: gras, color: ENCRE });
  y -= 20;
  page.drawText("Noir Minéral — lampe de table sculpturale", {
    x: MARGE, y, size: 11, font: normal, color: GRIS,
  });

  // — Filet de tête
  y -= 26;
  page.drawLine({
    start: { x: MARGE, y }, end: { x: PAGE.l - MARGE, y },
    thickness: 1, color: ENCRE,
  });

  y -= 30;
  page.drawText("FICHE TECHNIQUE", { x: MARGE, y, size: 9, font: gras, color: GRIS });
  y -= 26;

  // — Les caractéristiques, dans l'ordre de data/specs.ts (qui EST la hiérarchie)
  const colonneValeur = MARGE + 170;
  const largeurValeur = PAGE.l - MARGE - colonneValeur;

  for (const champ of productSpecs) {
    // Un champ inconnu et non demandé ne figure pas : mieux vaut une fiche
    // courte qu'une ligne vide qui laisse croire à un oubli.
    if (champ.value === null && !champ.pending) continue;

    const texte = champ.value === null ? "En attente de l'atelier" : champ.value;
    const lignes = decouper(texte, normal, 10, largeurValeur);

    page.drawText(champ.label.toUpperCase(), {
      x: MARGE, y, size: 8, font: gras, color: GRIS,
    });
    lignes.forEach((ligne, i) => {
      page.drawText(ligne, {
        x: colonneValeur, y: y - i * 14, size: 10, font: normal,
        color: champ.value === null ? GRIS : ENCRE,
      });
    });

    y -= Math.max(1, lignes.length) * 14 + 12;
    page.drawLine({
      start: { x: MARGE, y: y + 8 }, end: { x: PAGE.l - MARGE, y: y + 8 },
      thickness: 0.5, color: FILET,
    });
    y -= 12;
  }

  // — Mention de fin : la même réserve que sur le site
  y -= 10;
  for (const ligne of decouper(
    "Certaines caractéristiques sont précisées au cas par cas selon la configuration, lors de votre prise de contact.",
    normal, 9, PAGE.l - 2 * MARGE
  )) {
    page.drawText(ligne, { x: MARGE, y, size: 9, font: normal, color: GRIS });
    y -= 12;
  }

  // — Pied de page
  page.drawText(siteConfig.siteUrl.replace(/^https?:\/\//, ""), {
    x: MARGE, y: MARGE - 16, size: 8, font: normal, color: GRIS,
  });
  page.drawText(siteConfig.contactEmail, {
    x: PAGE.l - MARGE - normal.widthOfTextAtSize(siteConfig.contactEmail, 8),
    y: MARGE - 16, size: 8, font: normal, color: GRIS,
  });

  mkdirSync(dirname(SORTIE), { recursive: true });
  writeFileSync(SORTIE, await pdf.save());

  const retenus = productSpecs.filter((c) => c.value !== null || c.pending).length;
  const masques = productSpecs.length - retenus;
  console.log(`fiche technique → public/documents/fiche-technique.pdf`);
  console.log(`  ${retenus} caractéristique(s) retenue(s), ${masques} masquée(s) faute de donnée`);
}

/** Découpe un texte à la largeur disponible, sans couper les mots. */
function decouper(texte, police, taille, largeur) {
  const mots = texte.split(" ");
  const lignes = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? courante + " " + mot : mot;
    if (police.widthOfTextAtSize(essai, taille) > largeur && courante) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = essai;
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

generer().catch((e) => {
  console.error("échec de la génération de la fiche technique :", e);
  process.exit(1);
});

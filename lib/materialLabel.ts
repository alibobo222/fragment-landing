/**
 * Affichage d'une matière SOUS son intitulé de pièce.
 *
 * Le problème : `data/product.ts` décrit chaque finition par un libellé complet
 * et autonome — « Câble textile bleu » — parce que ce libellé sert aussi seul,
 * par exemple dans `materialsSummary`. Mais dès qu'on l'affiche sous le nom de
 * la pièce, le mot se répète :
 *
 *     Câble textile
 *     Câble textile bleu      ← illisible, et sur la vue éclatée, franchement
 *                               brouillon
 *
 * Ce module retire la partie déjà dite. La comparaison ignore la casse et les
 * accents, et exige une coupure NETTE (le reste doit commencer par une espace),
 * pour ne jamais tronquer un libellé qui commencerait par les mêmes lettres sans
 * être le même mot.
 *
 * Aucune donnée n'est réécrite : `data/product.ts` reste la source de vérité,
 * c'est uniquement l'affichage qui évite la redite.
 */

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export interface FinishParts {
  /** Ce qui reste une fois l'intitulé de pièce retiré (« bleu »), ou `null`. */
  suffix: string | null;
  /** Le libellé complet, quand il n'y a rien à retirer (« Porcelaine »). */
  full: string | null;
}

export function splitFinishLabel(
  partLabel: string,
  finishLabel: string
): FinishParts {
  const p = normalise(partLabel);
  const f = normalise(finishLabel);
  if (p && f.startsWith(p) && f.length > p.length && f[p.length] === " ") {
    return { suffix: finishLabel.slice(partLabel.length).trim(), full: null };
  }
  if (p && f === p) return { suffix: null, full: null }; // strictement identique
  return { suffix: null, full: finishLabel };
}

/** Première lettre en capitale — pour un libellé devenu autonome (« Bleu »). */
export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

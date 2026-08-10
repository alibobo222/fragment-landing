/**
 * Chronologie de la scène éclatée — LA source de vérité du découpage.
 *
 * La piste de scroll (`ExplodedScrollTrack`) traduit le défilement en une
 * progression 0 → 1. Cette progression n'est PAS distribuée uniformément : elle
 * est découpée en actes distincts, pour qu'on ne fasse jamais deux choses en
 * même temps et, surtout, pour ménager un vrai temps de lecture.
 *
 *   0 ──────── 0.04 ─────────────── 0.44 ──── 0.50 ──────── 0.68 ─────────── 0.92 ─── 1
 *   │  amorce  │   ACTE 1           │  respi- │  ACTE 2     │  ACTE 3        │ sortie │
 *   │  (invite │   désassemblage    │  ration │  tracé des  │  PALIER DE     │ fondu  │
 *   │  au      │   les pièces se    │         │  flèches +  │  LECTURE       │        │
 *   │  scroll) │   séparent         │         │  étiquettes │  rien ne bouge │        │
 *
 * Le défaut corrigé : auparavant le désassemblage occupait TOUTE la piste, les
 * annotations ne finissaient de se tracer qu'à 0.985, et le fondu de sortie
 * démarrait dès 0.93 — la nomenclature était donc encore en train d'apparaître
 * que la scène s'effaçait déjà. Impossible de lire quoi que ce soit.
 *
 * Ajuster ces bornes suffit à re-doser l'expérience ; aucun autre fichier ne
 * contient de valeur de timing.
 */
export const EXPLODED_TIMELINE = {
  /** ACTE 1 — désassemblage. Petite amorce pour que l'invite au scroll se lise. */
  explodeStart: 0.04,
  explodeEnd: 0.44,

  /** ACTE 2 — tracé des flèches et apparition des étiquettes (scène immobile). */
  annoStart: 0.5,
  annoEnd: 0.68,

  /**
   * ACTE 3 — palier de lecture : tout est en place et rien ne bouge, jusqu'à la
   * FIN de la piste.
   *
   * Il n'y a plus de fondu de sortie. La scène restait auparavant épinglée
   * jusqu'au bout tout en s'effaçant sur les 8 derniers pour cent : elle
   * occupait donc un écran entier, invisible. À l'écran, cela donnait
   * exactement une page blanche entre la vue éclatée et le chapitre suivant.
   * La planche reste maintenant visible jusqu'au relâchement de l'épinglage,
   * puis défile naturellement vers le haut — le chapitre suivant enchaîne sans
   * rupture.
   */
  holdEnd: 1,
} as const;

/** Ramène une progression globale dans la fenêtre [a, b], bornée à 0 → 1. */
export function phaseProgress(v: number, a: number, b: number): number {
  return Math.min(1, Math.max(0, (v - a) / Math.max(1e-4, b - a)));
}

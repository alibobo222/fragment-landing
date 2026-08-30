/**
 * Micro-typographie française, appliquée AU RENDU.
 *
 * Les fichiers de données (`data/product.ts`, `data/specs.ts`,
 * `data/materials.ts`) restent écrits en caractères ordinaires : une donnée doit
 * pouvoir être relue et modifiée par quelqu'un qui ne connaît pas ces règles,
 * sans y semer des caractères invisibles qu'un copier-coller casserait.
 *
 * Ce qui est appliqué :
 *   - espace insécable AVANT `:` `;` `!` `?` et avant le guillemet fermant » ;
 *   - espace insécable APRÈS le guillemet ouvrant « ;
 *   - espace insécable entre un nombre et son unité, et dans les grands nombres ;
 *   - espace insécable après un mot d'UNE ou DEUX lettres, pour qu'il ne reste
 *     pas seul en bout de ligne ;
 *   - apostrophe typographique ’ à la place de l'apostrophe droite.
 *
 * DEUX LIMITES VOLONTAIRES, l'une et l'autre mesurées.
 *
 * 1. La règle des mots courts s'arrête à DEUX lettres. Coller tous les mots
 *    courts fabriquerait des blocs insécables longs, qui débordent
 *    horizontalement sur un écran de 320 px. Les enchaînements sont en outre
 *    interrompus : « il y a » ne devient pas un seul bloc, seul le dernier lien
 *    est posé.
 *
 * 2. NE JAMAIS appliquer aux champs de saisie, aux messages d'erreur du
 *    formulaire, ni à une valeur qu'un test compare. Une espace insécable est un
 *    caractère différent d'une espace ordinaire : elle casserait une validation
 *    ou une assertion sans rien signaler.
 */

/** Espace insécable (U+00A0). Retenue plutôt que la fine insécable U+202F :
 *  mieux rendue par les polices du projet, et sans risque de tofu. */
const INSEC = " ";
const APO = "’";

/** Unités rencontrées dans les données produit. Liste explicite : une
 *  détection large collerait « 4 blocs » ou « 2 pièces », qui ne sont pas des
 *  unités et n'ont aucune raison d'être insécables. */
const UNITES = ["K", "V", "W", "A", "Hz", "cm", "mm", "m", "kg", "g", "h", "min", "s", "lm", "nm", "°C", "%"];

/** Mots d'une ou deux lettres, en fin desquels on pose une insécable. */
const MOT_COURT = /(^|[\s(«])([A-Za-zÀ-ÿ]{1,2}|\d{1,2}) (?=[A-Za-zÀ-ÿ0-9«])/g;

/**
 * Compose un texte selon les règles françaises.
 *
 * @param texte texte éditorial (jamais une saisie, jamais un message d'erreur)
 * @returns le même texte, avec les espaces insécables et l'apostrophe typographique
 */
export function composer(texte: string): string {
  if (!texte) return texte;
  let t = texte;

  // Apostrophe typographique — avant tout le reste : elle ne touche pas aux espaces.
  t = t.replace(/'/g, APO);

  // Grands nombres : 4 000 → 4<insec>000. Avant la règle des unités, qui
  // s'appuie sur le chiffre qui précède.
  t = t.replace(/(\d) (?=\d{3}\b)/g, "$1" + INSEC);

  // Nombre + unité.
  const unites = UNITES.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  t = t.replace(new RegExp("(\\d)\\u0020(" + unites + ")\\b", "g"), "$1" + INSEC + "$2");

  // Guillemets français : insécable à l'intérieur.
  t = t.replace(/«[  ]?/g, "«" + INSEC);
  t = t.replace(/[  ]?»/g, INSEC + "»");

  // Ponctuation double : insécable avant, si une espace ordinaire précède ou si
  // rien ne précède. On ne touche pas à « 16:9 » ni aux URL (pas d'espace après).
  t = t.replace(/[  ]?([;!?])/g, INSEC + "$1");
  t = t.replace(/[  ]?:(?=[  ]|$)/g, INSEC + ":");

  // Mots d'une ou deux lettres. Appliqué en dernier, et une seule passe : les
  // chevauchements ne sont pas repris, ce qui évite les chaînes trop longues.
  t = t.replace(MOT_COURT, "$1$2" + INSEC);

  return t;
}

/** Compose chaque valeur d'un tableau de chaînes. */
export function composerTout(textes: readonly string[]): string[] {
  return textes.map(composer);
}

/**
 * DIRECTION ARTISTIQUE DES VIGNETTES — source de vérité UNIQUE.
 *
 * Toutes les configurations doivent donner l'impression d'un même shooting :
 * même caméra, même focale, même angle, même échelle, même centrage, mêmes
 * marges, même éclairage, mêmes ombres, même exposition. Rien de tout cela n'est
 * réglé vignette par vignette — tout vient d'ici, et la route de rendu comme le
 * script de génération lisent ce fichier.
 *
 * ⚠️ CE QUI REND LA COHÉRENCE GRATUITE : la géométrie de la lampe est IDENTIQUE
 * d'une configuration à l'autre — seules les matières changent. Une caméra fixe
 * suffit donc à garantir mathématiquement le même cadrage, la même échelle et le
 * même centrage sur les sept vignettes. Aucun recadrage manuel n'est nécessaire,
 * et aucun ne doit être introduit : il romprait la comparabilité.
 *
 * Le cadrage n'est pas choisi à l'œil, il est CALCULÉ (voir CAMERA).
 */

/** Côté de l'image générée, en pixels. Rendu à 2× puis réduit : bords propres. */
export const SIZE = 512;

/**
 * Part de la hauteur d'image occupée par le corps de la lampe (abat-jour +
 * pied). Le reste est la marge, identique sur les quatre côtés puisque le sujet
 * est centré. 0,74 donne un packshot éditorial : le produit respire sans se
 * perdre dans le vide.
 */
export const FILL = 0.74;

/** Focale. Volontairement longue (angle étroit) : une perspective douce, sans
 *  déformation spectaculaire, qui laisse comparer les silhouettes. */
export const FOV = 26;

/** Vue trois-quarts, légèrement en plongée. */
export const AZIMUTH = Math.PI / 6; // 30° — trois-quarts franc
export const ELEVATION = Math.PI / 10; // 18° — plongée légère

/**
 * Position de caméra, DÉDUITE de la géométrie et non réglée à vue.
 *
 * Le corps de la lampe (abat-jour ∪ pied, mesuré sur le GLB) fait 0,204 de haut.
 * Pour qu'il occupe FILL de l'image à une focale de FOV degrés, la hauteur
 * visible doit valoir 0,204 / FILL, d'où une distance de
 *   (0,204 / FILL) / (2·tan(FOV/2)) ≈ 0,597.
 * La direction applique ensuite l'azimut et l'élévation ci-dessus.
 */
const BODY_HEIGHT = 0.204;
const DISTANCE =
  BODY_HEIGHT / FILL / (2 * Math.tan((FOV * Math.PI) / 180 / 2));

export const CAMERA: [number, number, number] = [
  Math.sin(AZIMUTH) * Math.cos(ELEVATION) * DISTANCE,
  Math.sin(ELEVATION) * DISTANCE,
  Math.cos(AZIMUTH) * Math.cos(ELEVATION) * DISTANCE,
];

/** Fond : blanc pur, comme le reste du site. Le canvas est transparent ; c'est
 *  la page qui pose ce fond, donc il est rigoureusement identique partout. */
export const BACKGROUND = "#ffffff";

/**
 * État lumineux du produit sur les vignettes : lampe ÉTEINTE.
 *
 * Une lampe allumée projette sa propre lumière colorée sur les matières et les
 * teinte différemment selon la configuration — exactement ce qu'il faut éviter
 * quand on veut comparer des matières. Éteinte, seul l'éclairage de studio
 * s'applique : identique pour les sept.
 */
export const LAMP_ON = false;
export const WARM = true;

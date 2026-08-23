/**
 * Correspondance entre les meshes réels du GLB (générés par `npm run cad`)
 * et les rôles sémantiques de la lampe, plus la résolution des matériaux 3D
 * à partir des matières de chaque variante.
 *
 * Les noms ci-dessous sont les NOMS RÉELS des nœuds exportés (vérifiés à
 * l'inspection), pas des suppositions.
 */
import type { ProductVariant } from "@/data/product";
import { materialProfile, type MaterialKind } from "@/lib/lampTextures";

export const LAMP_MODEL_URL = "/models/lampe-optimisee.glb";

export const lampMeshMapping = {
  shade: ["Shade"],
  connector: ["Connector"],
  base: ["Base"],
  socket: ["Socket"],
  cable: ["Cable"],
  bulb: ["Bulb"],
} as const;

export type LampPart = keyof typeof lampMeshMapping;

/** Quel champ de la variante fournit la matière de chaque partie par défaut.
 *  Cas particulier de la douille : voir `finishFor`, `variant.socket` prend
 *  le dessus sur ce repli quand il est renseigné. */
const FINISH_SOURCE: Record<
  Exclude<LampPart, "bulb">,
  "shade" | "assembly" | "base" | "cable"
> = {
  shade: "shade",
  connector: "assembly",
  base: "base",
  socket: "assembly", // repli si `variant.socket` est absent
  cable: "cable",
};

/**
 * Les SEULES pièces dont le matériau a le droit de devenir émissif, c'est-à-dire
 * d'émettre de la lumière par lui-même indépendamment de l'éclairage de la scène.
 *
 *   - `bulb`  : l'ampoule, qui EST la source lumineuse ;
 *   - `shade` : l'abat-jour, dont une fraction de la lumière traverse la matière
 *               (transmission approchée — voir `shadeTransmission`).
 *
 * Tout le reste — et **explicitement la pièce d'assemblage** (`connector`) ainsi
 * que la douille (`socket`), qui en partage la finition — doit conserver
 * exactement le même matériau, la même couleur et la même apparence que la lampe
 * soit allumée ou éteinte. Ces pièces ne reçoivent que l'éclairage PHYSIQUE de la
 * scène, ce qui est voulu ; leur matériau, lui, ne bascule jamais en mode
 * lumineux.
 *
 * Liste d'AUTORISATION et non d'exclusion, volontairement : une pièce ajoutée
 * plus tard sera non émissive par défaut, sans qu'on ait à y penser.
 */
const EMISSIVE_PARTS: readonly LampPart[] = ["bulb", "shade"];

/** `true` si le matériau de cette pièce a le droit d'émettre de la lumière. */
export function canEmit(part: LampPart): boolean {
  return EMISSIVE_PARTS.includes(part);
}

/**
 * Matière (libellé + couleur) d'une partie donnée pour une variante.
 *
 * Cas particulier de la douille : elle partage par défaut la finition de la
 * pièce d'assemblage (même pièce métallique), mais `variant.socket`, quand
 * il est renseigné, prend le dessus — même principe que `shadeInner` pour
 * l'intérieur de l'abat-jour. Absent sur une configuration → comportement
 * inchangé, la douille suit l'assemblage exactement comme avant.
 */
export function finishFor(
  part: Exclude<LampPart, "bulb">,
  variant: ProductVariant
) {
  if (part === "socket" && variant.socket) return variant.socket;
  return variant[FINISH_SOURCE[part]];
}

/**
 * Éclairage de la lampe — tous les paramètres centralisés et faciles à ajuster.
 *
 * La température de couleur simule un module LED Tunable White à DEUX CANAUX
 * (Warm White ≈ 2 700 K, Cool White ≈ 6 500 K) : le réglage utilisateur pilote
 * un mélange continu de ces deux canaux, exactement comme le ferait un driver
 * CCT physique — jamais un choix binaire entre deux états. Ces trois valeurs
 * (min/milieu/max) sont donc de vraies bornes techniques de prototype, pas un
 * habillage visuel : elles pourront être reportées telles quelles sur un
 * driver CCT réel.
 */
export const lampLightConfig = {
  enabled: true,
  // Blanc chaud doux (visuel — pas une valeur technique produit).
  color: "#ffedd2",
  /** Borne basse : canal Warm White du module CCT. */
  kelvinMin: 2700,
  /** Point neutre approximatif (mélange ~50/50 des deux canaux). */
  kelvinMid: 4000,
  /** Borne haute : canal Cool White du module CCT. */
  kelvinMax: 6500,
  /** Réglage par défaut au chargement — point neutre (mélange ~50/50 des
   *  deux canaux, kelvinMid), au lieu du Warm White seul (2 700 K). */
  defaultKelvin: 4000,
  /** Transition douce entre températures (ms). */
  tempTransitionMs: 320,
  /** Lumière dirigée (SpotLight) sortant par l'ouverture de l'abat-jour. */
  spotIntensity: 1.25, // douce, pas de zone brûlée
  angle: Math.PI / 2.9, // cône large
  penumbra: 1.0, // bords parfaitement progressifs
  distance: 1.6,
  decay: 2,
  /** Diffusion intérieure (PointLight faible). */
  pointIntensity: 0.22,
  pointDistance: 0.8,
  /** Émission de l'ampoule (discrète, sans surexposition). */
  emissiveIntensity: 0.32,
  /** Émission subtile de l'abat-jour translucide (transmission approchée). */
  glassGlowMax: 0.1,
  /** Allumage progressif au chargement (ms) ; coupé si reduced-motion. */
  fadeInDuration: 900,
  /** Bascule allumage/extinction via le bouton on/off (ms). */
  toggleDuration: 420,
  /** Interpolation de la transmission au changement de variante (ms). */
  transitionMs: 450,
  /** Ombres dynamiques : coûteuses — désactivées par défaut (mobile). */
  shadows: false,
} as const;

const clamp01to255 = (v: number) => Math.max(0, Math.min(255, v));
const toHexByte = (v: number) => Math.round(clamp01to255(v)).toString(16).padStart(2, "0");

/**
 * Approxime la couleur RVB perçue d'un corps noir à une température de couleur
 * donnée (méthode de Tanner Helland, valide de 1000 K à 40000 K) — la même
 * base de calcul que celle qu'utilisent les fiches techniques de LED pour
 * illustrer un CCT. Aucune couleur choisie à la main : c'est un vrai calcul.
 */
function blackbodyRGB(kelvin: number): [number, number, number] {
  const k = kelvin / 100;

  let r: number;
  if (k <= 66) r = 255;
  else r = 329.698727446 * Math.pow(k - 60, -0.1332047592);

  let g: number;
  if (k <= 66) g = 99.4708025861 * Math.log(k) - 161.1195681661;
  else g = 288.1221695283 * Math.pow(k - 60, -0.0755148492);

  let b: number;
  if (k >= 66) b = 255;
  else if (k <= 19) b = 0;
  else b = 138.5177312231 * Math.log(k - 10) - 305.0447927307;

  return [clamp01to255(r), clamp01to255(g), clamp01to255(b)];
}

/**
 * Kelvin → couleur hexadécimale, pour l'ampoule 3D ET le curseur de l'interface
 * (même fonction, même résultat : le curseur montre littéralement la couleur
 * qu'il produit).
 *
 * Le corps noir pur reste très proche du blanc à 6500 K (à peine bleuté) — trop
 * discret pour se lire clairement à l'écran sur un petit curseur. On renforce
 * donc légèrement la teinte au fur et à mesure qu'on s'éloigne du point neutre
 * (`kelvinMid`), vers l'ambre côté chaud et vers un bleu doux côté froid,
 * jusqu'à 18 % maximum aux bornes : assez pour que la variation soit lisible
 * au premier coup d'œil, jamais jusqu'à un orange ou un bleu saturés — la
 * transition reste celle d'un blanc qui se réchauffe ou se refroidit, pas
 * un dégradé arc-en-ciel.
 */
export function kelvinToRGB(kelvinRaw: number): string {
  const { kelvinMin, kelvinMid, kelvinMax } = lampLightConfig;
  const kelvin = Math.max(kelvinMin, Math.min(kelvinMax, kelvinRaw));
  const [r, g, b] = blackbodyRGB(kelvin);

  const cold = kelvin >= kelvinMid;
  const span = cold ? kelvinMax - kelvinMid : kelvinMid - kelvinMin;
  const t = span > 0 ? Math.abs(kelvin - kelvinMid) / span : 0;
  const boost = t * 0.18;
  // Ambre (chaud) / bleu doux (froid) — accentuation, pas une couleur de repli.
  const tint = cold ? ([173, 200, 255] as const) : ([255, 190, 120] as const);

  const mix = (base: number, target: number) => base + (target - base) * boost;
  return `#${toHexByte(mix(r, tint[0]))}${toHexByte(mix(g, tint[1]))}${toHexByte(mix(b, tint[2]))}`;
}

/**
 * Part de lumière « traversant » l'abat-jour selon sa matière (0 = opaque).
 * Lecture directe du profil (voir `PROFILES` dans `lib/lampTextures.ts`) :
 * la transmission est une propriété de la matière au même titre que sa
 * rugosité, sans détection séparée sur le libellé.
 */
export function shadeTransmission(material: MaterialKind): number {
  return materialProfile(material).transmission;
}

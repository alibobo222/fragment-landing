/**
 * Correspondance entre les meshes réels du GLB (générés par `npm run cad`)
 * et les rôles sémantiques de la lampe, plus la résolution des matériaux 3D
 * à partir des matières de chaque variante.
 *
 * Les noms ci-dessous sont les NOMS RÉELS des nœuds exportés (vérifiés à
 * l'inspection), pas des suppositions.
 */
import type { ProductVariant } from "@/data/product";

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

/** Quel champ de la variante fournit la matière de chaque partie. */
const FINISH_SOURCE: Record<
  Exclude<LampPart, "bulb">,
  "shade" | "assembly" | "base" | "cable"
> = {
  shade: "shade",
  connector: "assembly",
  base: "base",
  socket: "assembly", // la douille partage la finition métal de l'assemblage
  cable: "cable",
};

export interface Surface {
  color: string;
  roughness: number;
  metalness: number;
}

/** Déduit rugosité/métallicité d'une matière à partir de son libellé. */
export function surfaceFromLabel(label: string): {
  roughness: number;
  metalness: number;
} {
  const l = label.toLowerCase();
  if (/(inox|aluminium|acier|laiton)/.test(l)) return { roughness: 0.34, metalness: 0.9 };
  if (/(époxy|epoxy)/.test(l)) return { roughness: 0.55, metalness: 0.08 };
  if (/verre/.test(l)) return { roughness: 0.22, metalness: 0.0 };
  if (/(porcelaine|brique|béton|beton|terre|nacre|coquille)/.test(l))
    return { roughness: 0.9, metalness: 0.0 };
  if (/(câble|cable)/.test(l)) return { roughness: 0.8, metalness: 0.0 };
  return { roughness: 0.7, metalness: 0.0 };
}

/** Matériau 3D d'une partie pour une variante donnée. */
export function surfaceFor(part: LampPart, variant: ProductVariant): Surface {
  if (part === "bulb") {
    return { color: "#fff2c8", roughness: 0.25, metalness: 0 };
  }
  const finish = variant[FINISH_SOURCE[part]];
  return { color: finish.color, ...surfaceFromLabel(finish.label) };
}

/** Matière (libellé + couleur) d'une partie donnée pour une variante. */
export function finishFor(
  part: Exclude<LampPart, "bulb">,
  variant: ProductVariant
) {
  return variant[FINISH_SOURCE[part]];
}

/**
 * Éclairage de la lampe — tous les paramètres centralisés et faciles à ajuster.
 * La température est un blanc chaud *visuel* : ce n'est PAS une caractéristique
 * technique du produit (aucune valeur en kelvin affichée nulle part).
 */
export const lampLightConfig = {
  enabled: true,
  // Blanc chaud doux (visuel — pas une valeur technique produit).
  color: "#ffedd2",
  /** Températures de couleur sélectionnables (visuel, luminance ~égale).
   *  Contraste accentué : ambre franc (chaud) ↔ bleu franc (froid). */
  colorWarm: "#ffc46b", // ~2700 K : blanc chaud, dominante ambrée marquée
  colorCold: "#aac8ff", // ~6000 K : blanc froid, dominante bleutée marquée
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

/**
 * Part de lumière « traversant » l'abat-jour selon sa matière (0 = opaque).
 * Reste faible : c'est le passage par l'ouverture qui domine, pas un néon.
 */
export function shadeTransmission(label: string): number {
  const l = label.toLowerCase();
  // « Wasterial® - Billes de verre » (ex « Verre bleu ») : matière dense/opaque
  // (d'après la texture fournie), pas un verre translucide → aucune transmission
  // forcée. On matche « billes de verre » (et non « wasterial » nu, sinon
  // « Wasterial® - Coquilles d'huître » perdrait sa transmission coquille).
  if (/billes de verre|verre bleu/.test(l)) return 0.08;
  // « WESTERIAL - Coquilles de moules » / « Noir mat » / « Béton noir » :
  // composite noir dense et opaque (placé AVANT la règle coquille/nacre).
  if (/westerial|coquilles de moules|noir mat|b[ée]ton noir/.test(l)) return 0.08;
  if (/verre/.test(l)) return 1;
  if (/porcelaine/.test(l)) return 0.45;
  if (/(coquille|nacre)/.test(l)) return 0.25;
  return 0.08; // brique et autres : quasi opaque
}

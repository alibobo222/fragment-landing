/**
 * Données produit de la lampe Noir Minéral.
 *
 * Source visuelle : photographies du prototype + planche de personnalisation
 * fournies par l'atelier (voir /public/images). Aucune caractéristique n'est
 * inventée : les champs techniques inconnus sont `null` et centralisés dans
 * `productSpecs` avec un commentaire TODO.
 *
 * La lampe se compose de trois volumes distincts, ce qui rend chaque
 * combinaison lisible dans l'animation du hero et le configurateur :
 *   1. shade    — l'abat-jour incliné (le grand volume)
 *   2. assembly — la pièce d'assemblage métallique (grille pliée + douille)
 *   3. base     — le pied cylindrique
 * + un câble textile.
 */

export interface PartFinish {
  /** Matière/finition affichée à l'utilisateur. */
  label: string;
  /** Couleur représentative pour les pastilles et l'animation (token CSS). */
  color: string;
}

export interface ProductVariant {
  id: string;
  /** Numéro d'affichage éditorial, ex. "01". */
  index: string;
  /** Nom premium, sens et matières d'origine préservés. */
  name: string;
  /** Résumé matière court, ex. "Porcelaine · Acier anodisé noir". */
  materialsSummary: string;
  /**
   * Couleur dominante de la composition, utilisée comme accent global
   * (titres, boutons...). Choisie assez sombre pour rester lisible :
   * texte blanc sur bouton (≥ 4.5:1) et mot de titre sur fond clair.
   */
  accent: string;
  /**
   * Pôle clair de la même composition, pour les éléments d'accent posés sur
   * fond noir (bande marquee, pied de page) où `accent` serait illisible.
   */
  accentOnDark: string;
  shade: PartFinish;
  assembly: PartFinish;
  base: PartFinish;
  cable: PartFinish;
  /** Description sensorielle courte. */
  description: string;
  /** Visuel de la combinaison (rendu de la planche). */
  image: string;
  /** Texte alternatif descriptif en français. */
  alt: string;
}

export const variants: ProductVariant[] = [
  {
    id: "prototype-noir-cable-bleu",
    index: "01",
    name: "Noir brut & câble bleu",
    materialsSummary: "WESTERIAL - Coquilles de moules · Acier brut · Câble bleu",
    // Accent : le bleu franc du câble textile, signature de la pièce d'origine.
    accent: "#2a3fe6",
    accentOnDark: "#6f83ff",
    shade: { label: "WESTERIAL - Coquilles de moules", color: "#1a1a1c" },
    assembly: { label: "Acier brut", color: "#b7bab8" },
    base: { label: "WESTERIAL - Coquilles de moules", color: "#1a1a1c" },
    // Bleu Klein (International Klein Blue, outremer profond). Seule la couleur
    // de base change ; le kind reste « fabric » (texture de tissage inchangée).
    cable: { label: "Câble bleu", color: "#002FA7" },
    description:
      "Le prototype d'origine : un noir brut et mat, l'âme claire du bois révélée à l'ouverture, ponctuée du bleu franc du câble textile.",
    image: "/images/prototype/trois-quarts.webp",
    alt: "Prototype de la lampe Noir Minéral : abat-jour noir mat à l'intérieur clair en bois, pied sombre, assemblage métallique et câble textile bleu.",
  },
  {
    id: "porcelaine-acier-noir",
    index: "02",
    name: "Porcelaine & acier noir",
    materialsSummary: "Porcelaine · Acier anodisé noir",
    accent: "#26262b",
    accentOnDark: "#e2ddd2",
    shade: { label: "Porcelaine", color: "#e7e2d8" },
    // Teinte gris anthracite (au lieu du quasi-noir #1c1c1e). Seule la couleur
    // de base change ; le kind reste « metal » (metalness / roughness / reflets
    // / texture inchangés) → acier anodisé anthracite, aspect métallique conservé.
    assembly: { label: "Acier anodisé noir", color: "#3a3e44" },
    base: { label: "Béton clair", color: "#9d9a91" },
    // Noir profond : le tissage textile éclaircit légèrement la teinte de base
    // sous l'éclairage ; une base plus sombre garantit un câble clairement noir.
    cable: { label: "Câble noir", color: "#060608" },
    description:
      "Le grain minéral de la porcelaine contre la sècheresse du métal noir. Une lumière retenue, presque monacale.",
    image: "/images/variants/porcelaine-acier-noir.webp",
    alt: "Lampe Noir Minéral en porcelaine claire avec pièce d'assemblage en acier anodisé noir.",
  },
  {
    id: "brique-aluminium",
    index: "03",
    name: "Wasterial® - Brique & aluminium",
    materialsSummary: "Wasterial® - Brique · Aluminium",
    accent: "#a8371f",
    accentOnDark: "#d9663f",
    shade: { label: "Wasterial® - Brique", color: "#9c4a39" },
    assembly: { label: "Aluminium", color: "#c7c9cb" },
    base: { label: "Wasterial® - Brique", color: "#9c4a39" },
    cable: { label: "Câble noir", color: "#111113" },
    description:
      "La terre cuite chaude réveille l'aluminium froid. Une matière qui garde la mémoire du feu.",
    image: "/images/variants/brique-aluminium.webp",
    alt: "Lampe Noir Minéral en Wasterial® - Brique avec pièce d'assemblage en aluminium.",
  },
  {
    id: "verre-bouteille-inox",
    index: "04",
    name: "Wasterial® - Coquilles d'huître & Wasterial® - Verre de bouteille",
    materialsSummary: "Wasterial® - Coquilles d'huître · Inox",
    accent: "#47624b",
    accentOnDark: "#86a583",
    shade: { label: "Wasterial® - Coquilles d'huître", color: "#5e6440" },
    assembly: { label: "Inox", color: "#b7bab8" },
    base: { label: "Wasterial® - Verre de bouteille", color: "#2e3b2c" },
    cable: { label: "Câble noir", color: "#111113" },
    description:
      "Le vert profond du verre recyclé, poli comme un galet. L'inox y dépose un reflet net.",
    image: "/images/variants/verre-bouteille-inox.webp",
    alt: "Lampe Noir Minéral : abat-jour en Wasterial® - Coquilles d'huître, pied en Wasterial® - Verre de bouteille et pièce d'assemblage en inox.",
  },
  {
    id: "coquille-laiton",
    index: "05",
    name: "Wasterial® - Coquilles d'huîtres & laiton",
    materialsSummary: "Wasterial® - Coquilles d'huîtres · Laiton",
    accent: "#5e6440",
    accentOnDark: "#9aa06e",
    shade: { label: "Wasterial® - Coquilles d'huîtres", color: "#5e6440" },
    assembly: { label: "Laiton", color: "#b08a52" },
    base: { label: "Béton noir", color: "#1a1a1c" },
    cable: { label: "Câble bordeaux", color: "#6d2a2f" },
    description:
      "Un composite vert olive de coquilles d'huîtres broyées, mat et minéral, réchauffé par le laiton. Une matière recyclée, artisanale.",
    image: "/images/variants/coquille-laiton.webp",
    alt: "Lampe Noir Minéral : abat-jour en Wasterial® - Coquilles d'huîtres, pièce d'assemblage en laiton.",
  },
  {
    id: "verre-bleu-acier-anodise",
    index: "06",
    name: "Wasterial® - Billes de verre & acier anodisé",
    materialsSummary: "Wasterial® - Billes de verre · Acier anodisé",
    accent: "#45566f",
    accentOnDark: "#8ea3c4",
    shade: { label: "Wasterial® - Billes de verre", color: "#2b3a54" },
    // Acier anodisé teinté de la couleur des « Billes de verre » (#2b3a54).
    // Seule la couleur de base change ; le kind reste « metal » (metalness /
    // roughness / reflets inchangés) → aspect métallique conservé, teinte navy.
    assembly: { label: "Acier anodisé", color: "#2b3a54" },
    base: { label: "Wasterial® - Billes de verre", color: "#2b3a54" },
    // Câble teinté de la couleur des « Billes de verre » (#2b3a54). Seule la
    // couleur de base change ; le kind reste « fabric » (texture de tissage,
    // relief, roughness inchangés) → câble mat/souple réaliste, teinte navy.
    cable: { label: "Câble bleu", color: "#2b3a54" },
    description:
      "Un bleu de fumée, granuleux, traversé par la lumière. L'acier anodisé prolonge la fraîcheur.",
    image: "/images/variants/verre-bleu-acier-anodise.webp",
    alt: "Lampe Noir Minéral en Wasterial® - Billes de verre avec pièce d'assemblage en acier anodisé.",
  },
  {
    id: "porcelaine-epoxy-mat",
    index: "07",
    name: "Porcelaine & époxy mat",
    materialsSummary: "Porcelaine · Peinture époxy mate",
    accent: "#2a3fe6",
    accentOnDark: "#6f83ff",
    shade: { label: "Porcelaine", color: "#e7e2d8" },
    assembly: { label: "Époxy mat cobalt", color: "#2b4cd4" },
    base: { label: "Béton clair", color: "#9d9a91" },
    cable: { label: "Câble bleu", color: "#2f4fd0" },
    description:
      "La blancheur de la porcelaine ponctuée d'un cobalt franc. Le geste graphique d'un trait de couleur.",
    image: "/images/variants/porcelaine-epoxy-mat.webp",
    alt: "Lampe Noir Minéral en porcelaine claire avec pièce d'assemblage peinte en époxy mat cobalt.",
  },
];

export const defaultVariantId = variants[0].id;

export function getVariant(id: string | null | undefined): ProductVariant {
  return variants.find((v) => v.id === id) ?? variants[0];
}

/**
 * Vues éditoriales du prototype (photographies réelles fournies).
 * Utilisées dans le hero et la présentation sculpturale.
 */
export interface ProductShot {
  src: string;
  alt: string;
  /** Légende éditoriale courte. */
  caption: string;
}

export const prototypeShots: ProductShot[] = [
  {
    src: "/images/prototype/trois-quarts.webp",
    alt: "Vue de trois-quarts avant de la lampe Noir Minéral, abat-jour incliné, ampoule visible et câble bleu.",
    caption: "Trois-quarts",
  },
  {
    src: "/images/prototype/profil.webp",
    alt: "Vue de profil de la lampe Noir Minéral montrant l'inclinaison de l'abat-jour sur son pied.",
    caption: "Profil",
  },
  {
    src: "/images/prototype/assemblage.webp",
    alt: "Vue arrière de la lampe Noir Minéral révélant la pièce d'assemblage métallique perforée et la douille.",
    caption: "Assemblage",
  },
  {
    src: "/images/prototype/eclate.webp",
    alt: "Vue éclatée de la lampe Noir Minéral : abat-jour, grille métallique, douille, pied et câble bleu.",
    caption: "Vue éclatée",
  },
];

/** Les trois composants nommés, pour l'animation décomposée du hero. */
export const partOrder = ["shade", "assembly", "base"] as const;
export type PartKey = (typeof partOrder)[number];

export const partLabels: Record<PartKey, string> = {
  shade: "Abat-jour",
  assembly: "Assemblage",
  base: "Pied",
};

/**
 * Fiche technique. Toute valeur inconnue reste `null` et sera masquée
 * (« Information à venir »). NE PAS inventer de dimensions, poids, délais, etc.
 */
export interface SpecField {
  key: string;
  label: string;
  /** `null` = inconnu → masqué ou « Information à venir » selon le contexte. */
  value: string | null;
}

export const productSpecs: SpecField[] = [
  // Renseignés à partir des visuels fournis (observables) :
  { key: "type", label: "Type", value: "Lampe de table sculpturale" },
  { key: "assembly", label: "Structure", value: "Trois volumes assemblés (abat-jour, pièce métallique, pied)" },
  { key: "cable", label: "Câble", value: "Câble textile (couleur selon configuration)" },
  { key: "unique", label: "Fabrication", value: "Pièce d'atelier, assemblage manuel" },

  // TODO — à renseigner par l'atelier, ne pas inventer :
  { key: "dimensions", label: "Dimensions", value: null }, // TODO: H × Ø en cm
  { key: "light", label: "Source lumineuse", value: null }, // TODO: culot (ex. E27) + puissance conseillée
  { key: "power", label: "Alimentation", value: null }, // TODO: tension / interrupteur / prise
  { key: "weight", label: "Poids", value: null }, // TODO: poids en kg
  { key: "leadTime", label: "Délai", value: null }, // TODO: délai de fabrication
  { key: "availability", label: "Disponibilité", value: null }, // TODO: statut de disponibilité
];

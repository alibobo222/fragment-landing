/**
 * Données produit de la lampe Noir Minéral.
 *
 * Source visuelle : photographies du prototype + planche de personnalisation
 * fournies par l'atelier (voir /public/images). Aucune caractéristique n'est
 * inventée : les champs techniques inconnus (fiche technique, voir
 * `data/specs.ts`) restent `null` avec un commentaire TODO.
 *
 * La lampe se compose de trois volumes distincts, ce qui rend chaque
 * combinaison lisible dans l'animation du hero et le configurateur :
 *   1. shade    — l'abat-jour incliné (le grand volume)
 *   2. assembly — la pièce d'assemblage métallique (grille pliée + douille)
 *   3. base     — le pied cylindrique
 * + un câble textile.
 */

/**
 * Type de matière RÉELLE, qui pilote le rendu 3D (profils PBR, textures et
 * transmission lumineuse — voir `PROFILES` dans `lib/lampTextures.ts`).
 *
 * Source de vérité du champ `PartFinish.material` : les valeurs ci-dessous
 * correspondent exactement aux clés de `PROFILES`. Défini ici plutôt que dans
 * `lib/lampTextures.ts` parce que `data/product.ts` est la source de vérité
 * des matières (voir CLAUDE.md) — `lib/lampTextures.ts` réexporte ce type.
 */
export type MaterialKind =
  | "porcelain"
  | "concrete"
  | "brick"
  | "shell"
  | "glassBottle"
  | "glassBlue"
  | "blueGlass"
  | "blueTerrazzo"
  | "epoxy"
  | "metal"
  | "fabric"
  | "blackConcrete"
  | "matte"
  | "travertine"
  | "corten"
  | "rustedMetal";

export interface PartFinish {
  /** Matière/finition affichée à l'utilisateur. */
  label: string;
  /** Couleur représentative pour les pastilles et l'animation (token CSS). */
  color: string;
  /**
   * Matière RÉELLE de la pièce, donnée explicite qui pilote le rendu 3D.
   * Remplace l'ancienne détection par expression régulière sur `label` :
   * renommer `label` n'a plus aucun effet sur le rendu, contrairement à
   * l'ancien comportement (silencieux) qui retombait sur `matte`.
   */
  material: MaterialKind;
  /**
   * Image RÉELLE de la matière (photographie), pour la vignette du nuancier
   * (`ColorSwatch` dans le configurateur). Indépendant de `material` : deux
   * pièces peuvent partager le même `MaterialKind` pour le rendu 3D sans
   * partager la même vignette — le catalogue photo ne couvre encore qu'une
   * partie des matières (voir PHASE B, `TASKS.md`). Absent → la vignette
   * retombe sur un aplat de `color`.
   */
  textureImage?: string;
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
  /**
   * Finition de la FACE INTÉRIEURE de l'abat-jour, quand elle diffère de
   * l'extérieur (prototype 01 : placage de bois brûlé révélé à l'ouverture).
   * Absente sur les configurations dont l'abat-jour est de la même matière
   * dedans et dehors — c'est ce champ, et non un identifiant en dur, qui
   * décide du placage dans les scènes 3D.
   */
  shadeInner?: PartFinish;
  assembly: PartFinish;
  /**
   * Finition de la DOUILLE quand elle diffère de la pièce d'assemblage.
   * Absente sur les configurations où les deux pièces partagent la même
   * matière — c'est ce champ, et non un identifiant en dur, qui décide.
   */
  socket?: PartFinish;
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
    name: "Graphite",
    materialsSummary: "Wasterial® - Coquilles de moules · Acier brut · Câble textile bleu",
    // Accent : le bleu franc du câble textile, signature de la pièce d'origine.
    accent: "#2a3fe6",
    accentOnDark: "#6f83ff",
    shade: {
      label: "Wasterial® - Coquilles de moules",
      color: "#1a1a1c",
      material: "blackConcrete",
      textureImage: "/textures/swatch/westerial-coquilles-moules.webp",
    },
    // Intérieur de l'abat-jour : placage de bois brûlé (image réelle,
    // /public/textures). Couleur de repli = moyenne mesurée sur l'image.
    shadeInner: {
      label: "Plaquage bois brûlé",
      color: "#817f77",
      material: "matte",
      textureImage: "/textures/swatch/bois-brule.webp",
    },
    assembly: { label: "Acier brut", color: "#b7bab8", material: "metal" },
    base: {
      label: "Wasterial® - Coquilles de moules",
      color: "#1a1a1c",
      material: "blackConcrete",
      textureImage: "/textures/swatch/westerial-coquilles-moules.webp",
    },
    // Bleu Klein (International Klein Blue, outremer profond). Seule la couleur
    // de base change ; le kind reste « fabric » (texture de tissage inchangée).
    cable: { label: "Textile bleu roi", color: "#002FA7", material: "fabric" },
    description:
      "Le prototype d'origine : un noir brut et mat, l'âme claire du bois révélée à l'ouverture, ponctuée du bleu franc du câble textile.",
    image: "/images/prototype/trois-quarts.webp",
    alt: "Prototype de la lampe Noir Minéral : abat-jour noir mat à l'intérieur clair en bois, pied sombre, assemblage métallique et câble textile bleu.",
  },
  {
    id: "porcelaine-acier-noir",
    index: "02",
    name: "Craie",
    materialsSummary: "Porcelaine · Acier anodisé noir",
    accent: "#26262b",
    accentOnDark: "#e2ddd2",
    shade: { label: "Wasterial® - Porcelaine", color: "#e7e2d8", material: "porcelain" },
    // Intérieur de l'abat-jour : porcelaine nue par défaut (même matière que
    // l'extérieur), avec la photo réelle Renature appliquée par-dessus en
    // baseColor uniquement (voir applyInteriorVeneer, lib/lampTextures.ts).
    shadeInner: {
      label: "Biomatériau Renature®",
      color: "#1c2028",
      material: "matte",
      textureImage: "/textures/swatch/renature.webp",
    },
    // Teinte gris anthracite (au lieu du quasi-noir #1c1c1e). Seule la couleur
    // de base change ; le kind reste « metal » (metalness / roughness / reflets
    // / texture inchangés) → acier anodisé anthracite, aspect métallique conservé.
    assembly: { label: "Acier anodisé noir", color: "#3a3e44", material: "metal" },
    // Pied : travertin beige, depuis la photo réelle
    // /public/textures/travertin.png.
    base: {
      label: "Wasterial® - Travertin beige",
      color: "#b3a893",
      material: "travertine",
      textureImage: "/textures/swatch/travertin.webp",
    },
    // Noir profond : le tissage textile éclaircit légèrement la teinte de base
    // sous l'éclairage ; une base plus sombre garantit un câble clairement noir.
    cable: { label: "Textile noir", color: "#060608", material: "fabric" },
    description:
      "Le grain minéral de la porcelaine contre la sècheresse du métal noir. Une lumière retenue, presque monacale.",
    image: "/images/variants/porcelaine-acier-noir.webp",
    alt: "Lampe Noir Minéral en porcelaine claire avec pièce d'assemblage en acier anodisé noir.",
  },
  {
    id: "brique-aluminium",
    index: "03",
    name: "Terracotta",
    materialsSummary: "Wasterial® - Coquilles de moules · Acier corten",
    accent: "#a8371f",
    accentOnDark: "#d9663f",
    // Abat-jour : Wasterial® - Coquilles de moules (seule cette pièce — le
    // pied garde la brique, voir `base` plus bas ; ce sont deux PartFinish
    // distincts, pas un texturage partagé comme avant). Confirmé explicitement
    // après un premier revers faute de citation retrouvée dans l'historique.
    shade: {
      label: "Wasterial® - Coquilles de moules",
      color: "#1a1a1c",
      material: "blackConcrete",
      textureImage: "/textures/swatch/westerial-coquilles-moules.webp",
    },
    // Couleur mesurée : moyenne RVB de tole-acier-corten.jpg (#a4530c), pas
    // devinée à l'œil.
    assembly: {
      label: "Acier corten",
      color: "#a4530c",
      material: "corten",
      textureImage: "/textures/swatch/tole-acier-corten.webp",
    },
    // Douille : distincte de l'assemblage (voir finishFor, data/lampModel.ts)
    // — aluminium oxydé, photo réelle. Couleur mesurée : moyenne RVB de
    // "Douille métal rouille.png" (#402f29), pas devinée à l'œil.
    socket: {
      label: "Aluminium rouillé",
      color: "#402f29",
      material: "rustedMetal",
      textureImage: "/textures/swatch/douille-metal-rouille.webp",
    },
    base: {
      label: "Wasterial® - Brique",
      color: "#9c4a39",
      material: "brick",
      textureImage: "/textures/swatch/brique.webp",
    },
    // Couleur mesurée sur "cable textile orange.jpg" : médiane RVB des pixels
    // du câble UNIQUEMENT, fond blanc de la photo exclu (~17 % de l'image) —
    // la moyenne brute sur l'image entière tirait la couleur vers le pâle
    // (#d67f5e, erroné, corrigé ici).
    cable: { label: "Câble textile orange", color: "#d0511a", material: "fabric" },
    description:
      "La terre cuite chaude réveille l'aluminium froid. Une matière qui garde la mémoire du feu.",
    image: "/images/variants/brique-aluminium.webp",
    alt: "Lampe Noir Minéral : abat-jour en Wasterial® - Coquilles de moules, pied en Wasterial® - Brique et pièce d'assemblage en acier corten.",
  },
  {
    id: "verre-bouteille-inox",
    index: "04",
    name: "Mousse",
    materialsSummary: "Wasterial® - Coquilles d'huîtres · Inox",
    accent: "#47624b",
    accentOnDark: "#86a583",
    shade: {
      label: "Wasterial® - Coquilles d'huîtres",
      color: "#5e6440",
      material: "shell",
      textureImage: "/textures/swatch/coquilles-huitres.webp",
    },
    assembly: { label: "Inox", color: "#b7bab8", material: "metal" },
    base: {
      label: "Wasterial® - Verre de bouteille",
      color: "#2e3b2c",
      material: "glassBottle",
      textureImage: "/textures/swatch/verre-bouteille.webp",
    },
    cable: { label: "Câble textile vert sauge", color: "#5C6B4A", material: "fabric" },
    description:
      "Le vert profond du verre recyclé, poli comme un galet. L'inox y dépose un reflet net.",
    image: "/images/variants/verre-bouteille-inox.webp",
    alt: "Lampe Noir Minéral : abat-jour en Wasterial® - Coquilles d'huîtres, pied en Wasterial® - Verre de bouteille et pièce d'assemblage en inox.",
  },
  {
    id: "coquille-laiton",
    index: "05",
    name: "Lichen",
    materialsSummary: "Wasterial® - Coquilles d'huîtres · Laiton",
    accent: "#5e6440",
    accentOnDark: "#9aa06e",
    shade: {
      label: "Wasterial® - Coquilles d'huîtres",
      color: "#5e6440",
      material: "shell",
      textureImage: "/textures/swatch/coquilles-huitres.webp",
    },
    assembly: { label: "Laiton", color: "#b08a52", material: "metal" },
    base: { label: "Béton noir", color: "#1a1a1c", material: "blackConcrete" },
    cable: { label: "Câble textile bordeaux", color: "#6d2a2f", material: "fabric" },
    description:
      "Un composite vert olive de coquilles d'huîtres broyées, mat et minéral, réchauffé par le laiton. Une matière recyclée, artisanale.",
    image: "/images/variants/coquille-laiton.webp",
    alt: "Lampe Noir Minéral : abat-jour en Wasterial® - Coquilles d'huîtres, pièce d'assemblage en laiton.",
  },
  {
    id: "verre-bleu-acier-anodise",
    index: "06",
    name: "Ardoise",
    materialsSummary: "Wasterial® - Billes de verre · Acier anodisé",
    accent: "#45566f",
    accentOnDark: "#8ea3c4",
    shade: {
      label: "Wasterial® - Billes de verre",
      color: "#2b3a54",
      material: "blueGlass",
      textureImage: "/textures/swatch/verre-bleu.webp",
    },
    // Acier anodisé teinté de la couleur des « Billes de verre » (#2b3a54).
    // Seule la couleur de base change ; le kind reste « metal » (metalness /
    // roughness / reflets inchangés) → aspect métallique conservé, teinte navy.
    assembly: { label: "Acier anodisé", color: "#2b3a54", material: "metal" },
    base: {
      label: "Wasterial® - Billes de verre",
      color: "#2b3a54",
      material: "blueGlass",
      textureImage: "/textures/swatch/verre-bleu.webp",
    },
    // Câble teinté de la couleur des « Billes de verre » (#2b3a54). Seule la
    // couleur de base change ; le kind reste « fabric » (texture de tissage,
    // relief, roughness inchangés) → câble mat/souple réaliste, teinte navy.
    cable: { label: "Câble textile bleu", color: "#2b3a54", material: "fabric" },
    description:
      "Un bleu de fumée, granuleux, traversé par la lumière. L'acier anodisé prolonge la fraîcheur.",
    image: "/images/variants/verre-bleu-acier-anodise.webp",
    alt: "Lampe Noir Minéral en Wasterial® - Billes de verre avec pièce d'assemblage en acier anodisé.",
  },
];

/**
 * PERFORATION de la pièce d'assemblage — option de configuration à part entière.
 *
 * Déclarée ici, avec les variantes, et non dans le composant 3D : c'est une
 * caractéristique du produit, au même titre qu'une matière. Elle peut donc être
 * lue ailleurs (fiche, résumé, formulaire de contact) sans dépendre du viewer.
 */
export type PerforationShape = "round" | "square" | "none";

export const perforationOptions: {
  value: PerforationShape;
  /** Libellé court affiché dans le contrôle. */
  label: string;
}[] = [
  { value: "round", label: "Ronde" },
  { value: "square", label: "Carrée" },
  { value: "none", label: "Aucune" },
];

export const defaultPerforation: PerforationShape = "square";

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
    alt: "Vue de trois-quarts avant de la lampe Noir Minéral, abat-jour incliné, ampoule visible et câble textile bleu.",
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
    alt: "Vue éclatée de la lampe Noir Minéral : abat-jour, grille métallique, douille, pied et câble textile bleu.",
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

// La fiche technique (SpecField, productSpecs) vit dans data/specs.ts, un
// fichier séparé : elle décrit le produit pour l'acheteur, n'a aucun effet
// sur le rendu 3D, et ne doit donc pas invalider le garde-fou des vignettes
// packshot (voir data/specs.ts pour le détail du problème résolu).

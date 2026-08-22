/**
 * Fiche technique de la lampe Noir Minéral.
 *
 * Sujet distinct de `data/product.ts` : les `variants` de `product.ts`
 * pilotent le rendu 3D (matières, couleurs, textures), alors que cette fiche
 * décrit le produit pour l'acheteur et n'a AUCUN effet sur l'image. Les deux
 * fichiers vivaient ensemble avant que ce couplage produise un faux positif
 * dans le garde-fou des vignettes packshot : celui-ci hache `data/product.ts`
 * en entier (voir `scripts/packshot-manifest.mjs`), donc un simple changement
 * de texte ici périmait les vignettes sans qu'aucun pixel n'ait bougé. Séparer
 * les deux fichiers résout le problème à la source plutôt que d'apprendre au
 * hachage à distinguer les champs qui comptent — voir `tests/packshot-manifest.test.ts`.
 *
 * Toute valeur inconnue reste `null` et sera masquée (« Information à venir »).
 * NE PAS inventer de dimensions, poids, délais, etc.
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
  { key: "cable", label: "Câble textile", value: "Gaine tissée (couleur selon configuration)" },
  { key: "unique", label: "Fabrication", value: "Pièce d'atelier, assemblage manuel" },

  // TODO — à renseigner par l'atelier, ne pas inventer :
  { key: "dimensions", label: "Dimensions", value: null }, // TODO: H × Ø en cm
  { key: "light", label: "Source lumineuse", value: null }, // TODO: culot (ex. E27) + puissance conseillée
  { key: "power", label: "Alimentation", value: null }, // TODO: tension / interrupteur / prise
  { key: "weight", label: "Poids", value: null }, // TODO: poids en kg
  { key: "leadTime", label: "Délai", value: null }, // TODO: délai de fabrication
  { key: "availability", label: "Disponibilité", value: null }, // TODO: statut de disponibilité
];

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
 *
 * Une valeur MESURÉE sur une source du projet n'est pas une invention : les
 * dimensions viennent de la boîte englobante du GLB issu de la CAO, et le
 * commentaire qui les accompagne dit d'où elles sortent et ce qui les
 * remplacera. Une valeur SUPPOSÉE, elle, reste interdite.
 */
export interface SpecField {
  key: string;
  label: string;
  /** `null` = inconnu → masqué ou « Information à venir » selon le contexte. */
  value: string | null;
  /**
   * `true` = la donnée est demandée à l'atelier et n'est pas encore revenue.
   * La ligne s'affiche alors avec la mention d'attente, au lieu d'être masquée.
   * N'autorise toujours AUCUNE valeur inventée : `value` reste `null`.
   */
  pending?: boolean;
}

export const productSpecs: SpecField[] = [
  // Renseignés à partir des visuels fournis (observables) :
  { key: "type", label: "Type", value: "Lampe de table sculpturale" },
  { key: "assembly", label: "Structure", value: "Trois volumes assemblés (abat-jour, pièce métallique, pied)" },
  { key: "cable", label: "Câble textile", value: "Gaine tissée (couleur selon configuration)" },
  { key: "unique", label: "Fabrication", value: "Pièce d'atelier, assemblage manuel" },

  // TODO — à renseigner par l'atelier, ne pas inventer :
  // Mesuré sur public/models/lampe-optimisee.glb (boîte englobante, câble
  // exclu — déployé, il porte la largeur à 50,9 cm et ne décrit plus l'objet).
  // Le résultat est stable qu'on retire ou non l'ampoule, intérieure à
  // l'abat-jour : H 20,4 × l 21,8 × P 16,0 cm, arrondi au centimètre.
  //
  // Ce chiffre vient de la CAO, pas d'un mètre posé sur l'objet fini : à
  // remplacer par la mesure de l'atelier dès qu'elle est disponible.
  { key: "dimensions", label: "Dimensions", value: "H 20 × l 22 × P 16 cm (hors câble)" },
  {
    key: "light",
    label: "Source lumineuse",
    value: "Culot E27 — ampoule recommandée à 4 000 K",
  }, // TODO: puissance en watts (culot et température de couleur déjà connus)
  { key: "power", label: "Alimentation", value: null }, // TODO: tension / interrupteur / prise
  { key: "weight", label: "Poids", value: null, pending: true }, // TODO: poids en kg
  // Volontairement laissé vide : aucun délai de fabrication n'est communiqué
  // au public — ne pas « compléter » ce champ par zèle.
  { key: "leadTime", label: "Délai", value: null },
  { key: "availability", label: "Disponibilité", value: "Sur commande" },
];

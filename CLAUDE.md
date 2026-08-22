# CLAUDE.md — contexte projet pour Claude Code

Ce fichier est lu automatiquement par Claude Code au démarrage. Il décrit le
projet, ses règles non négociables et ses commandes. Le plan de travail ordonné
se trouve dans `TASKS.md`.

---

## Le projet

Site vitrine d'un objet de design : **FRAGMENT**, lampe de table sculpturale
réalisée en matières recyclées (gamme Wasterial®, partenaire ETNISI). Ce n'est
**pas** un site e-commerce : aucun prix, aucun panier, aucune notion d'achat. Le
parcours est éditorial — Découvrir → Comprendre → Explorer → Contacter — et se
termine par une invitation à échanger.

Pensé mobile d'abord, centré sur desktop. Esthétique brutaliste sobre : fond
blanc, typographie Overused Grotesk, pas de cartes, pas d'ombres portées
décoratives.

## Pile technique

Next.js 15 (App Router) en **export 100 % statique** (`output: "export"`),
React 19, Tailwind CSS 4, framer-motion 11, three.js 0.185 via
@react-three/fiber 9 et @react-three/drei 10. TypeScript strict. Tests avec
Vitest et Testing Library. Déploiement GitHub Pages via GitHub Actions.

## Commandes

```bash
npm run dev         # serveur de développement
npm run build       # export statique dans out/
npm run preview     # sert out/ localement
npm run lint        # eslint (next/core-web-vitals)
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run cad         # convertit cad-sources/*.IGS → public/models/*.glb
npm run assets      # prépare les images (sharp)
```

**Avant chaque commit : `npm run typecheck && npm run lint && npm run test`.**

## Carte du code

```
app/                  layout, page unique, globals.css (tokens + utilitaires)
components/
  SelectionProvider   source de vérité unique : variante choisie, lampe
                      allumée/éteinte, température de lumière
  hero/Lamp3D         scène 3D assemblée (configurateur)
  hero/ExplodedLamp3D scène 3D éclatée pilotée par le scroll
  lamp/LampStage      enveloppe réutilisable : repli photo → 3D, contrôles
  chapters/           chapitres éditoriaux (projet, matières, vue éclatée)
  configurator/       catalogue des 6 configurations
  ui/                 SectionHeading, Reveal, motion
data/product.ts       LES VARIANTES — données produit, source de vérité du rendu 3D
data/specs.ts         fiche technique (productSpecs) — sans effet sur le rendu 3D
data/lampModel.ts     mapping meshes GLB ↔ rôles, config d'éclairage
lib/lampTextures.ts   profils matières, shaders triplanar, textures procédurales
public/models/        lampe-optimisee.glb (issu de la CAO)
public/textures/      textures matières réelles
scripts/              conversion CAO, préparation des assets
```

## Règles non négociables

**Ne jamais inventer de donnée produit.** Dimensions, poids, source lumineuse,
alimentation, délai, disponibilité : les champs inconnus restent `null` dans
`productSpecs` (`data/specs.ts`) avec leur commentaire `TODO`. Aucune
certification, aucune origine, aucun chiffre qui ne vienne pas de l'atelier.

**Un seul contexte WebGL vivant à la fois.** Les canvas se montent et se
démontent via `IntersectionObserver`. Le hero, le configurateur et la vue
éclatée ne doivent jamais afficher deux canvas simultanément. Toute
modification qui pourrait faire coexister deux `<Canvas>` est à refuser.

**Le bruit procédural de `lib/lampTextures.ts` est SEMÉ, jamais `Math.random()`.**
Chaque générateur (marbrures, mouchetures, tissage…) tire d'un
`createSeededRandom(GRAIN_SEED + n)` propre à sa texture : à graine identique,
deux exécutions produisent des vignettes octet pour octet identiques.
Réintroduire un `Math.random()` ici rendrait toute détection automatique de
vignettes périmées aveugle — incapable de distinguer un vrai changement de
rendu du bruit de génération.

**Export statique.** Aucune route API, aucun Server Action, aucun
`next/image` optimisé côté serveur, aucune dépendance à un runtime Node en
production. Toute route ajoutée pour le développement (par exemple une route de
pré-rendu) doit être exclue de l'export.

**Le seul serveur du projet est la fonction Edge Supabase `contact`**, qui vit
hors du build Next (`supabase/functions/contact`). Le formulaire l'appelle en
`fetch` ; elle enregistre la demande dans `contact_leads` puis notifie l'atelier
via Resend. La validation est écrite une seule fois, dans
`supabase/functions/_shared/lead.ts`, et `lib/validation.ts` la ré-exporte pour
le front : ne jamais dupliquer ces règles. Aucune clé Supabase ni Resend ne doit
apparaître côté client — la seule valeur publique est l'URL de la fonction,
`NEXT_PUBLIC_CONTACT_ENDPOINT`. La table `contact_leads` est en RLS **sans
aucune policy** : toute policy ajoutée rouvrirait un accès au navigateur, c'est
à refuser. Détail complet dans `README.md`, section 14.

**`data/product.ts` est la source de vérité** des matières et des
configurations. Le rendu 3D, les vignettes, les pastilles et les textes doivent
en dériver — jamais l'inverse.

**Accessibilité.** Chaque section porte un `aria-labelledby`. Les contrôles
gardent un nom accessible et un focus clavier visible. Les changements d'état
importants sont annoncés (`aria-live`). `prefers-reduced-motion` est respecté
partout : chaque animation a son chemin réduit.

**Langue.** Interface, commentaires de code et messages de commit en français.
Les commentaires expliquent le *pourquoi*, pas le *quoi* — c'est déjà la
convention du projet, la conserver.

## Conventions de travail

Une tâche de `TASKS.md` = un commit. Message au format Conventional Commits en
français : `feat(configurateur): épingle le viewport pendant la sélection`.

Ne pas élargir le périmètre d'une tâche. Si une amélioration adjacente apparaît
en cours de route, la noter en fin de `TASKS.md` sous « Découvert en chemin »
plutôt que de l'implémenter.

Les tâches sont ordonnées par dépendance. Ne pas sauter la phase 2 avant la
phase 3 : le pré-rendu des vignettes dépend du refactor des matières.

## Pièges connus

`SectionHeading` est `sticky top-14 z-20` avec un fond blanc opaque. Tout
élément qu'on veut épingler dans une section passe *sous* lui. Mesurer sa
hauteur réelle (le patron existe dans `ExplodedLampSection`, variable
`badgeTop`) ou désactiver son épinglage pour la section concernée.

Les matières sont aujourd'hui identifiées par expression régulière sur un
libellé français, dans plusieurs fichiers, avec un ordre de test qui compte
(« coquilles de moules » avant « coquille », « billes de verre » avant
« verre »). **Renommer un libellé dans `data/product.ts` casse le rendu 3D
silencieusement** — la matière retombe sur le profil `matte` sans erreur. La
tâche 2.1 supprime ce piège ; avant qu'elle soit faite, ne renommer aucun
libellé de matière.

Le GLB issu de la CAO n'a **pas de coordonnées UV** : les matières passent par
un grain triplanar en espace objet injecté dans le shader
(`createGrainMaterial`, `onBeforeCompile`). Ne pas supposer l'existence d'UV.

Les géométries proviennent du GLTF mis en cache par drei et sont **partagées**
entre les scènes : ne jamais les `dispose()`. Les matériaux, eux, sont créés par
scène et doivent être libérés.

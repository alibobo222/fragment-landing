# TASKS.md — plan de travail ordonné

Issu de la revue du 10 août 2026. Les tâches sont **ordonnées par dépendance** :
chacune suppose les précédentes faites. Chaque tâche est autonome et se termine
par un commit qui laisse le site fonctionnel.

---

## Mode d'emploi

### Une fois, au début

```bash
cd "C:\Users\bonna\OneDrive\Bureau\CLAUDE CODE\etnisi-site"
git add -A && git commit -m "chore: point de sauvegarde avant plan d'améliorations"
claude
```

`CLAUDE.md`, à la racine, est lu automatiquement : Claude Code connaît déjà
l'architecture, les règles et les pièges du projet. Inutile de les répéter.

### Pour chaque tâche

Ouvre une session et colle exactement ceci, en remplaçant le numéro :

> Lis `TASKS.md` et exécute **uniquement** la tâche **1.2**. Respecte son
> périmètre : n'implémente rien qui n'y figure pas. Quand c'est fait, lance
> `npm run typecheck && npm run lint && npm run test`, montre-moi le diff, et
> attends ma validation avant de commiter.

Puis, une fois le diff relu et le rendu vérifié dans le navigateur :

> Commite avec le message indiqué dans la tâche.

Une tâche = une session = un commit. Si une session dérive ou s'allonge,
`/clear` et reprends la tâche à zéro : c'est moins coûteux que de corriger.

### Pour les tâches à jugement visuel

Les tâches marquées **👁 à valider à l'œil** ne peuvent pas être jugées par des
tests. Lance `npm run dev`, ouvre le site sur un vrai téléphone si possible
(`npm run dev -- --hostname 0.0.0.0`, puis l'IP de ta machine depuis le
mobile), et vérifie toi-même avant de valider.

### Si une tâche tourne mal

Rien n'est commité tant que tu n'as pas validé. `git restore .` annule tout.
Si Claude Code propose d'élargir le périmètre, refuse et demande-lui d'ajouter
sa remarque à la section « Découvert en chemin » en fin de fichier.

### Suivi

Coche les cases au fur et à mesure. Claude Code peut le faire lui-même à la fin
de chaque tâche si tu le lui demandes dans le message de validation.

---

# PHASE 0 — Sécuriser le terrain

Rien ici ne touche au site. Objectif : que tout le travail qui suit soit
récupérable et vérifié automatiquement. Une heure au total.

## ☐ 0.1 — Sortir le projet de OneDrive (manuel, sans Claude Code)

**Pourquoi.** Le dépôt vit dans `OneDrive\Bureau\CLAUDE CODE\etnisi-site`. La
combinaison OneDrive + `node_modules` + `.git` provoque des verrous de fichiers,
des synchronisations partielles et, dans les mauvais cas, un dépôt git corrompu.
Elle ralentit aussi nettement les builds.

**Comment.** Commite tout d'abord. Puis, dans un terminal :

```bash
git status                      # doit être propre
cd "C:\Users\bonna\OneDrive\Bureau\CLAUDE CODE"
robocopy etnisi-site C:\dev\etnisi-site /E /XD node_modules .next
cd C:\dev\etnisi-site
npm ci
npm run build                   # doit passer
```

Vérifie que `git log` et `git remote -v` sont intacts, puis supprime l'ancien
dossier. Git et GitHub assurent désormais la sauvegarde, plus OneDrive.

**Si tu préfères rester dans OneDrive**, exclus au minimum `node_modules` et
`.next` de la synchronisation dans les paramètres OneDrive.

---

## ☑ 0.2 — Fins de ligne : stopper le bruit sur les fichiers CAO

**Pourquoi.** `cad-sources/lampe2a.IGS`, `2b` et `2c` apparaissent comme
modifiés alors que personne n'y a touché : c'est de la conversion CRLF/LF
automatique. Ce bruit masque les vraies modifications dans `git status`.

**Fichiers.** Créer `.gitattributes` à la racine.

**Contenu attendu.**

```gitattributes
* text=auto eol=lf
*.IGS -text
*.glb -text
*.woff2 -text
*.png -text
*.jpg -text
*.webp -text
```

**Ensuite, une fois par dépôt :**

```bash
git add --renormalize .
git status        # les .IGS ne doivent plus apparaître comme modifiés
```

**Critère d'acceptation.** `git status` propre après un `npm run build`.

**Commit.** `chore(git): normalise les fins de ligne et marque les binaires`

---

## ☑ 0.3 — La CI doit vérifier avant de déployer

**Pourquoi.** `.github/workflows/deploy.yml` enchaîne `npm ci` puis
`npm run build` et publie. Les scripts `lint`, `typecheck` et `test` existent
mais ne tournent jamais : une régression de type ou un test cassé part en
production sans que rien ne l'arrête.

**Fichiers.** `.github/workflows/deploy.yml`.

**Ce qu'il faut faire.** Insérer trois étapes entre `npm ci` et
`npm run build` : `npm run typecheck`, `npm run lint`, `npm run test`. Ne pas
toucher au calcul de `PAGES_BASE_PATH` ni aux étapes de déploiement.

**Critère d'acceptation.** Le workflow échoue si un test échoue, et le
déploiement n'a pas lieu.

**Vérification.** Casser volontairement un test en local, pousser sur une
branche, constater l'échec, corriger.

**Commit.** `ci: vérifie types, lint et tests avant le déploiement`

---

# PHASE 1 — Rendre le changement de matière visible

Le cœur du sujet. À la fin de cette phase, choisir une configuration produit un
effet immédiatement perceptible — à l'œil et au lecteur d'écran.

**Le problème, en une phrase.** Dans `Configurator.tsx`, la première ligne du
catalogue se trouve à ~590 px sous le bas du viewport 3D sur un téléphone (les
lignes 4 à 7, 250 à 600 px plus bas encore) : au moment du tap, la lampe est
hors écran, et le fondu-enchaîné de `LampStage` se joue dans le vide.

## ☑ 1.1 — Rendre l'épinglage du titre de section optionnel

**Pourquoi.** `SectionHeading` est `sticky top-14 z-20` avec un fond blanc
opaque. Il occupe environ 110 px en haut de l'écran pendant toute la traversée
d'une section. Pour épingler le viewport 3D dans le configurateur (tâche 1.2),
il faut soit passer dessous, soit libérer la place. Dans un chapitre dont la 3D
est le sujet, libérer la place est le bon choix — et ça rend 110 px d'écran.

**Fichiers.** `components/ui/SectionHeading.tsx`, et les appelants uniquement
pour la nouvelle prop.

**Ce qu'il faut faire.** Ajouter une prop `sticky?: boolean` valant `true` par
défaut, pour ne rien changer aux sections existantes. Quand elle vaut `false`,
le conteneur perd `sticky top-14 z-20` et défile normalement. Conserver le
commentaire d'avertissement existant sur le placement en enfant direct de
`<section>`.

**Périmètre.** Cette tâche n'appelle la nouvelle prop nulle part : elle prépare
seulement le terrain. Aucun changement visuel attendu.

**Critère d'acceptation.** Aucune différence visuelle sur le site.
`npm run typecheck` passe.

**Commit.** `refactor(ui): rend l'épinglage de SectionHeading optionnel`

---

## ☑ 1.2 — Viewport 3D épinglé + sélecteur horizontal 👁 à valider à l'œil

**La tâche principale du plan.**

**Fichiers.** `components/configurator/Configurator.tsx` principalement.
Éventuellement un nouveau `components/configurator/VariantChip.tsx`.

**Ce qu'il faut faire.**

Passer `sticky={false}` au `SectionHeading` de la section configurateur.

Regrouper dans un conteneur `sticky top-14 z-10` à fond blanc : le `LampStage`
en format compact — `h-[42svh]` au lieu de `aspect-square w-full`, pour laisser
environ 300 px de contenu défilant visible en dessous sur un écran de 740 px —
suivi immédiatement d'une rangée horizontale des 7 configurations à défilement
« snap ».

La rangée : `flex snap-x snap-mandatory gap-3 overflow-x-auto`, barre de
défilement masquée, vignettes de 64 px, chacune un `<label>` contenant un
`<input type="radio" className="peer sr-only">` comme le catalogue vertical
actuel. La vignette active reprend la barre d'accent existante (`u-accent-bg`).
Le conteneur porte `role="radiogroup"` et un `aria-label`. Quand la sélection
change par un autre chemin, la vignette active se recentre
(`scrollIntoView({ inline: "center", block: "nearest" })`), sans jamais faire
défiler la page verticalement.

Le catalogue vertical détaillé reste en dessous, inchangé dans son contenu : il
devient le mode « lecture des compositions », plus le seul point d'entrée. Les
deux sélecteurs pilotent le même `selectedId` du `SelectionProvider`.

Vérifier que le cadrage caméra actuel (`camera={[0.12, 0.14, 0.5]}`, `fov={30}`)
tient dans un format non carré ; ajuster si la lampe est rognée.

**Contraintes.** Ne pas dupliquer l'état : le `SelectionProvider` reste l'unique
source de vérité. Ne pas ajouter de second `<Canvas>`. Le `LampStage` épinglé
reste monté en continu pendant la section, ce qui est voulu — vérifier que
l'`IntersectionObserver` de `LampStage` le garde bien actif.

**Critères d'acceptation.**

Sur un écran de 390 × 740, quand on tape n'importe laquelle des 7
configurations dans la rangée horizontale, la lampe est visible et le
fondu-enchaîné se voit. Le catalogue vertical fonctionne toujours et met à jour
la rangée horizontale, et réciproquement. Le défilement vertical de la page
n'est jamais bloqué par la rangée horizontale. Rien ne casse en desktop.

**Vérification.** `npm run dev`, test au doigt sur téléphone. Puis
`npm run test` (les tests de sélection existants doivent toujours passer).

**Commit.** `feat(configurateur): épingle le viewport 3D et ajoute un sélecteur rapide`

---

## ☐ 1.3 — Retour visuel et sonore du changement de matière

**Pourquoi.** Une fois le viewport visible, le fondu-enchaîné reste discret
(0,6 s, opacité 0,72 → 1). Et un utilisateur de lecteur d'écran n'a
aujourd'hui **aucun** retour : la sélection ne produit aucune annonce.

**Fichiers.** `components/configurator/Configurator.tsx`,
`components/SelectionProvider.tsx` si besoin de mémoriser la variante
précédente.

**Ce qu'il faut faire.**

Comparer l'ancienne et la nouvelle configuration pièce par pièce, et ne mettre
en évidence que les `MaterialRow` **réellement** changées : un halo d'accent de
400 ms sur la pastille concernée. Si le pied et le câble changent mais pas
l'abat-jour, seuls le pied et le câble réagissent — c'est ce détail qui rend le
changement lisible.

Ajouter une région `aria-live="polite"` visuellement masquée qui annonce, à
chaque sélection : « Configuration 03 sur 7, Wasterial® Brique et aluminium ».

Respecter `prefers-reduced-motion` : pas de halo, l'annonce reste.

**Critères d'acceptation.** Le halo ne se déclenche que sur les pièces
modifiées. L'annonce est lue par le lecteur d'écran (VoiceOver ou NVDA) sans
voler le focus. Aucun halo en mouvement réduit.

**Commit.** `feat(configurateur): met en évidence les matières modifiées et annonce la sélection`

---

## ☑ 1.4 — Focus clavier visible sur les catalogues

**Pourquoi.** Les `<input type="radio">` sont en `sr-only` dans le `<label>`.
Le focus clavier va donc sur un élément invisible, et la règle `:focus-visible`
globale de `globals.css` n'a rien à peindre : **on navigue à l'aveugle au
clavier** dans le catalogue.

**Fichiers.** `components/configurator/Configurator.tsx` (les deux sélecteurs,
vertical et horizontal).

**Ce qu'il faut faire.** Ajouter `peer` à la classe de l'input, et un
`peer-focus-visible:ring-1 peer-focus-visible:ring-ink peer-focus-visible:ring-offset-2`
(ou l'équivalent cohérent avec le style brutaliste du site — voir les règles
`:focus-visible` de `globals.css` lignes 121 et 216) sur le label.

**Critère d'acceptation.** Tabulation puis flèches haut/bas : la configuration
focalisée est visuellement identifiable dans les deux sélecteurs.

**Commit.** `fix(a11y): rend le focus clavier visible sur le catalogue de configurations`

---

# PHASE 2 — Fondations matières

Tout le reste en dépend. À faire **avant** la phase 3.

## ☐ 2.1 — Type de matière explicite, fin des regex

**Pourquoi.** Une matière est aujourd'hui identifiée en re-parsant un libellé
français avec des expressions régulières, dans plusieurs fichiers, avec un ordre
de test qui compte. Renommer un libellé dans `data/product.ts` **casse le rendu
3D silencieusement** : la matière retombe sur `matte` sans qu'aucune erreur ne
soit levée. C'est le principal risque de régression du projet.

**Fichiers.** `data/product.ts`, `data/lampModel.ts`, `lib/lampTextures.ts`,
`lib/materialSwatch.ts`, `components/hero/Lamp3D.tsx`,
`components/hero/ExplodedLamp3D.tsx`.

**Ce qu'il faut faire.**

Ajouter un champ obligatoire `material: MaterialKind` à `PartFinish`, et le
renseigner explicitement pour les 4 pièces des 7 variantes. La valeur doit
correspondre **exactement** à ce que la regex actuelle produit — vérifier
matière par matière avant de figer, pour n'introduire aucun changement visuel.

Transformer `materialProfile(label)` en `materialProfile(kind)`, soit un accès
direct à `PROFILES[kind]`, sans aucune regex.

Déplacer la transmission lumineuse dans les profils : ajouter un champ
`transmission` à `MaterialProfile` et remplacer `shadeTransmission(label)` par
une lecture de ce champ. Reprendre les valeurs actuelles à l'identique (0.08 pour
les composites opaques, 1 pour le verre, 0.45 pour la porcelaine, 0.25 pour les
coquilles).

Faire de même pour `materialTexture(label)` dans `lib/materialSwatch.ts` : une
table indexée par `MaterialKind`.

Supprimer le code mort : `surfaceFromLabel`, `surfaceFor` et l'interface
`Surface` dans `data/lampModel.ts` ne sont utilisés nulle part (vérifier par une
recherche avant suppression).

**Contrainte forte.** Cette tâche est un refactor **sans changement visuel**.
Le rendu des 7 configurations doit être pixel pour pixel identique avant et
après. Ne renommer aucun libellé ici — c'est la tâche 2.3.

**Critères d'acceptation.** Plus aucune expression régulière sur un libellé de
matière dans le code. `MaterialKind` couvre tous les cas, TypeScript vérifie
l'exhaustivité. `npm run typecheck && npm run lint && npm run test` passent.

**Vérification 👁.** Comparer les 7 configurations avant/après par capture
d'écran, dans le configurateur et dans la vue éclatée.

**Commit.** `refactor(matières): remplace la détection par regex par un type explicite`

---

## ☐ 2.2 — Tests de résolution des matières

**Pourquoi.** Sans filet, la tâche 2.1 pourra se défaire silencieusement.

**Fichiers.** Nouveau `tests/materials.test.ts`.

**Ce qu'il faut faire.** Parcourir les 7 variantes × 4 pièces
(`shade`, `assembly`, `base`, `cable`) et vérifier que chaque finition résout
vers le `MaterialKind` attendu, avec une table d'attendus écrite en dur dans le
test. Vérifier qu'aucune finition ne tombe sur `matte` par défaut, sauf celles
qui doivent l'être — et si aucune ne le doit, l'assertion est simplement
« aucune ». Vérifier la transmission attendue de chaque abat-jour. Vérifier que
chaque `MaterialKind` référencé possède bien une entrée dans `PROFILES`.

**Critère d'acceptation.** Modifier une valeur `material` dans `product.ts` fait
échouer un test avec un message clair.

**Commit.** `test(matières): verrouille la résolution des profils de matière`

---

## ☐ 2.3 — Nomenclature : orthographes et vocabulaire

**Pourquoi.** Le visiteur lit aujourd'hui trois incohérences.

`data/product.ts` écrit `"WESTERIAL - Coquilles de moules"` pour la variante 01
en majuscules, et `"Wasterial® - ..."` partout ailleurs. La marque partenaire
est **Wasterial®** — à confirmer auprès de l'atelier avant d'appliquer.

La variante 04 dit « Coquilles d'huître » au singulier, la 05 « Coquilles
d'huîtres » au pluriel, pour la même matière.

La même pièce s'appelle « Assemblage » dans `partLabels`, « Structure » en dur
dans le configurateur et dans la fiche technique, et « Support d'assemblage »
dans les annotations de la vue éclatée.

**Fichiers.** `data/product.ts`, `components/configurator/Configurator.tsx`,
`components/chapters/ExplodedAnnotations.tsx`, `data/lampModel.ts`.

**Ce qu'il faut faire.** Unifier l'orthographe de Wasterial®. Unifier le pluriel
de « Coquilles d'huîtres ». Choisir **un** mot pour la pièce d'assemblage et le
faire passer par `partLabels` partout — plus aucune chaîne en dur. Revoir le nom
de la variante 04, très long pour une ligne de catalogue mobile, et l'aligner
avec son `materialsSummary` qui annonce aujourd'hui une composition différente.

**Prérequis.** La tâche 2.1 **doit** être faite : sans elle, renommer
« WESTERIAL » casse le rendu de la configuration 01.

**Critères d'acceptation.** Une recherche de `WESTERIAL`, `Westerial`,
`huître` et `"Structure"` en dur ne renvoie plus rien d'incohérent. Le rendu 3D
des 7 configurations est inchangé — c'est ce que garantissent les tests 2.2.

**Commit.** `fix(contenu): unifie l'orthographe des matières et le vocabulaire des pièces`

---

# PHASE 3 — Cohérence visuelle des rendus

Les vignettes du catalogue viennent de `/images/variants/*.webp`, des rendus de
la planche d'origine : ni le cadrage, ni l'éclairage, ni les matières ne
correspondent au viewport 3D. Le fondu de l'image de repli vers la 3D, au
chargement, montre deux objets visiblement différents.

## ☐ 3.1 — Pré-rendu des 7 variantes depuis le moteur du site

**Pourquoi ainsi.** Réimplémenter le rendu dans un script Node dupliquerait
`createGrainMaterial`, les shaders `onBeforeCompile` et l'environnement PMREM —
et la copie divergerait dès la première retouche. Photographier la page
elle-même garantit une fidélité parfaite et gratuite à l'exécution.

**Fichiers.** Nouveaux : `app/_render/page.tsx`,
`scripts/render-variants.mjs`. Modifiés : `package.json` (script
`renders`), `next.config.mjs` si l'exclusion de la route l'exige.

**Ce qu'il faut faire.**

Une route de développement `app/_render/page.tsx` qui monte `<Lamp3D>` plein
cadre, fond transparent, variante lue dans l'URL (`?v=<id>`), `spin={false}`,
`controls={false}`, caméra figée identique à celle du configurateur. Cette route
**ne doit pas** partir dans l'export statique : la neutraliser en production
(par exemple en la faisant retourner `notFound()` hors développement) et
vérifier après `npm run build` qu'aucun dossier `_render` n'existe dans `out/`.

Un script `scripts/render-variants.mjs` qui lance Playwright sur le Chromium
déjà présent, visite la route pour chacune des 7 variantes, attend que
`onCreated` ait eu lieu plus quelques frames de stabilisation, capture le canvas
en PNG à 2×, puis convertit en WebP avec `sharp` (déjà en devDependencies) vers
`public/images/variants/<id>.webp`.

Ajouter `"renders": "node scripts/render-variants.mjs"` dans `package.json`, à
côté de `cad` et `assets`. Le script tourne à la demande, jamais dans la CI, et
les images générées sont commitées.

**Contraintes.** Ne pas ajouter Playwright aux dépendances de production. Le
script doit échouer bruyamment si une variante ne rend pas, jamais produire une
image vide silencieusement.

**Critères d'acceptation.** `npm run renders` régénère 7 fichiers. Les vignettes
du catalogue montrent le même objet, sous le même angle et le même éclairage,
que le viewport. `npm run build` ne produit aucune trace de `_render` dans
`out/`.

**Commit.** `feat(rendus): génère les vignettes des variantes depuis le moteur 3D`

---

## ☐ 3.2 — Pastilles de matière rendues, fin de materialSwatch

**Pourquoi.** `lib/materialSwatch.ts` ne connaît que six matières sur la
vingtaine du catalogue et retombe sur un aplat de couleur pour la porcelaine, le
béton clair, tous les métaux et tous les câbles. Le mélange « vignette texturée
/ pastille unie » dans la décomposition matière se voit.

**Fichiers.** `scripts/render-variants.mjs` (étendu ou script frère),
`app/_render/page.tsx`, `components/configurator/Configurator.tsx`,
suppression de `lib/materialSwatch.ts`.

**Ce qu'il faut faire.** Étendre la route de pré-rendu à un mode « pastille » :
une sphère ou un carré rendu avec le profil exact
(`materialProfile(kind)` + `applyProfile`) et le même éclairage studio. Générer
une image par `MaterialKind` dans `public/textures/swatches/<kind>.webp`.
`MaterialRow` lit alors directement `finish.material` — plus aucune regex, plus
aucun repli sur un aplat. Supprimer `lib/materialSwatch.ts`.

**Prérequis.** Tâches 2.1 et 3.1.

**Critère d'acceptation.** Les quatre pastilles de la décomposition matière sont
texturées pour les 7 configurations, sans exception.

**Commit.** `feat(matières): génère les pastilles depuis le moteur 3D`

---

## ☐ 3.3 — Utiliser les rendus comme image de repli du viewport

**Pourquoi.** `LampStage` affiche `v.image` en attendant que la 3D soit prête,
puis fond vers le canvas. Comme les deux images ne représentent pas le même
rendu, le fondu se voit. Avec les rendus de la tâche 3.1, il devient invisible —
gain de qualité perçue important au chargement.

**Fichiers.** `components/lamp/LampStage.tsx`, `data/product.ts` si le champ
`image` doit distinguer photo éditoriale et rendu.

**Ce qu'il faut faire.** Faire pointer le repli de `LampStage` vers le rendu
généré plutôt que vers l'image de planche. Attention : `variant.image` sert
aussi aux vignettes et à d'autres contextes éditoriaux — introduire au besoin un
champ distinct (`render` à côté de `image`) plutôt que d'écraser l'existant.
Conserver `priority` sur la première image (c'est le LCP du hero).

**Critère d'acceptation 👁.** Au chargement du configurateur, le passage de
l'image au canvas ne produit plus de saut visible.

**Commit.** `fix(3d): aligne l'image de repli sur le rendu du viewport`

---

# PHASE 4 — Performance et robustesse 3D

L'architecture « un seul contexte WebGL vivant » est bien pensée, mais elle
implique que les scènes se **remontent à chaque passage de scroll**. Ce qui est
alloué au montage doit être libéré au démontage.

## ☐ 4.1 — Libérer les matériaux, éviter la recompilation des shaders

**Pourquoi.** Dans `Lamp3D` comme dans `ExplodedLamp3D`, le `useMemo` clone la
scène et crée cinq à six `MeshPhysicalMaterial` avec un `onBeforeCompile`
personnalisé. Rien ne les libère. Chaque aller-retour de scroll laisse derrière
lui des matériaux et des programmes GLSL compilés.

**Fichiers.** `components/hero/Lamp3D.tsx`,
`components/hero/ExplodedLamp3D.tsx`, `lib/lampTextures.ts`.

**Ce qu'il faut faire.** Dans `createGrainMaterial`, définir
`mat.customProgramCacheKey = () => "lamp-grain-v1"` — un `onBeforeCompile`
personnalisé casse sinon le cache de programmes de three.js. Ajouter dans les
deux composants un effet de nettoyage qui appelle `dispose()` sur chaque
matériau créé.

**Contrainte.** Ne **jamais** disposer les géométries : elles appartiennent au
GLTF mis en cache par drei et sont partagées entre les deux scènes.

**Critère d'acceptation.** Dix allers-retours de scroll à travers le
configurateur et la vue éclatée : la mémoire GPU (onglet Mémoire des devtools,
ou `renderer.info.programs`) revient à son niveau initial au lieu de croître.

**Commit.** `perf(3d): libère les matériaux au démontage et stabilise le cache de shaders`

---

## ☐ 4.2 — Cycle de vie des textures partagées

**Pourquoi.** `disposeLampTextures()` est appelé au démontage de `Lamp3D`, alors
que les textures sont des singletons de module **partagés avec
`ExplodedLamp3D`**, qui ne les libère pas. Chaque passage devant le
configurateur détruit donc des textures que la vue éclatée devra régénérer au
canvas — et `makeShellTexture`, `makeBlueTerrazzoTexture` et consorts ne sont
pas gratuites en CPU.

**Fichiers.** `lib/lampTextures.ts`, `components/hero/Lamp3D.tsx`.

**Ce qu'il faut faire.** Le plus simple et parfaitement acceptable ici : ne plus
libérer ces textures du tout et retirer l'appel à `disposeLampTextures()`. Ce
sont quelques textures, le cache de module est le bon niveau de vie. Si un
nettoyage reste souhaité, passer à un comptage de références — mais ne pas
laisser la situation actuelle, qui est le pire des deux mondes.

**Critère d'acceptation.** Après un aller-retour configurateur → vue éclatée, la
vue éclatée s'affiche sans à-coup CPU de régénération.

**Commit.** `perf(3d): arrête de libérer les textures partagées entre scènes`

---

## ☐ 4.3 — Boucles d'animation en veille

**Pourquoi.** `ExplodedAnnotations` fait tourner une boucle
`requestAnimationFrame` en permanence tant que la couche est montée ; la sortie
anticipée quand `p < START - 0.06` est bien vue, mais la frame est quand même
réveillée soixante fois par seconde. Et `ExplodedLampSection` ne surveille pas
`visibilitychange`, contrairement à `LampStage` : la vue éclatée continue de
tourner en `frameloop="always"` quand l'onglet passe en arrière-plan.

**Fichiers.** `components/chapters/ExplodedAnnotations.tsx`,
`components/chapters/ExplodedLampSection.tsx`.

**Ce qu'il faut faire.** Ne démarrer la boucle rAF des annotations qu'à l'entrée
dans la fenêtre de révélation, via `useMotionValueEvent` sur
`scrollYProgress`, et l'arrêter en sortie. Reprendre dans `ExplodedLampSection`
le garde `visibilitychange` déjà écrit dans `LampStage`, et passer
`frameloop="demand"` quand l'onglet est masqué.

**Critère d'acceptation.** Onglet en arrière-plan sur la vue éclatée : plus
d'activité dans le profileur de performances.

**Commit.** `perf(3d): met les boucles d'animation en veille hors champ`

---

## ☐ 4.4 — Longueur de la piste éclatée 👁 à valider à l'œil

**Pourquoi.** `ExplodedScrollTrack` fait `360svh` — environ 2 500 px de
défilement sur téléphone pour une seule section. C'est long.

**Fichiers.** `components/chapters/ExplodedLampSection.tsx`.

**Ce qu'il faut faire.** Essayer 300svh, puis 260svh. Vérifier que les
annotations, dont la fenêtre de révélation est calée sur les 26 derniers pour
cent (`START = 0.74`), restent lisibles — il faut le temps de lire six
étiquettes. Ajuster `START` si nécessaire.

**Décision à prendre au doigt, pas au chiffre.** Si 360svh te va après essai,
laisse-le et coche la tâche.

**Commit.** `tune(3d): raccourcit la piste de la vue éclatée`

---

# PHASE 5 — Poids des médias

## ☐ 5.1 — Le placage bois : 1,84 Mo pour une texture tuilée huit fois

**Pourquoi.** `public/textures/placage-bois.jpg` fait 1,84 Mo. Il ne sert qu'au
placage intérieur de l'abat-jour de la configuration 01
(`applyInteriorVeneer`), à une échelle de tuilage de 8 — sa résolution native
est donc très largement au-delà de ce qui est visible. **Meilleur rapport
gain/effort du projet.**

**Fichiers.** `public/textures/placage-bois.jpg` → `.webp`,
`lib/lampTextures.ts` (constante `WOOD_VENEER_URL`).

**Ce qu'il faut faire.** Redimensionner à 1024 px de côté et convertir en WebP
de haute qualité avec `sharp`. Attendu : 60 à 100 Ko, soit environ 95 % de gain.

**Critère d'acceptation 👁.** L'intérieur de l'abat-jour de la configuration 01
est visuellement identique. Poids du fichier divisé par au moins quinze.

**Commit.** `perf(assets): allège la texture de placage bois`

---

## ☐ 5.2 — Images éditoriales et textures

**Fichiers.** `public/images/chapter2/*`, `public/images/materiaux-echantillons.png`,
`public/textures/*.png`, `scripts/prepare-assets.mjs`.

**Ce qu'il faut faire.** `general.webp` (687 Ko), `eclate.webp` (477 Ko),
`croquis.webp` (289 Ko) : recompresser à qualité perceptuellement équivalente.
`materiaux-echantillons.png` (313 Ko) est une photographie stockée en PNG :
WebP divisera par trois ou quatre.

Les textures PNG (`beton-bleute.png` 362 Ko, `brique.png` 239 Ko) sont plus
délicates : ce sont des données de rendu, une compression trop agressive
introduirait des artefacts visibles sur un tuilage triplanar. Un WebP de haute
qualité reste raisonnable — **à valider à l'œil sur le rendu 3D, pas sur
l'image seule.**

Faire passer tout ça par `scripts/prepare-assets.mjs`, qui existe déjà, pour que
l'opération soit reproductible.

**Critère d'acceptation 👁.** Poids du dossier `public` réduit d'au moins moitié,
aucune dégradation perceptible sur le fil éditorial ni sur les matières 3D.

**Commit.** `perf(assets): recompresse les images éditoriales et les textures`

---

## ☐ 5.3 — Nettoyer la configuration d'images

**Pourquoi.** `next.config.mjs` porte `images.unoptimized: true` — logique en
export statique — **et** la prop `unoptimized` est répétée sur chaque
`<Image>` : elle est redondante. Plus important, comme aucun optimiseur ne
tourne, les attributs `sizes` passés avec soin **n'ont aucun effet** : le
navigateur télécharge toujours le fichier source.

**Fichiers.** tous les composants utilisant `next/image`, `next.config.mjs`.

**Ce qu'il faut faire.** Retirer les props `unoptimized` redondantes. Décider
pour les `sizes` : soit les retirer aussi puisqu'ils ne servent à rien, soit —
mieux — générer de vraies variantes responsives dans `prepare-assets.mjs` et
fournir un `srcSet` explicite. Retirer aussi `formats: ["image/avif",
"image/webp"]` de `next.config.mjs`, sans effet en `unoptimized`.

**Critère d'acceptation.** Aucun changement visuel. Le code ne contient plus de
réglage sans effet.

**Commit.** `chore(images): supprime les réglages sans effet en export statique`

---

# PHASE 6 — Contenu et finitions

## ☐ 6.1 — Fiche technique : masquer les champs vides

**Pourquoi.** Six champs sur dix affichent « — à venir » : dimensions, source
lumineuse, alimentation, poids, délai, disponibilité. Le paragraphe qui suit
explique déjà très bien que ces éléments se précisent au cas par cas — les
lignes vides n'ajoutent rien et donnent une impression d'inachevé. Au passage,
leur valeur est en `text-ink-muted/60`, ce qui descend très probablement sous le
ratio 4,5:1 exigé par WCAG AA sur fond blanc.

**Fichiers.** `components/product-story/Details.tsx`.

**Ce qu'il faut faire.** Filtrer les entrées dont `value` est `null`. Conserver
le paragraphe d'explication. **Ne pas** toucher à `data/product.ts` : les
`TODO` restent, ce sont eux qui rappellent ce que l'atelier doit fournir.

**Critère d'acceptation.** La fiche n'affiche que des données réelles. Le
contraste du texte restant passe AA.

**Commit.** `fix(contenu): masque les caractéristiques non renseignées`

---

## ☐ 6.2 — Le chapitre « Les matières » 👁 à valider à l'œil

**Pourquoi.** Il est aujourd'hui très mince : un titre, trois phrases, une image
de planche. Avec les pastilles générées en 3.2, il peut devenir l'endroit
naturel où l'on présente la palette réelle, matière par matière, avec son nom —
et il prépare alors le configurateur au lieu de simplement l'annoncer.

**Fichiers.** `components/chapters/MaterialsIntro.tsx`.

**Prérequis.** Tâche 3.2.

**Ce qu'il faut faire.** Présenter la palette des `MaterialKind` réellement
utilisés, chacun avec sa pastille rendue et son libellé public. Conserver le
crédit ETNISI et la mention Wasterial® existants. **Ne rien inventer** sur
l'origine ou la composition des matières : seuls les textes déjà présents dans
`data/product.ts` sont utilisables.

**Commit.** `feat(contenu): présente la palette de matières réelle`

---

## ☐ 6.3 — Le formulaire de contact doit vraiment envoyer

**Pourquoi.** `siteConfig.leadEndpoint` est vide, donc tout repose sur le repli
`mailto:`. Ça fonctionne, mais sur mobile beaucoup de navigateurs n'ont pas de
client mail configuré : le message est alors perdu **sans que personne ne le
sache**. À traiter avant de diffuser le site.

**Fichiers.** `config/site.ts` uniquement — le code de `ContactForm.tsx` gère
déjà les deux chemins, il n'y a rien à modifier.

**Ce qu'il faut faire (manuel, hors Claude Code).** Créer un endpoint gratuit
chez Formspree ou Basin, le renseigner dans `siteConfig.leadEndpoint`, envoyer
un message de test, vérifier la réception. Un quart d'heure.

**Critère d'acceptation.** Un envoi depuis un téléphone sans client mail arrive
bien dans la boîte de réception.

**Commit.** `chore(contact): active l'endpoint d'envoi du formulaire`

---

# Découvert en chemin

Ajouter ici, sans les implémenter, les améliorations repérées pendant les
tâches. À trier plus tard.

-

---

# Journal

## 10 août — correction de la revue initiale

**Les « vingt fichiers modifiés non commités » n'existaient pas.** Vérification
faite : `git diff --ignore-cr-at-eol --stat` ne renvoie **rien**. Les fichiers
apparaissaient modifiés uniquement parce qu'ils étaient lus depuis un système
Linux avec `core.autocrlf` désactivé, alors que la copie de travail Windows est
en CRLF et le dépôt en LF. Le travail était déjà commité (`da0a4c8`). Il n'y
avait donc aucun risque de perte — l'alerte de la revue était infondée.

La tâche 0.2 (`.gitattributes`) reste utile, mais pour une autre raison : rendre
le comportement explicite et surtout **protéger les sources CAO** (`.IGS`) de
toute conversion de fins de ligne, qui pourrait les rendre illisibles par
`npm run cad`.

## Git depuis une session Cowork : à éviter

Les commandes git lancées depuis le dossier connecté laissent derrière elles des
fichiers `.git/*.lock` et des objets temporaires impossibles à supprimer
(l'environnement n'a pas le droit d'effacer des fichiers). Ces verrous bloquent
ensuite git côté Windows. **Toutes les opérations git — `add`, `commit`, `push`,
branches — se font depuis ton terminal Windows.** L'assistant se limite à écrire
et modifier des fichiers.

## Tests et lint depuis une session Cowork

`npm run typecheck` fonctionne (c'est du TypeScript pur). `npm run test` et
`npm run lint` **échouent**, parce que `node_modules` a été installé sous Windows
et contient des binaires natifs (rollup, esbuild, sharp) incompatibles avec
Linux. Ce n'est pas un problème de code : ces deux commandes se lancent depuis
Windows.

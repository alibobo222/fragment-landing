# TASKS.md — plan de travail

Issu de la revue du 10 août 2026, **mis à jour après la séance du 10 août au
soir**. Les tâches sont ordonnées par dépendance : chacune suppose les
précédentes faites.

---

## Mode d'emploi

### Pour chaque tâche

Ouvre Claude Code dans le dossier du projet et colle exactement ceci, en
remplaçant le numéro :

> Lis `TASKS.md` et exécute **uniquement** la tâche **A1**. Respecte son
> périmètre : n'implémente rien qui n'y figure pas. Quand c'est fait, lance
> `npm run typecheck && npm run lint && npm run test`, montre-moi le diff, et
> attends ma validation avant de commiter.

Une tâche = une session = un commit. Si une session dérive, `/clear` et reprends
la tâche à zéro : c'est moins coûteux que de corriger.

`CLAUDE.md`, à la racine, est lu automatiquement — Claude Code y trouve
l'architecture, les règles et les pièges du projet. Inutile de les répéter.

### Les tâches marquées 👁

Elles ne peuvent pas être jugées par des tests. Lance `npm run dev`, regarde, et
valide toi-même avant de commiter.

---

# ✅ Résolu — tout est maintenant commité

Le risque décrit ici (une trentaine de fichiers modifiés le 10 août au soir,
rien en git) est levé : `typecheck`, `lint` et `test` passent tous les trois,
et l'ensemble est réparti sur plusieurs commits — la refonte du cartel du
configurateur (données, nuancier, agrandissement de la lampe) plus, notées
séparément parce que hors du périmètre de cette tâche-là, la pastille de
température de lumière, l'indicateur de débordement du sélecteur et le
décrochage du titre de « Les matières ».

Le dossier `_to_delete/` (anciens verrous git, fichiers `.tmp.mjs`) **est
revenu plusieurs fois** pendant cette séance de commit malgré sa suppression —
voir « Découvert en chemin ».

---

# ✅ Fait le 10 août

Pour mémoire, et pour ne pas re-planifier ce qui existe déjà.

**Socle.** `.gitattributes` (protège les sources CAO d'une conversion de fins de
ligne). CI qui vérifie types, lint et tests avant de déployer.

**Configurateur.** Viewport 3D épinglé, de sorte que la lampe reste visible
pendant le choix — auparavant le catalogue commençait ~590 px sous la scène.
Sélecteur unique en rangée horizontale, le catalogue vertical redondant ayant été
supprimé et ses informations remontées sous la scène. Focus clavier visible.
Fiche de configuration animée. Lampe éteinte au chargement.

**Vue éclatée.** Découpée en actes (désassemblage → tracé → palier de lecture),
avec un fichier de chronologie dédié. Nomenclature renumérotée et rangée en deux
colonnes correspondant aux deux groupes de pièces. Placement des étiquettes
calculé sur la projection réelle, avec répartition anti-chevauchement. Flèches
visant un vrai point de surface, pointe orientée sur la tangente du tracé.
Ombre de contact recalée sous le pied. Plus de page blanche à la sortie.

**Produit.** Tôle perforée sur la pièce d'assemblage (trous carrés, vraies
ouvertures par `discard` — le GLB n'ayant pas d'UV, une `alphaMap` était hors de
portée). Filetage intérieur de la douille en **vraie géométrie** (hélice
paramétrée sur l'axe et l'alésage ajustés aux moindres carrés). Option
**Perforation** ronde / carrée / aucune, intégrée à l'état du configurateur.

**Vignettes.** DA unifiée : caméra, focale, angle, échelle, marges, éclairage et
état lumineux dans un module unique (`config/packshot.ts`), route de rendu,
script de génération, et les sept images produites depuis le moteur 3D du site.
Cadrage vérifié identique au pixel sur les sept.

**UI.** Cadres des vignettes supprimés, trois filets horizontaux retirés au
profit de l'espace et de la typographie, fondu à la place du filet sous le bloc
épinglé, contrôles sortis de la scène pour ne plus empiéter sur la lampe, et
correction du clipping du câble — la boîte 3D était un carré plafonné à 40 % de
la hauteur d'écran, elle occupe désormais toute la largeur à hauteur constante.

**Typographie.** Titres passés de 900 à 600, calés sur le logotype FRAGMENT.

---

# PHASE A — Fondations matières

**C'est la dette la plus importante du projet, et elle est intacte.** Une matière
est identifiée en re-parsant un libellé français avec des expressions
régulières. Renommer un libellé dans `data/product.ts` casse le rendu 3D
**silencieusement** : la matière retombe sur `matte` sans qu'aucune erreur ne
soit levée. Deux corrections de contenu attendent d'ailleurs cette tâche.

## ☐ A1 — Type de matière explicite, fin des regex

**Fichiers.** `data/product.ts`, `data/lampModel.ts`, `lib/lampTextures.ts`,
`lib/materialSwatch.ts`, `components/hero/Lamp3D.tsx`,
`components/hero/ExplodedLamp3D.tsx`.

**Ce qu'il faut faire.** Ajouter un champ obligatoire `material: MaterialKind` à
`PartFinish`, renseigné explicitement pour les 4 pièces des 7 variantes, avec des
valeurs correspondant **exactement** à ce que la regex actuelle produit.
Transformer `materialProfile(label)` en accès direct `PROFILES[kind]`. Déplacer
la transmission lumineuse dans les profils et remplacer `shadeTransmission(label)`
par une lecture de champ. Faire de même pour `materialTexture(label)`.

Supprimer le code mort : `surfaceFromLabel`, `surfaceFor` et l'interface
`Surface` dans `data/lampModel.ts` ne sont utilisés nulle part (vérifié).

**Contrainte forte.** Refactor **sans changement visuel**. Le rendu des 7
configurations doit être identique avant et après. Ne renommer aucun libellé
ici — c'est la tâche A3.

**Vérification 👁.** Comparer les 7 configurations par capture, dans le
configurateur et dans la vue éclatée.

**Commit.** `refactor(matières): remplace la détection par regex par un type explicite`

---

## ☐ A2 — Tests de résolution des matières

**Fichiers.** Nouveau `tests/materials.test.ts`.

Parcourir les 7 variantes × 4 pièces et vérifier que chaque finition résout vers
le `MaterialKind` attendu, avec une table d'attendus écrite en dur. Vérifier
qu'aucune ne tombe sur `matte` par accident, que la transmission de chaque
abat-jour est celle attendue, et que chaque `MaterialKind` référencé possède une
entrée dans `PROFILES`.

**Critère.** Modifier une valeur `material` dans `product.ts` fait échouer un
test avec un message clair.

**Commit.** `test(matières): verrouille la résolution des profils de matière`

---

## ☐ A3 — Nomenclature : orthographes restantes

**Prérequis : A1.** Sans elle, corriger « WESTERIAL » casse le rendu de la
configuration 01.

Il reste, vérifié dans les données : **trois** occurrences de `WESTERIAL` en
capitales, là où toutes les autres variantes écrivent `Wasterial®` ; et une
hésitation entre « huître » (4 fois) et « huîtres » (5 fois) pour la même
matière. Revoir aussi le nom de la variante 04, très long pour une ligne de
catalogue, et incohérent avec son propre `materialsSummary`.

**Déjà fait le 10 août** : « Câble textile » partout, et « Assemblage » unifié
via `partLabels`.

**Commit.** `fix(contenu): unifie l'orthographe des matières`

---

# PHASE B — Cohérence visuelle, suite

Les packshots existent ; deux usages restent à brancher.

## ☐ B1 — Pastilles de matière rendues, fin de `materialSwatch`

**Prérequis : A1, et le système de packshot existant.**

`lib/materialSwatch.ts` ne connaît que six matières sur la vingtaine du catalogue
et retombe sur un aplat de couleur pour la porcelaine, le béton clair, tous les
métaux et tous les câbles. Le mélange « vignette texturée / pastille unie » se
voit dans la décomposition matière.

Étendre la route de packshot à un mode « pastille » : une sphère ou un carré
rendu avec le profil exact et le même éclairage studio, une image par
`MaterialKind`. `MaterialRow` lit alors `finish.material`. Supprimer
`lib/materialSwatch.ts`.

**Commit.** `feat(matières): génère les pastilles depuis le moteur 3D`

---

## ☐ B2 — Le repli de `LampStage` doit être un packshot

`components/lamp/LampStage.tsx` affiche encore `v.image` — l'ancienne image
éditoriale — en attendant que la 3D soit prête. Comme les deux ne représentent
pas le même rendu, le fondu se voit au chargement. Le faire pointer vers le
packshot généré, en gardant `priority` sur la première image (c'est le LCP).

**Commit.** `fix(3d): aligne l'image de repli sur le rendu du viewport`

---

# PHASE C — Performance et robustesse 3D

L'architecture « un seul contexte WebGL vivant » implique que les scènes se
**remontent à chaque passage de scroll**. Ce qui est alloué au montage doit être
libéré au démontage — ce n'est toujours pas le cas.

## ☐ C1 — Libérer les matériaux, stabiliser le cache de shaders

Dans `Lamp3D` comme dans `ExplodedLamp3D`, le `useMemo` crée cinq à six
`MeshPhysicalMaterial` avec un `onBeforeCompile` personnalisé. **Rien ne les
libère** (vérifié : aucun `dispose` de matériau dans `Lamp3D`). Chaque
aller-retour de scroll laisse derrière lui des matériaux et des programmes GLSL.

Définir `mat.customProgramCacheKey = () => "lamp-grain-v1"` dans
`createGrainMaterial` — un `onBeforeCompile` personnalisé casse sinon le cache de
programmes. Ajouter un effet de nettoyage qui `dispose()` chaque matériau créé.

**Contrainte.** Ne **jamais** disposer les géométries : elles appartiennent au
GLTF mis en cache par drei et sont partagées. Seule exception déjà en place, la
géométrie du filetage, créée par le composant et libérée par lui.

**Critère.** Dix allers-retours de scroll : `renderer.info.programs` revient à
son niveau initial au lieu de croître.

**Commit.** `perf(3d): libère les matériaux au démontage`

---

## ☐ C2 — Cycle de vie des textures partagées

`disposeLampTextures()` est toujours appelé au démontage de `Lamp3D` (vérifié)
alors que les textures sont des singletons de module **partagés avec
`ExplodedLamp3D`**, qui ne les libère pas. Chaque passage devant le configurateur
détruit donc des textures que la vue éclatée devra régénérer au canvas — et
`makeShellTexture`, `makeBlueTerrazzoTexture` et consorts ne sont pas gratuites.

Le plus simple et parfaitement acceptable : retirer l'appel et ne plus les
libérer du tout. Le cache de module est le bon niveau de vie.

**Commit.** `perf(3d): arrête de libérer les textures partagées entre scènes`

---

## ☐ C3 — Boucles d'animation en veille

`ExplodedAnnotations` fait tourner une boucle `requestAnimationFrame` en
permanence tant que la couche est montée. Et `ExplodedLampSection` ne surveille
pas `visibilitychange`, contrairement à `LampStage` : la vue éclatée continue de
tourner en `frameloop="always"` quand l'onglet passe en arrière-plan.

**Commit.** `perf(3d): met les boucles d'animation en veille hors champ`

---

# PHASE D — Poids des médias

## ☐ D1 — Le placage bois : 1,84 Mo (vérifié, inchangé)

`public/textures/placage-bois.jpg` pèse toujours 1 841 110 octets. Il ne sert
qu'au placage intérieur de l'abat-jour de la configuration 01, à un tuilage de 8
— sa résolution native est très au-delà du visible. Redimensionner à 1024 px et
convertir en WebP : attendu 60 à 100 Ko, soit environ 95 % de gain. **Meilleur
rapport gain/effort du projet.**

**Commit.** `perf(assets): allège la texture de placage bois`

---

## ☐ D2 — Images éditoriales et textures 👁

`chapter2/general.webp` 687 Ko, `eclate.webp` 477 Ko, `croquis.webp` 289 Ko, et
`materiaux-echantillons.png` 313 Ko — une photographie stockée en PNG, que le
WebP diviserait par trois ou quatre. Les textures PNG sont plus délicates : ce
sont des données de rendu, à valider à l'œil sur la 3D et non sur l'image seule.
Faire passer l'opération par `scripts/prepare-assets.mjs`, qui existe déjà.

**Commit.** `perf(assets): recompresse les images éditoriales et les textures`

---

## ☐ D3 — Nettoyer la configuration d'images

`next.config.mjs` porte `images.unoptimized: true` — logique en export statique —
**et** la prop `unoptimized` est répétée sur chaque `<Image>`. Redondant. Plus
important : aucun optimiseur ne tournant, les attributs `sizes` n'ont aucun
effet. Soit les retirer, soit générer de vraies variantes responsives.

**Commit.** `chore(images): supprime les réglages sans effet en export statique`

---

# PHASE E — Contenu et finitions

## ☐ E1 — Fiche technique : masquer les champs vides

**Six** champs sur dix affichent « — à venir » (vérifié). Le paragraphe qui suit
explique déjà que ces éléments se précisent au cas par cas : les lignes vides
n'ajoutent rien et donnent une impression d'inachevé. Les filtrer. **Ne pas**
toucher à `data/product.ts` : les `TODO` restent, ce sont eux qui rappellent ce
que l'atelier doit fournir. Au passage, leur valeur est en `text-ink-muted/60`,
ce qui descend probablement sous le ratio AA — le filtrage règle aussi ça.

**Commit.** `fix(contenu): masque les caractéristiques non renseignées`

---

## ☐ E2 — Le chapitre « Les matières » 👁

**Prérequis : B1.** Il est aujourd'hui très mince : un titre, trois phrases, une
image de planche. Avec les pastilles générées, il peut présenter la palette
réelle, matière par matière, et préparer le configurateur au lieu de l'annoncer.
**Ne rien inventer** sur l'origine ou la composition : seuls les textes déjà
présents dans `data/product.ts` sont utilisables.

**Commit.** `feat(contenu): présente la palette de matières réelle`

---

## ☐ E3 — Le formulaire de contact doit vraiment envoyer

`siteConfig.leadEndpoint` vaut toujours `null` (vérifié) : tout repose sur le
repli `mailto:`. Sur mobile, beaucoup de navigateurs n'ont pas de client mail
configuré — le message est alors perdu **sans que personne ne le sache**. Créer
un endpoint Formspree ou Basin, le renseigner, envoyer un message de test.
Un quart d'heure, et rien à modifier dans le code : `ContactForm` gère déjà les
deux chemins.

**Commit.** `chore(contact): active l'endpoint d'envoi du formulaire`

---

## ☐ E4 — Sortir le projet de OneDrive (manuel)

Le dépôt vit dans `OneDrive\Bureau\CLAUDE CODE\etnisi-site`. La combinaison
OneDrive + `node_modules` + `.git` provoque des verrous de fichiers et, dans les
mauvais cas, un dépôt corrompu. Elle ralentit aussi les builds.

```bash
git status                      # doit être propre
robocopy etnisi-site C:\dev\etnisi-site /E /XD node_modules .next
cd C:\dev\etnisi-site && npm ci && npm run build
```

Vérifier `git log` et `git remote -v`, puis supprimer l'ancien dossier.

---

# Découvert en chemin

À trier plus tard, repéré pendant la séance du 10 août.

- Le câble s'étale largement et dicte la largeur de cadrage des packshots, ce qui
  rapetisse la lampe. Le masquer sur les vignettes donnerait un packshot plus
  serré — un paramètre à ajouter à la DA.
- La perforation ne couvre aujourd'hui que la tôle en entier. Sur le prototype
  réel, elle s'arrête avant les bords et laisse un liseré plein.
- `EXPLODE_SCALE` et `CAMERA` de la vue éclatée se règlent ensemble : c'est
  documenté dans le code, mais mériterait d'être dérivé automatiquement.

Repéré pendant la séance de commit du 11 août.

- Le dossier `_to_delete/` (verrous git `*.lock.removed`, objets temporaires
  `tmp-objects/`, scripts `*.tmp.mjs`) est réapparu à plusieurs reprises malgré
  sa suppression, avec à chaque fois un `.git/index.lock` orphelin (confirmé
  sans processus git actif via `Get-Process`). Cause probable : un outil ou un
  hook qui touche `.git/` sans se terminer proprement dans cet environnement
  Windows/OneDrive. Sans effet sur le site, mais à surveiller — et un argument
  de plus pour E4 (sortir le dépôt de OneDrive).

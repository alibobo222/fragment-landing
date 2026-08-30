# TASKS.md — plan de travail

**État au 12 août 2026** — dernier commit `5d74185` (ce document est réécrit
juste après). `npm run typecheck && npm run lint && npm run test` : les trois
passent (0 erreur, 0 warning, 55/55 tests). `npm run build` (export statique) :
passe. Cette ligne évite à la prochaine session de repartir d'un diagnostic
périmé — vérifie-la avant de faire confiance au reste du fichier si elle date.

---

## Mode d'emploi

### Pour chaque tâche

Ouvre Claude Code dans le dossier du projet et colle exactement ceci, en
remplaçant le nom :

> Lis `TASKS.md` et exécute **uniquement** la tâche **<nom>**. Respecte son
> périmètre : n'implémente rien qui n'y figure pas. Quand c'est fait, lance
> `npm run typecheck && npm run lint && npm run test`, montre-moi le diff, et
> attends ma validation avant de commiter.

Une tâche = un commit. Si une session dérive, `/clear` et reprends la tâche à
zéro : c'est moins coûteux que de corriger.

`CLAUDE.md`, à la racine, est lu automatiquement — Claude Code y trouve
l'architecture, les règles et les pièges du projet. Inutile de les répéter.

### Les tâches marquées 👁

Elles ne peuvent pas être jugées par des tests. Lance `npm run dev` (avec
`NEXT_PUBLIC_PACKSHOT=1` si la tâche touche au rendu 3D, pour pouvoir comparer
avec `npm run visual` — voir plus bas), regarde, et valide toi-même avant de
commiter.

---

## ✅ Fait

**Fondations matières (la dette la plus importante du projet, résolue).** Les
matières sont désormais un champ explicite `material: MaterialKind` sur
`PartFinish` — plus aucune détection par expression régulière sur un libellé
affiché. Renommer un libellé n'affecte plus le rendu 3D. Verrouillé par
`tests/materials.test.ts` (24 tests : résolution attendue par variante × pièce,
transmission de chaque abat-jour, couverture complète de `PROFILES`). Toutes
les matières écrivent désormais `Wasterial®` (plus de `WESTERIAL`) et
« coquilles d'huîtres » partout ; le nom de la variante 04 est aligné sur son
`materialsSummary` et sur le schéma des autres variantes (« *matière* &
*métal* »).

**Base de régression visuelle.** `scripts/visual-regression.mjs` (`npm run
visual`, `-- --update` pour rafraîchir) capture les 7 configurations via la
route `/packshot` et les compare à `tests/visual-baseline/` (versionnée). Seuil
à 2 % : les textures de grain sont régénérées par `Math.random()` à chaque
chargement de page, ce qui produit un bruit non déterministe mesuré jusqu'à
0,61 % sur trois essais sans aucun changement de code — voir le commentaire du
script avant de resserrer ce seuil. C'est cet outil qui a validé le refactor
matières ci-dessus (0 régression réelle détectée).

**Formulaire de contact.** Bascule complète sur Supabase Edge Function +
Resend (`supabase/functions/contact`) : enregistrement dans `contact_leads`
(RLS sans policy, jamais atteinte par le navigateur), notification e-mail,
honeypot, rate-limit (3/10 min par IP salée), validation partagée
client/serveur. Détails et procédure de mise en service dans `README.md`,
section 14. Le repli `mailto:` reste le chemin de secours si l'endpoint n'est
pas configuré.

**SEO.** `siteConfig.siteUrl` pointe vers l'URL GitHub Pages réellement servie
(`https://alibobo222.github.io/fragment-landing`), canonical/OG/sitemap/robots
alignés — y compris la résolution des chemins relatifs sous le sous-dossier
`/fragment-landing` (voir le commentaire dans `app/layout.tsx`, un piège
classique de `metadataBase` avec `basePath`). La route `/packshot` (outil de
génération de vignettes, jamais une page du site) est exclue de l'indexation.

**Dépendances.** Next.js et `eslint-config-next` en 15.5.23, `sharp` en 0.35.3,
`playwright` déclaré (servait sans être dans `package.json`). `npm audit` :
12 → 8 vulnérabilités ; les 8 restantes exigent Next 16 (postcss/sharp internes
à l'optimiseur d'image, jamais utilisé ici — `images.unoptimized: true`) ou
vitest 4 (chaîne esbuild/vite) — volontairement pas traitées, voir « Reste
ouvert ».

**Poids des médias.** Placage bois : 1,84 Mo → 78,7 Ko (WebP 1024 px,
`scripts/prepare-assets.mjs`). Pastilles du nuancier : ~1,26 Mo → ~4,2 Ko pour
les 7 (dérivés 64 px sous `public/textures/swatch/`, générés par la même
section du script). La prop `unoptimized`, redondante avec
`next.config.mjs`, a été retirée de chaque `<Image>` (les `sizes` restent :
`next/core-web-vitals` avertit sinon sur les `<Image fill>`).

**Cycle de vie 3D.** `Lamp3D` et `ExplodedLamp3D` disposent maintenant leurs
matériaux au démontage (`customProgramCacheKey` stable requis pour que le
cache de programmes three.js fonctionne avec un `onBeforeCompile`
personnalisé — critère vérifié : `renderer.info.programs` ne croît plus sur 10
allers-retours de scroll). Les textures partagées entre les deux scènes ne
sont plus libérées par l'une au détriment de l'autre (cache de module = bon
niveau de vie). `ExplodedAnnotations` et `ExplodedLampSection` coupent leur
boucle `requestAnimationFrame` sur `visibilitychange`, comme `LampStage`.

**Contenu.** La fiche technique masque les six caractéristiques non
renseignées au lieu d'afficher « — à venir » (les `TODO` restent dans
`data/product.ts`, c'est le rappel pour l'atelier).

**CI.** Le workflow vérifie types/lint/tests sur chaque pull request en plus
de chaque push sur `main` ; seul le job de déploiement reste conditionné au
push.

**Antérieur (avant cette session, pour mémoire) :** `.gitattributes`, CI de
base, refonte du cartel du configurateur (nuancier, scène agrandie à 54svh,
non épinglée), vue éclatée en actes avec chronologie dédiée, tôle perforée en
vraie géométrie, filetage hélicoïdal de la douille, DA des packshots unifiée
(`config/packshot.ts`), curseur de température de couleur en kelvins.

---

## Reste ouvert

### Images éditoriales et textures 👁

`chapter2/general.webp` (687 Ko), `eclate.webp` (477 Ko), `croquis.webp`
(289 Ko), `profil.webp` (296 Ko) et `materiaux-echantillons.png` (313 Ko — une
photographie en PNG, que le WebP diviserait par trois ou quatre) : toujours à
leur poids d'origine, vérifié à cette date. Les textures PNG de rendu 3D
(`public/textures/*.png`, hors dérivés `swatch/`) sont plus délicates : à
valider à l'œil sur la 3D, pas sur l'image seule. Passer par
`scripts/prepare-assets.mjs`, qui a maintenant une section dédiée aux fichiers
de `public/textures/` à étendre plutôt qu'une troisième à créer.

**Commit proposé.** `perf(assets): recompresse les images éditoriales et les textures`

### Variantes responsives d'images

Sans optimiseur (export statique, `images.unoptimized: true`), les attributs
`sizes` des `<Image>` n'ont aucun effet réel : ils évitent seulement un
warning ESLint. La vraie question — générer de vraies variantes responsives
(plusieurs résolutions par image, servies selon la taille d'écran) — reste
entière. Non traitée délibérément : hors périmètre d'un simple nettoyage de
prop redondante (voir « Découvert en chemin »).

### Chapitre « Les matières » 👁

Toujours mince : un titre, trois phrases, une image de planche
(`materiaux-echantillons.png`, justement listée ci-dessus). Les pastilles
légères existent maintenant (`public/textures/swatch/`), mais seulement pour
7 des matières du catalogue, pas les ~13 `MaterialKind` — un vrai rendu de
pastille par `MaterialKind` depuis le moteur 3D (sphère ou carré, profil
exact, éclairage studio) donnerait une couverture complète et permettrait de
présenter la palette réelle matière par matière. Ne rien inventer sur
l'origine ou la composition : seuls les textes déjà présents dans
`data/product.ts` sont utilisables.

**Commit proposé.** `feat(contenu): présente la palette de matières réelle`

### Dépendances restantes (volontairement non traitées)

`npm audit` liste encore 8 vulnérabilités : la copie interne de
postcss/sharp dans `next` (optimiseur d'image — inutilisé ici) n'a de correctif
qu'en passant à Next 16 ; la chaîne esbuild/vite/vitest n'a de correctif qu'en
passant à vitest 4. Les deux sont des montées majeures, hors périmètre de
cette séance. À planifier comme tâches à part entière plutôt qu'en profiter
« au passage » lors d'une autre tâche.

---

## Hors périmètre (manuel, pour l'humain)

### Sortir le projet de OneDrive

Le dépôt vit dans `OneDrive\Bureau\CLAUDE CODE\etnisi-site`. La combinaison
OneDrive + `node_modules` + `.git` provoque des verrous de fichiers — voir
« Découvert en chemin » ci-dessous, le symptôme s'est reproduit pendant cette
séance aussi — et, dans les mauvais cas, un dépôt corrompu. Ralentit aussi les
builds.

```bash
git status                      # doit être propre
robocopy etnisi-site C:\dev\etnisi-site /E /XD node_modules .next
cd C:\dev\etnisi-site && npm ci && npm run build
```

Vérifier `git log` et `git remote -v`, puis supprimer l'ancien dossier.

### Passage à Next 16

Change la configuration d'`eslint-config-next`. Résoudrait les dernières
vulnérabilités liées à l'optimiseur d'image de Next (non utilisé ici), mais
c'est une vraie montée de version majeure, à faire délibérément et pas comme
correctif de sécurité incidental.

---

## Découvert en chemin

- **Variantes responsives d'images non générées** (voir « Reste ouvert » —
  signalé ici tel que demandé, pour ne pas se reperdre : le nettoyage de la
  prop `unoptimized` a distingué ce qui n'avait aucun effet, en beauté, de ce
  qui manque réellement).
- **`scripts/prepare-assets.mjs` dépend de planches sources absentes du
  dépôt** (`../Etnisi/Capture d'écran ....png`) pour sa partie historique
  (découpe des visuels de variantes et du prototype). Ce n'est pas un bug :
  ces planches sont déposées par l'atelier, hors dépôt, par conception. Mais
  le script échouait autrefois si elles manquaient — corrigé pendant cette
  séance (il journalise et passe à la section suivante) pour qu'il reste
  exécutable après un simple `git clone`, la nouvelle section (textures)
  n'ayant besoin de rien d'externe.
- Un `MaterialKind` (`glassBlue`) existe dans `PROFILES` sans qu'aucune
  variante ne le référence — vérifié, ce n'est pas un oubli : c'est un profil
  antérieur à `blueGlass`, jamais retiré. Sans effet (le test de couverture de
  l'étape matières le valide quand même), mais un vrai candidat au ménage si
  quelqu'un confirme qu'il est bien mort.
- Le dossier `_to_delete/` (verrous git `*.lock.removed`, objets temporaires
  `tmp-objects/`) et un `.git/index.lock` orphelin sont réapparus une nouvelle
  fois pendant cette séance (cause probable inchangée : un outil ou un hook
  qui touche `.git/` sans se terminer proprement sous Windows/OneDrive — encore
  un argument pour sortir le dépôt de OneDrive, voir plus haut).
- Le nuancier du configurateur (`ColorSwatch`) et le rendu 3D peuvent
  diverger : deux pièces qui partagent le même `MaterialKind` (donc le même
  rendu 3D) n'affichent pas forcément la même vignette dans le nuancier (ex.
  « Béton noir » n'a pas de photo dédiée, contrairement à « Wasterial® -
  Coquilles de moules », qui partage pourtant son profil). Comportement
  hérité et volontairement préservé pendant le refactor matières (contrainte
  « sans changement visuel ») ; la pastille rendue depuis le moteur 3D
  (« Reste ouvert » ci-dessus) réglerait cette incohérence en unifiant tout
  par `MaterialKind`.
- `next lint` est marqué déprécié par Next.js 15.5 (retrait prévu en Next 16) :
  aucun impact aujourd'hui (0 warning), mais la migration vers l'ESLint CLI
  (`npx @next/codemod@canary next-lint-to-eslint-cli .`) devra accompagner un
  futur passage à Next 16.
- Le câble s'étale largement et dicte la largeur de cadrage des packshots, ce
  qui rapetisse la lampe. Le masquer sur les vignettes donnerait un packshot
  plus serré — un paramètre à ajouter à la DA (`config/packshot.ts`).
- La perforation ne couvre aujourd'hui que la tôle en entier. Sur le
  prototype réel, elle s'arrête avant les bords et laisse un liseré plein.
- `EXPLODE_SCALE` et `CAMERA` de la vue éclatée se règlent ensemble : c'est
  documenté dans le code (`components/hero/ExplodedLamp3D.tsx`), mais
  mériterait d'être dérivé automatiquement plutôt que réglé à la main.
- Un second `MaterialKind` inutilisé, dans le même genre que `glassBlue`
  ci-dessus : `blueTerrazzo` (texture `beton-bleute.png`, entrée `COMPOSITE`
  et profil complets, scale=16) n'est référencé par aucune variante de
  `data/product.ts` — repéré pendant le diagnostic de tuilage des textures de
  matière. Pas touché : à trancher à froid (garder pour une future
  configuration, ou supprimer les deux).
- Demande : rendre la lumière du configurateur 3D « un peu moins chaude ».
  Diagnostic fait, pas de correctif appliqué : `defaultKelvin` (2 700 K,
  `data/lampModel.ts`) n'a aucun effet visible sur le rendu extérieur (mesuré
  par diff pixel, y compris à l'extrême 6 500 K — delta < 1/255). La chaleur
  perçue vient très probablement du tone mapping `ACESFilmicToneMapping`
  (réglage par défaut de `@react-three/fiber`, jamais choisi explicitement ici)
  — désactivé (`flat`), le rendu est nettement plus clair et froid sur les
  matières claires (porcelaine, travertin), mais AUSSI plus saturé sur les
  matières vives (brique, bleu), donc pas un simple correctif « moins chaud » :
  ça change le contraste et la saturation globale de toute la scène 3D
  (hero + configurateur + vue éclatée partagent le même Canvas). À rediscuter
  à froid — options possibles : accepter le changement de tone mapping en
  entier, ou retinter plus fort les lumières de studio en gardant ACES.
- **Traçabilité de la suppression de la configuration 07 (« Cobalt »,
  `porcelaine-epoxy-mat`)** : demandée explicitement en conversation
  (« supprime la configuration 07 - Cobalt »), pas déduite. Consignée ici
  après coup, sur demande explicite, pour ne pas dépendre de l'historique de
  conversation comme seule preuve.
- Un troisième `MaterialKind` désormais inutilisé, dans le même genre que
  `glassBlue`/`blueTerrazzo` ci-dessus : `epoxy` (profil complet dans
  `PROFILES`) n'est plus référencé par aucune variante de `data/product.ts`
  depuis la suppression de la configuration 07 ci-dessus, qui était sa seule
  utilisatrice. Pas touché : conservé comme matière de catalogue disponible
  pour une future configuration plutôt que supprimé — à trancher à froid, en
  même temps que `glassBlue`/`blueTerrazzo`.

### Mise en ligne du 30/08/2026 — vu, non traité

Relevé pendant la bascule sur `noirmineral.studio`, laissé de côté par
périmètre. Rien de tout cela n'est corrigé.

- **Les assets chargés hors de Next ne préfixent pas `basePath`** : le GLB
  (`data/lampModel.ts`), les douze textures (`lib/lampTextures.ts`) et les
  images passées à `next/image` en mode `unoptimized` s'écrivent en chemins
  absolus. Sous un sous-chemin, ils répondent 404 — c'est ce qui a tué le site
  sur GitHub Pages. À la racine du domaine, le problème ne se voit plus, mais le
  défaut est intact et ressortirait au premier déploiement sous sous-chemin.
- **Aucune barrière d'erreur autour des scènes 3D.** `useGLTF` lève quand un
  fichier manque, rien ne l'attrape, React démonte tout l'arbre : un seul asset
  absent et il n'y a plus de site du tout. Le filet posé plus tôt couvre la
  PERTE de contexte WebGL, pas l'ÉCHEC DE CHARGEMENT — deux chemins différents
  vers le même écran vide.
- **Le projet Supabase gratuit s'endort après sept jours d'inactivité.** C'est
  ce qui a mis le formulaire hors service. Une sonde périodique (workflow
  planifié + branche de vivacité protégée par jeton dans la fonction) a été
  conçue en détail mais non posée. Sans elle, la panne reviendra — a fortiori
  derrière un QR code imprimé.
- **Aucun garde-fou ne protège l'endpoint de contact ni le rendu.** Trois
  contrôles ont été spécifiés, aucun écrit : validation de forme de
  `NEXT_PUBLIC_CONTACT_ENDPOINT` au build en CI, extension du test d'existence
  d'assets au GLB et aux images de composants, et surtout un test de fumée sur
  `out/` qui échouerait sur un 404 ou une exception — le seul des trois qui
  aurait attrapé la panne du 30/08.
- **`CONTACT_FROM_EMAIL` n'a pas de `Reply-To`.** Les notifications partent de
  `contact@noirmineral.studio`, qui n'est pas une boîte : répondre directement
  au courriel écrirait dans le vide. Poser `Reply-To` sur l'adresse du visiteur
  rendrait la réponse possible d'un clic.
- **`trailingSlash` et `PAGES_BASE_PATH` n'ont plus d'objet** depuis le retrait
  de GitHub Pages. Inoffensifs, donc laissés : c'est du nettoyage.

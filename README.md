# Noir Minéral — landing page produit

Landing page mono-page pour la lampe sculpturale **Noir Minéral**, pensée pour
les visiteurs qui scannent un QR code près de la lampe physique : comprendre
l'objet en cinq secondes, le personnaliser en un geste, puis passer à l'action.

> « La lumière prend position. »

---

## 1. Direction artistique

Univers **pop & moderne**, à l'échelle et au contraste (inspiration : agences
récompensées sur Awwwards, type REF Digital — noir + neutre, typographie massive,
motion cinétique).

- **Noir minéral dominant** + fond neutre chaud (`#eceae3`) : contraste fort,
  bandes noires d'impact.
- **Accent électrique unique** — le bleu du câble poussé (`#2a3fe6`) : titres,
  sélection, boutons pilule, séparateurs du marquee.
- Typographie **Bricolage Grotesque** (display, 800, capitales, très serrée) +
  **Inter** (interface), via `next/font` (auto-hébergées, `display: swap`).
- Titres surdimensionnés, **bande kinétique (marquee)**, wordmark d'impact en
  pied de page, boutons **pilule**, états de sélection en cobalt.
- Mouvements courts en `transform`/`opacity`, marquee inclus, respectant
  `prefers-reduced-motion` (animations coupées, marquee scrollable).
- Micro-texture très discrète (CSS uniquement, aucune image distante).

## 2. Stack technique

- **Next.js 15** (App Router) · **React 19** · **TypeScript strict**
- **Tailwind CSS v4** (tokens via `@theme` dans `app/globals.css`)
- **Framer Motion** pour les animations utiles
- **three.js + @react-three/fiber + @react-three/drei** pour la 3D du hero
  (chargés à la demande, code-splittés hors du bundle initial)
- `next/image` (formats AVIF/WebP, dimensions intrinsèques → pas de CLS)
- **Vitest** + Testing Library pour les tests
- **sharp** (dev) pour la découpe des visuels · **occt-import-js** +
  **@gltf-transform** (dev) pour la conversion CAO → GLB

## 3. Structure

```
app/
  layout.tsx          Métadonnées, polices, JSON-LD Organization, skip-link
  page.tsx            Composition des sections
  globals.css         Design system (tokens @theme, base, utilities)
  api/lead/route.ts   Réception des demandes (validation serveur + mode démo)
  sitemap.ts, robots.ts
components/
  hero/               Hero multi-angle + animation de composition en 3 parties
  configurator/       Configurateur (groupe radio accessible)
  product-story/      ProductStory, Materials, Details, Reassurance
  order/              OrderSection, LeadForm, StickyCta (mobile)
  ui/                 Button, Reveal
  SelectionProvider   État partagé (variante sélectionnée, quantité)
  Analytics, SiteHeader, SiteFooter
config/site.ts        ⚙️ Configuration commerciale centrale (voir §5)
data/product.ts       📦 Données produit : 7 configurations, specs, visuels
lib/                  analytics.ts, validation.ts, scroll.ts
public/images/        variants/ · prototype/ · og.webp   (générés, voir §4)
scripts/              prepare-assets.mjs (découpe), dims.mjs
tests/                validation · product/CTA · selection (résumé)
```

## 4. Assets

Les visuels proviennent des deux planches fournies par l'atelier, conservées
dans `../Etnisi/` :

- `Capture d'écran 2026-07-23 192037.png` — planche des 6 variantes
- `Capture d'écran 2026-07-23 192123.png` — photos du prototype + vue éclatée

Le script les découpe en visuels individuels optimisés (WebP) :

```bash
npm run assets
```

→ `public/images/variants/*.webp`, `public/images/prototype/*.webp`,
`public/images/og.webp`. Les originaux ne sont jamais modifiés.

### Améliorer l'animation du hero

L'animation de composition décompose visuellement la lampe en **trois parties**
(abat-jour → assemblage → pied) qui changent de matière avec un léger décalage
temporel. Faute de calques détourés, l'effet s'appuie sur :

- un **fondu croisé** entre les visuels des 7 configurations, et
- trois **pastilles de matière** (abat-jour / assemblage / pied) qui se mettent
  à jour en séquence.

Pour un effet « pièce par pièce » encore plus littéral, fournir **trois PNG
détourés alignés au pixel** par variante (abat-jour, pièce d'assemblage, pied) :
ils pourraient alors être superposés en calques et animés indépendamment
(`opacity` / `mask-image`). Brancher ces fichiers dans `data/product.ts`.

## 5. Configuration commerciale (`config/site.ts`)

Tout est centralisé ici. **Aucune donnée produit n'est inventée** ailleurs.

| Champ | Rôle |
|---|---|
| `productName`, `brandName`, `baseline` | Identité |
| `price`, `currency` | Prix. `null` → affiché « Sur demande », pas de JSON-LD Offer |
| `purchaseMode` | `"checkout"` \| `"preorder"` \| `"inquiry"` — pilote le CTA final |
| `checkoutUrl` | URL de paiement (requis si `checkout`) |
| `contactEmail`, `instagramUrl` | Contact / réseaux |
| `legalNoticeUrl`, `privacyUrl` | Pages légales (sinon « à venir ») |
| `leadEndpoint` | API recevant les demandes. `null` → **mode démonstration** |
| `analyticsProvider`, `analyticsId` | `plausible` \| `matomo` \| `ga` \| `none` |
| `siteUrl` | URL canonique de production |

**Comportement du CTA selon `purchaseMode`** :

- `checkout` → « Commander cette lampe » (lien vers `checkoutUrl`, variante jointe)
- `preorder` → « Réserver cette configuration » (formulaire)
- `inquiry` → « Demander cette configuration » (formulaire) — **valeur par défaut**

**Mode démonstration** : sans `leadEndpoint`, le formulaire valide la saisie mais
n'envoie rien. Le visiteur voit un message honnête indiquant que l'envoi n'est
pas encore activé (il ne croit jamais que sa demande a été transmise), et un
rappel discret est affiché pour le développeur.

### Paiement Stripe (préparé, non branché)

Passer `purchaseMode: "checkout"` et renseigner `checkoutUrl` avec un lien
Stripe Checkout (créé côté serveur / dashboard). **Aucune clé secrète n'est
présente côté client.** Pour une intégration dynamique, créer une route serveur
`app/api/checkout/route.ts` qui crée la session Stripe et renvoie l'URL.

## 6. Analytics

Module neutre (`lib/analytics.ts`) — événements : `qr_landing_view`,
`hero_cta_click`, `configurator_started`, `material_variant_selected`,
`order_cta_click`, `lead_form_started`, `lead_form_submitted`.
Le site reste 100 % fonctionnel **sans** outil configuré. Le paramètre d'URL
`?source=qr` est capté et joint aux événements et aux demandes.

## 7. Accessibilité & performance

- WCAG 2.2 AA visé : structure sémantique, skip-link, focus visible, groupe
  radio natif (navigation flèches), `aria-live` sur les résumés, messages
  d'erreur explicites, contrastes, aucune information portée par la seule couleur.
- `prefers-reduced-motion` : boucle du hero désactivée, transitions coupées,
  changement de variante manuel via les puces.
- Images dimensionnées (pas de CLS), image du hero priorisée, JS initial contenu,
  animations `transform`/`opacity`.

## 8. Développement

```bash
npm install
npm run assets     # génère les visuels depuis ../Etnisi (une fois)
npm run dev        # http://localhost:3000
```

Qualité :

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 9. Déploiement (Vercel)

1. Pousser le dossier `etnisi-site/` sur un dépôt Git.
2. Importer le projet sur **Vercel** (framework Next.js détecté automatiquement).
3. Renseigner `siteConfig.siteUrl` avec le domaine de production, puis les autres
   champs de `config/site.ts` (contact, mode commercial, analytics, leadEndpoint).
4. Déployer. Les visuels de `public/images` sont versionnés ; `npm run assets`
   n'est nécessaire que si les planches sources changent.

> Alternative : `vercel` CLI depuis `etnisi-site/`.

## 10. URL du QR code

Encoder dans le QR code, une fois le domaine configuré :

```
https://VOTRE-DOMAINE/?source=qr
```

Le paramètre `?source=qr` identifie la provenance sans rien exiger du visiteur.

## 11. Reproduction 3D du hero (pipeline CAO → GLB)

Le hero intègre une **reproduction 3D fidèle** de la lampe, issue des fichiers
CAO fournis, et non de formes primitives.

### Fichiers sources et lisibilité

| Fichier | Format | Exploitable ? |
|---|---|---|
| `lampe2a/b/c.IGS` | IGES ASCII (SolidWorks, mm) | **Oui** — surfaces analytiques, tessellables |
| `lampe2 copie.SLDASM`, `petit copie.SLDPRT`, `grand.SLDPRT`, `ampoule2.SLDPRT` | SolidWorks binaire | Non sans SolidWorks |
| `petit.SLDDRW` | Mise en plan SolidWorks | Non (2D) |
| `LampesFragment.bip` | Backup KeyShot/Luxion | Non sans KeyShot |

Seul l'**IGES** est nécessaire. Les trois `.IGS` sont le même modèle à trois
orientations de l'abat-jour ; `lampe2a.IGS` sert de source (copiée dans
`cad-sources/`, jamais modifiée).

### Conversion

```bash
npm run cad   # cad-sources/lampe2a.IGS → public/models/lampe-optimisee.glb
```

`scripts/convert-cad.mjs` utilise **occt-import-js** (OpenCASCADE en WebAssembly)
pour tesseller l'IGES, découpe les volumes en **composantes connexes**, les
classe sémantiquement, met à l'échelle (mm→m), centre, puis écrit un GLB
optimisé (~225 Ko) avec **@gltf-transform**.

### Structure du modèle (noms de meshes réels)

Le GLB contient cinq nœuds nommés, mappés dans `data/lampModel.ts`
(`lampMeshMapping`) — les noms ont été **vérifiés à l'inspection**, pas supposés :

| Nœud GLB | Rôle | Source IGES |
|---|---|---|
| `Shade` | Abat-jour | composante centrale de « grand » |
| `Connector` | Pièce métallique | composante médiane de « petit » |
| `Base` | Pied | composante basse de « petit » |
| `Cable` | Câble | composante éloignée de « grand » |
| `Bulb` | Ampoule | « ampoule2 » |

> La pièce métallique perforée (grille) n'est pas modélisée séparément dans la
> CAO : `Connector` correspond au collier de douille. Pour un rendu encore plus
> fidèle de la grille, fournir un IGES/STEP dédié et l'ajouter au pipeline.

### Comportement

- Rotation horizontale légère (turntable), plusieurs angles.
- Les matériaux de l'abat-jour, de la pièce métallique et du pied changent
  **séparément** (décalage temporel), pilotés par les variantes.
- Synchronisation **bidirectionnelle** avec le configurateur.
- **Matières texturées** par configuration (`lib/lampTextures.ts`), inspirées de
  la planche : porcelaine/béton mouchetés, brique mate, verre semi-brillant,
  nacre irrégulière, métal anodisé. Le GLB n'ayant pas d'UV, le grain est
  procédural en **triplanar object-space** (injecté dans le shader) — sans
  couture, stable en rotation, et **auto-généré** (aucune image distante). Le
  profil (`materialProfile`) est déduit du libellé de la matière.
  - Cas particulier **Brique** : matière **terre cuite** dédiée (texture couleur
    mouchetée 512² sRGB générée en canvas, échantillonnée en triplanar, mate,
    relief très discret) — activée par l'uniforme `uTerracotta` **uniquement**
    pour l'abat-jour de la variante *Brique — Aluminium*, les autres variantes
    étant inchangées.

### Éclairage (la lampe semble allumée)

Paramètres centralisés dans `data/lampModel.ts` → `lampLightConfig`. Les lumières
sont **enfants du groupe** : elles suivent la lampe quand elle tourne.

- `SpotLight` doux (cône large, pénombre élevée) partant de l'**ampoule** et
  orienté selon l'**axe d'ouverture réel** de l'abat-jour (calculé depuis la
  géométrie : douille → abat-jour).
- `PointLight` faible pour la diffusion intérieure ; ampoule `emissive` discrète.
- **Transmission par matière** approchée (`shadeTransmission`) : le verre laisse
  passer un peu de lumière, la brique reste opaque — la couleur de la lumière
  ne change pas, seul son passage varie.
- **Allumage progressif** au chargement (~900 ms) et interpolation douce au
  changement de variante (pas de clignotement) ; coupés en `prefers-reduced-motion`.
- Blanc chaud **visuel** (aucune valeur en kelvin affichée — pas une donnée
  produit). Ombres dynamiques désactivées par défaut (`shadows: false`) pour le
  mobile ; réactivables via la config.
- Chargée **à la demande** (three.js hors du bundle initial, First Load ~161 kB).
- **Repli photo** immédiat (LCP) et automatique si WebGL absent ou
  `prefers-reduced-motion` actif. Éclairage procédural (RoomEnvironment), aucun
  asset distant.

## 13. Informations produit restant à renseigner (TODO)

Centralisées, jamais inventées. Voir les commentaires `TODO` dans le code :

- `config/site.ts` : `price`, `checkoutUrl`, `contactEmail` (réel), `instagramUrl`,
  `legalNoticeUrl`, `privacyUrl`, `leadEndpoint`, `analytics*`, `siteUrl`.
- `data/product.ts` (`productSpecs`) : **dimensions**, **source lumineuse**,
  **alimentation**, **poids**, **délai**, **disponibilité** — affichés
  « Information à venir » tant qu'ils sont `null`.

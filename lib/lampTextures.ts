/**
 * Matières procédurales pour la lampe 3D, inspirées de la planche des variantes.
 *
 * Le GLB issu de la CAO n'a pas de coordonnées UV : on applique donc un grain
 * en **triplanar object-space** (injecté dans le shader), sans couture ni UV,
 * et stable quand la lampe tourne. Le grain module la rugosité + un léger
 * moucheté d'albédo → rendu tactile (porcelaine, béton, brique, nacre…).
 *
 * Aucune image distante : la texture de bruit est générée en canvas.
 */
import * as THREE from "three";
import type { PerforationShape, MaterialKind } from "@/data/product";

// Réexporté : `data/product.ts` est la source de vérité du type (voir
// CLAUDE.md), mais les profils de rendu qu'il indexe vivent ici.
export type { MaterialKind };

export interface MaterialProfile {
  kind: MaterialKind;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  /** Fréquence du grain (répétitions/mètre en espace objet). */
  grainScale: number;
  /** Amplitude de modulation de la rugosité. */
  grainRough: number;
  /** Moucheté d'albédo. */
  speckle: number;
  /** Relief (perturbation de normale) — donne le tissage visible du câble. */
  grainBump: number;
  /**
   * Part de lumière « traversant » la matière (0 = opaque, 1 = transparent).
   * N'a d'effet visible que sur l'abat-jour (voir `shadeTransmission` dans
   * `data/lampModel.ts`) ; renseigné pour toutes les matières par cohérence
   * du profil.
   */
  transmission: number;
}

const PROFILES: Record<MaterialKind, Omit<MaterialProfile, "kind">> = {
  // grainBump reste à 0 pour les matières au bruit (le relief exploserait) ;
  // seul le câble (motif de tissage structuré) reçoit du relief.
  porcelain: { roughness: 0.88, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, grainScale: 10, grainRough: 0.45, speckle: 0.3, grainBump: 0, transmission: 0.45 },
  concrete: { roughness: 0.94, metalness: 0, clearcoat: 0.04, clearcoatRoughness: 0.8, grainScale: 9, grainRough: 0.55, speckle: 0.42, grainBump: 0, transmission: 0.08 },
  // brick : la couleur/le grain viennent de la texture terre cuite (composite).
  brick: { roughness: 0.9, metalness: 0, clearcoat: 0.03, clearcoatRoughness: 0.8, grainScale: 22, grainRough: 0.14, speckle: 0.04, grainBump: 0, transmission: 0.08 },
  // shell : composite mat (couleur/grain via la texture coquilles, uComposite).
  shell: { roughness: 0.9, metalness: 0, clearcoat: 0.03, clearcoatRoughness: 0.8, grainScale: 20, grainRough: 0.14, speckle: 0.04, grainBump: 0, transmission: 0.25 },
  // Verre de bouteille (d'après la texture fournie) : composite de verre
  // recyclé vert foncé — couleur via la texture (uComposite), mat/légèrement
  // satiné, AUCUN relief.
  glassBottle: { roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.45, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0, transmission: 1 },
  glassBlue: { roughness: 0.42, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3, grainScale: 11, grainRough: 0.28, speckle: 0.28, grainBump: 0, transmission: 0.08 },
  // Verre bleu (d'après la texture fournie) : navy dense grisé, mat, très
  // légèrement satiné, fines inclusions claires — couleur via la texture
  // composite (uComposite), AUCUN relief.
  blueGlass: { roughness: 0.82, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0, transmission: 0.08 },
  // Béton bleuté (d'après la texture fournie) : composite de verre bleu recyclé
  // concassé (éclats bleus + inclusions noires), mat/légèrement satiné, couleur
  // via la texture composite, AUCUN relief.
  blueTerrazzo: { roughness: 0.8, metalness: 0, clearcoat: 0.07, clearcoatRoughness: 0.55, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0, transmission: 0.08 },
  epoxy: { roughness: 0.5, metalness: 0.08, clearcoat: 0.25, clearcoatRoughness: 0.45, grainScale: 14, grainRough: 0.2, speckle: 0.18, grainBump: 0, transmission: 0.08 },
  metal: { roughness: 0.34, metalness: 0.92, clearcoat: 0.1, clearcoatRoughness: 0.3, grainScale: 40, grainRough: 0.14, speckle: 0.0, grainBump: 0, transmission: 0.08 },
  // Béton noir : couleur via la texture (composite), très mat, AUCUN relief.
  blackConcrete: { roughness: 0.92, metalness: 0, clearcoat: 0.03, clearcoatRoughness: 0.85, grainScale: 20, grainRough: 0, speckle: 0, grainBump: 0, transmission: 0.08 },
  // Travertin beige (pied, config 02) : couleur/pores via la texture (composite),
  // légèrement mat comme une pierre naturelle poncée — pas de relief procédural
  // en plus de l'image, qui porte déjà les pores.
  travertine: { roughness: 0.78, metalness: 0, clearcoat: 0.04, clearcoatRoughness: 0.75, grainScale: 16, grainRough: 0.1, speckle: 0.03, grainBump: 0, transmission: 0.08 },
  // Acier corten (assemblage, config 03) : la couche d'oxyde de surface est
  // DIÉLECTRIQUE, pas métallique — surtout pas le profil `metal` (metalness
  // 0,92), qui donnerait une rouille chromée. metalness bas, couleur/grain via
  // la texture (composite), AUCUN relief ajouté (l'image porte déjà le sien).
  corten: { roughness: 0.85, metalness: 0.12, clearcoat: 0.03, clearcoatRoughness: 0.8, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0, transmission: 0.08 },
  // Métal rouillé (douille, config 03) : contrairement au corten, LE SUPPORT
  // reste un métal (aluminium) sous l'oxydation — metalness intermédiaire, ni
  // le métal propre (0,92) ni l'oxyde pur du corten (0,12). Valeurs de départ,
  // à ajuster à l'œil : couleur/grain via la texture (composite), AUCUN
  // relief ajouté (l'image porte déjà le sien).
  rustedMetal: { roughness: 0.6, metalness: 0.5, clearcoat: 0.03, clearcoatRoughness: 0.7, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0, transmission: 0.08 },
  // Sable de fonderie (pied, config 02) : agrégat minéral moulé et démoulé —
  // mat, granuleux, aucun poli. Couleur/grain via la texture (composite),
  // AUCUN relief ajouté (l'image porte déjà le sien, comme le travertin
  // qu'elle remplace).
  foundrySand: { roughness: 0.86, metalness: 0, clearcoat: 0.03, clearcoatRoughness: 0.82, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0, transmission: 0.08 },
  // Gaine textile du câble : tissage plat fin (chaîne/trame), mat, relief
  // discret — évoque un câble gainé de tissu haut de gamme sans excès.
  fabric: { roughness: 0.82, metalness: 0, clearcoat: 0.04, clearcoatRoughness: 0.8, grainScale: 60, grainRough: 0.4, speckle: 0.12, grainBump: 0.32, transmission: 0.08 },
  matte: { roughness: 0.75, metalness: 0, clearcoat: 0.05, clearcoatRoughness: 0.7, grainScale: 11, grainRough: 0.32, speckle: 0.3, grainBump: 0, transmission: 0.08 },
};

/** Profil matière d'un `MaterialKind` — accès table directe, sans détection. */
export function materialProfile(kind: MaterialKind): MaterialProfile {
  return { kind, ...PROFILES[kind] };
}

/**
 * Anisotropie appliquée aux textures d'IMAGE (pas au bruit/tissage procédural,
 * hors périmètre). 8 en repli avant qu'un renderer ait été vu — remplacé par
 * le vrai maximum matériel dès le premier `onBeforeCompile` (voir
 * `applyMaxAnisotropy`, qui reçoit le renderer et met aussi à jour les
 * textures déjà en cache). C'est à l'intérieur de l'abat-jour, vu en biais,
 * que ça compte : l'empreinte du texel s'y étire et un plafond bas y fait
 * chuter le ratio effectif bien en dessous de sa valeur frontale.
 */
let maxAnisotropy = 8;

/** Textures d'image déjà en cache — pour rattraper celles créées avant le
 *  premier appel à `applyMaxAnisotropy` (l'ordre de montage n'est pas garanti
 *  matériau par matériau). Le bruit/tissage procédural n'y figure pas. */
function cachedImageTextures(): THREE.Texture[] {
  return [
    terraTex, shellTex, bottleTex, blackTex, blueTex,
    blueTerrazzoTex, woodTex, travertineTex, renatureTex, cortenTex, rustedMetalTex,
    foundrySandTex,
  ].filter((t): t is THREE.Texture => t !== null);
}

/** Capture le vrai maximum d'anisotropie de l'appareil (au lieu d'une valeur
 *  arbitraire en dur) et le réapplique aux textures déjà créées. */
function applyMaxAnisotropy(renderer: THREE.WebGLRenderer) {
  const real = renderer.capabilities.getMaxAnisotropy();
  if (real === maxAnisotropy) return;
  maxAnisotropy = real;
  for (const tex of cachedImageTextures()) tex.anisotropy = maxAnisotropy;
}

/**
 * Réglages communs des textures issues d'IMAGES (baseColor). Tiling en
 * RÉPÉTITION simple (pas de miroir — voir ÉTAPE 2a de l'échange sur le
 * tuilage) : le miroir crée des rosaces symétriques visibles au centre de
 * l'abat-jour, un artefact plus gênant que la couture qu'il évite. Si une
 * couture apparaît avec la répétition simple, la source n'est pas tileable —
 * à corriger sur l'image, pas en revenant au miroir.
 */
function configureImageTexture(tex: THREE.Texture) {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace; // couleurs fidèles à l'image
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy;
}

/**
 * Générateur pseudo-aléatoire SEMÉ (mulberry32), déterministe : à graine
 * identique, produit exactement la même séquence de nombres à chaque appel —
 * donc des textures procédurales reproductibles À L'OCTET PRÈS d'une
 * exécution à l'autre. Remplace `Math.random()` dans tout ce fichier ; ne
 * jamais en réintroduire un appel brut ici, sous peine de re-rendre les
 * vignettes packshot non déterministes (voir le garde-fou de
 * tests/packshot-manifest.test.ts, qui fige leur empreinte).
 *
 * Chaque texture reçoit son propre flux (GRAIN_SEED + décalage constant),
 * jamais un flux global partagé : deux matières différentes ne doivent pas
 * reproduire le même motif de bruit sous des amplitudes différentes.
 */
const GRAIN_SEED = 0x9e3779b9;

function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function seededRandom() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* --- Texture de bruit (value noise + moucheté), générée une fois --- */
let noiseTex: THREE.Texture | null = null;

function makeNoiseTexture(): THREE.Texture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const rand = createSeededRandom(GRAIN_SEED + 1);

  // Bruit de valeur *multi-octave*, tileable (grilles bouclées) → une texture
  // qui se LIT : marbrures basse fréquence + grain fin. Plus qu'un simple
  // dither, sinon la matière paraît lisse une fois éclairée.
  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n, fy = v * n;
    const x0 = ((Math.floor(fx) % n) + n) % n;
    const y0 = ((Math.floor(fy) % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  // Octaves : marbrure (8), grain moyen (32), grain fin (96).
  const g8 = makeGrid(8), g32 = makeGrid(32), g96 = makeGrid(96);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      // fBm : les basses fréquences dominent (marbrures lisibles) + grain.
      let val =
        sample(g8, 8, u, v) * 0.5 +
        sample(g32, 32, u, v) * 0.32 +
        sample(g96, 96, u, v) * 0.18;
      // contraste renforcé pour que le grain reste visible sous la lumière
      val = 0.5 + (val - 0.5) * 1.7;
      const p = (y * S + x) * 4;
      const g = Math.max(0, Math.min(255, val * 255));
      img.data[p] = img.data[p + 1] = img.data[p + 2] = g;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

function getNoiseTexture(): THREE.Texture {
  if (!noiseTex) noiseTex = makeNoiseTexture();
  return noiseTex;
}

/* --- Texture textile (câble), générée une fois --- */
let weaveTex: THREE.Texture | null = null;

/**
 * Gaine textile du câble — tissage PLAT chaîne/trame (armure toile), inspiré
 * d'une référence photo de tissu clair à grain fin et régulier. Motif MACRO
 * (fils) exactement périodique — `period` divise `S` sans reste, donc AUCUNE
 * couture avec `RepeatWrapping`. Le grain fin des fibres utilise une grille de
 * bruit bouclée + bilinéaire (même technique que les autres textures de ce
 * fichier), donc elle aussi sans couture. Uniquement du niveau de gris : cette
 * texture ne sert que de DÉTAIL (relief/rugosité/moucheté) dans le shader —
 * jamais de couleur — la teinte du câble reste celle de `applyProfile`.
 */
function makeWeaveTexture(): THREE.Texture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const rand = createSeededRandom(GRAIN_SEED + 2);

  const threadsPerTile = 16; // tissage fin (16 fils/tuile)
  const period = S / threadsPerTile; // 16 px — divise S exactement

  // Grain fin des fibres, tileable (grille bouclée + bilinéaire).
  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n, fy = v * n;
    const x0 = ((Math.floor(fx) % n) + n) % n;
    const y0 = ((Math.floor(fy) % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  const gFiber = makeGrid(48);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Profil arrondi de chaque fil (chaîne verticale, trame horizontale).
      const warp = 1 - Math.abs(((x % period) / period) - 0.5) * 2;
      const weft = 1 - Math.abs(((y % period) / period) - 0.5) * 2;
      // Armure toile : alternance stricte dessus/dessous à chaque croisement.
      const cellX = Math.floor(x / period);
      const cellY = Math.floor(y / period);
      const warpOnTop = ((cellX + cellY) & 1) === 0;
      const v = warpOnTop
        ? Math.max(warp * 0.92, weft * 0.42)
        : Math.max(weft * 0.92, warp * 0.42);
      // Irrégularité naturelle des fibres — discrète, jamais dominante.
      const fiber = sample(gFiber, 48, x / S, y / S);
      const g = Math.max(
        0,
        Math.min(255, (0.4 + v * 0.48 + (fiber - 0.5) * 0.1) * 255)
      );
      const p = (y * S + x) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = g;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/** Texture de gaine textile du câble — MISE EN CACHE et PARTAGÉE entre les
 *  scènes (Hero et vue éclatée appellent tous deux cette même fonction ; la
 *  texture n'est générée qu'une seule fois, jamais dupliquée). */
export function getWeaveTexture(): THREE.Texture {
  if (!weaveTex) weaveTex = makeWeaveTexture();
  return weaveTex;
}

/* --- Texture terre cuite (variante Brique), générée une fois --- */
let terraTex: THREE.Texture | null = null;

function makeTerracottaTexture(): THREE.Texture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const rand = createSeededRandom(GRAIN_SEED + 3);

  // Bruit de valeur lissé et *tileable* (grille bouclée) → pas de couture.
  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n, fy = v * n;
    const x0 = ((Math.floor(fx) % n) + n) % n;
    const y0 = ((Math.floor(fy) % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  const g6 = makeGrid(6), g16 = makeGrid(16), g48 = makeGrid(48), g128 = makeGrid(128);

  // Palette terre cuite (inspirée de la référence : mate, minérale).
  const dark = [0x8c, 0x3f, 0x2a];
  const light = [0xbe, 0x6b, 0x4d];
  const brown = [0x93, 0x50, 0x2f];
  const mix = (a: number[], b: number[], t: number) => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      // mottle basse fréquence
      const m1 = sample(g6, 6, u, v) * 0.6 + sample(g16, 16, u, v) * 0.4;
      const m2 = sample(g16, 16, u + 0.37, v + 0.11);
      const grain = sample(g48, 48, u, v) * 0.7 + sample(g128, 128, u, v) * 0.3;
      let col = mix(dark, light, Math.min(1, Math.max(0, m1)));
      col = mix(col, brown, m2 * 0.55);
      // granularité minérale nette (visible), sans point sombre marqué
      const g = (grain - 0.5) * 16;
      const p = (y * S + x) * 4;
      img.data[p] = Math.max(0, Math.min(255, col[0] + g));
      img.data[p + 1] = Math.max(0, Math.min(255, col[1] + g));
      img.data[p + 2] = Math.max(0, Math.min(255, col[2] + g));
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // (Pas d'inclusions sombres : elles se lisaient comme des trous.)

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Chemin de l'IMAGE réelle fournie pour « Brique ». Utilisée TELLE QUELLE comme
 * baseColor : aucune retouche (couleur/contraste/saturation/luminosité), aucune
 * recréation. Seuls l'échelle (uCompositeScale) et le placage triplanar (UV
 * object-space) sont adaptés ; AUCUN relief.
 */
const BRICK_URL = "/textures/brique.png";

function getTerracottaTexture(): THREE.Texture {
  if (terraTex) return terraTex;
  const tex = new THREE.TextureLoader().load(
    BRICK_URL,
    undefined,
    undefined,
    () => {
      // Repli TEMPORAIRE si l'image n'est pas encore déposée ; remplacé par
      // l'image réelle dès qu'elle est présente.
      const fb = makeTerracottaTexture() as THREE.CanvasTexture;
      tex.image = fb.image as unknown as HTMLImageElement;
      tex.needsUpdate = true;
      fb.dispose();
    }
  );
  configureImageTexture(tex);
  terraTex = tex;
  return tex;
}

/* --- Texture composite coquilles d'huîtres (variante Coquilles), une fois --- */
let shellTex: THREE.Texture | null = null;

function makeShellTexture(): THREE.Texture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const rand = createSeededRandom(GRAIN_SEED + 4);

  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n, fy = v * n;
    const x0 = ((Math.floor(fx) % n) + n) % n;
    const y0 = ((Math.floor(fy) % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  const g6 = makeGrid(6), g16 = makeGrid(16), g48 = makeGrid(48), g128 = makeGrid(128);

  // Base vert olive (mate) avec variations naturelles de teinte.
  const dark = [0x4a, 0x52, 0x33];
  const light = [0x6f, 0x74, 0x4c];
  const khaki = [0x62, 0x63, 0x3d];
  const mix = (a: number[], b: number[], t: number) => [
    a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const m1 = sample(g6, 6, u, v) * 0.6 + sample(g16, 16, u, v) * 0.4;
      const m2 = sample(g16, 16, u + 0.29, v + 0.51);
      const grain = sample(g48, 48, u, v) * 0.7 + sample(g128, 128, u, v) * 0.3;
      let col = mix(dark, light, Math.min(1, Math.max(0, m1)));
      col = mix(col, khaki, m2 * 0.5);
      const g = (grain - 0.5) * 16;
      const p = (y * S + x) * 4;
      img.data[p] = Math.max(0, Math.min(255, col[0] + g));
      img.data[p + 1] = Math.max(0, Math.min(255, col[1] + g));
      img.data[p + 2] = Math.max(0, Math.min(255, col[2] + g));
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Fines particules (coquilles broyées) réparties aléatoirement, tileables.
  // Inclusions claires à moyennes uniquement (pas de tons quasi-noirs qui se
  // liraient comme des trous).
  const fleckColors = [
    "#e4ddc8", "#efe9d6", "#c9b46a", "#9aa06e", "#8f7a4e", "#a89a72", "#9c9a8b",
  ];
  const drawFleck = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        if (dx !== 0 && Math.abs(x + dx - S / 2) > S / 2 + r) continue;
        if (dy !== 0 && Math.abs(y + dy - S / 2) > S / 2 + r) continue;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 520; i++) {
    drawFleck(
      rand() * S,
      rand() * S,
      0.5 + rand() * 2.0,
      fleckColors[(rand() * fleckColors.length) | 0],
      0.3 + rand() * 0.35
    );
  }
  // Quelques stries fibreuses très discrètes.
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = rand() > 0.5 ? "#d8d2bf" : "#6a6248";
    ctx.globalAlpha = 0.08 + rand() * 0.1;
    const x = rand() * S, y = rand() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 40, x + (rand() - 0.5) * 70, y + (rand() - 0.5) * 70);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Chemin de l'IMAGE réelle fournie pour « Coquilles d'huîtres ». Utilisée TELLE
 * QUELLE comme baseColor : aucune retouche (couleur/contraste/saturation/
 * luminosité), aucune recréation. Seuls l'échelle (uCompositeScale) et le
 * placage triplanar (UV object-space) sont adaptés ; AUCUN relief.
 */
const SHELL_URL = "/textures/coquilles-huitres.png";

function getShellTexture(): THREE.Texture {
  if (shellTex) return shellTex;
  const tex = new THREE.TextureLoader().load(
    SHELL_URL,
    undefined,
    undefined,
    () => {
      // Repli TEMPORAIRE si l'image n'est pas encore déposée ; remplacé par
      // l'image réelle dès qu'elle est présente.
      const fb = makeShellTexture() as THREE.CanvasTexture;
      tex.image = fb.image as unknown as HTMLImageElement;
      tex.needsUpdate = true;
      fb.dispose();
    }
  );
  configureImageTexture(tex);
  shellTex = tex;
  return tex;
}

/* --- Texture verre de bouteille (variante Verre de bouteille), IMAGE réelle --- */
let bottleTex: THREE.Texture | null = null;
/**
 * Chemin de l'IMAGE réelle fournie pour « Verre de bouteille ». Utilisée TELLE
 * QUELLE comme baseColor : aucune retouche (couleur/contraste/saturation/
 * luminosité), aucune recréation. Seuls l'échelle (uCompositeScale) et le
 * placage triplanar (UV object-space, tiling miroir) sont adaptés ; AUCUN relief.
 */
const BOTTLE_URL = "/textures/verre-bouteille.png";

function getBottleGlassTexture(): THREE.Texture {
  if (bottleTex) return bottleTex;
  const tex = new THREE.TextureLoader().load(
    BOTTLE_URL,
    undefined,
    undefined,
    () => {
      // Repli minimal (vert bouteille) si le fichier n'est pas encore présent.
      const c = document.createElement("canvas");
      c.width = c.height = 4;
      const g = c.getContext("2d")!;
      g.fillStyle = "#243524";
      g.fillRect(0, 0, 4, 4);
      tex.image = c as unknown as HTMLImageElement;
      tex.needsUpdate = true;
    }
  );
  configureImageTexture(tex);
  bottleTex = tex;
  return tex;
}

/* --- Texture béton noir (Noir mat / Béton noir), générée une fois --- */
let blackTex: THREE.Texture | null = null;

function makeBlackConcreteTexture(): THREE.Texture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const rand = createSeededRandom(GRAIN_SEED + 5);

  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n, fy = v * n;
    const x0 = ((Math.floor(fx) % n) + n) % n;
    const y0 = ((Math.floor(fy) % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  const g8 = makeGrid(8), g24 = makeGrid(24), g96 = makeGrid(96);

  // Noir profond avec très légères nuances (mate, sobre).
  const dark = [0x0e, 0x0e, 0x10];
  const light = [0x20, 0x20, 0x24];
  const mix = (a: number[], b: number[], t: number) => [
    a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const m = sample(g8, 8, u, v) * 0.6 + sample(g24, 24, u, v) * 0.4;
      const grain = sample(g96, 96, u, v);
      const col = mix(dark, light, Math.min(1, Math.max(0, m)));
      const g = (grain - 0.5) * 6;
      const p = (y * S + x) * 4;
      img.data[p] = Math.max(0, Math.min(255, col[0] + g));
      img.data[p + 1] = Math.max(0, Math.min(255, col[1] + g));
      img.data[p + 2] = Math.max(0, Math.min(255, col[2] + g));
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Très fines inclusions minérales / pores (variation de COULEUR uniquement).
  const speckColors = ["#3a3a3e", "#4c4c50", "#5c5a54", "#2a2a2e", "#66655c"];
  const drawFleck = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        if (dx !== 0 && Math.abs(x + dx - S / 2) > S / 2 + r) continue;
        if (dy !== 0 && Math.abs(y + dy - S / 2) > S / 2 + r) continue;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 520; i++) {
    drawFleck(
      rand() * S,
      rand() * S,
      0.4 + rand() * 1.1,
      speckColors[(rand() * speckColors.length) | 0],
      0.25 + rand() * 0.35
    );
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Chemin de l'IMAGE réelle fournie pour « Wasterial® - Coquilles de moules »
 * (l'ancien « Noir mat »). Utilisée TELLE QUELLE comme baseColor : aucune
 * retouche (couleur/contraste/saturation/luminosité), aucune recréation.
 * Seuls l'échelle (uCompositeScale) et le placage triplanar (UV object-space)
 * sont adaptés ; AUCUN relief.
 */
const BLACK_MUSSEL_URL = "/textures/westerial-coquilles-moules.png";

function getBlackConcreteTexture(): THREE.Texture {
  if (blackTex) return blackTex;
  const tex = new THREE.TextureLoader().load(
    BLACK_MUSSEL_URL,
    undefined,
    undefined,
    () => {
      // Repli TEMPORAIRE tant que l'image n'est pas déposée ; remplacé par
      // l'image réelle dès qu'elle est présente.
      const fb = makeBlackConcreteTexture() as THREE.CanvasTexture;
      tex.image = fb.image as unknown as HTMLImageElement;
      tex.needsUpdate = true;
      fb.dispose();
    }
  );
  configureImageTexture(tex);
  blackTex = tex;
  return tex;
}

/* --- Texture verre bleu (variante Verre bleu), générée une fois --- */
let blueTex: THREE.Texture | null = null;

function makeBlueGlassTexture(): THREE.Texture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const rand = createSeededRandom(GRAIN_SEED + 6);

  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n, fy = v * n;
    const x0 = ((Math.floor(fx) % n) + n) % n;
    const y0 = ((Math.floor(fy) % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  const g6 = makeGrid(6), g16 = makeGrid(16), g48 = makeGrid(48), g128 = makeGrid(128);

  // Bleu profond légèrement grisé (d'après la référence) avec subtiles nuances.
  const dark = [0x21, 0x2d, 0x43];   // navy sombre
  const light = [0x33, 0x41, 0x5c];  // navy clair grisé
  const slate = [0x2a, 0x36, 0x4c];  // ardoise bleutée
  const mix = (a: number[], b: number[], t: number) => [
    a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const m1 = sample(g6, 6, u, v) * 0.6 + sample(g16, 16, u, v) * 0.4;
      const m2 = sample(g16, 16, u + 0.41, v + 0.19);
      const grain = sample(g48, 48, u, v) * 0.7 + sample(g128, 128, u, v) * 0.3;
      let col = mix(dark, light, Math.min(1, Math.max(0, m1)));
      col = mix(col, slate, m2 * 0.4);
      const g = (grain - 0.5) * 10; // grain sableux fin
      const p = (y * S + x) * 4;
      img.data[p] = Math.max(0, Math.min(255, col[0] + g));
      img.data[p + 1] = Math.max(0, Math.min(255, col[1] + g));
      img.data[p + 2] = Math.max(0, Math.min(255, col[2] + g));
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Fines inclusions claires (variation de COULEUR uniquement), tileables.
  const fleckColors = ["#b9c6da", "#93a4c0", "#7385a4", "#a7b6cd", "#8697b6"];
  const drawFleck = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        if (dx !== 0 && Math.abs(x + dx - S / 2) > S / 2 + r) continue;
        if (dy !== 0 && Math.abs(y + dy - S / 2) > S / 2 + r) continue;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  // majorité de très petites inclusions fines
  for (let i = 0; i < 430; i++) {
    drawFleck(
      rand() * S,
      rand() * S,
      0.4 + rand() * 1.1,
      fleckColors[(rand() * fleckColors.length) | 0],
      0.22 + rand() * 0.3
    );
  }
  // quelques rares éclats plus clairs (comme les points blancs de la référence)
  for (let i = 0; i < 7; i++) {
    drawFleck(
      rand() * S,
      rand() * S,
      1.3 + rand() * 1.3,
      "#d6e0ee",
      0.35 + rand() * 0.25
    );
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Chemin de l'IMAGE réelle fournie pour « Verre bleu ». Utilisée TELLE QUELLE
 * comme baseColor (aucune retouche : couleur/contraste/saturation/luminosité
 * inchangés, aucune recréation). Seuls l'échelle (uCompositeScale) et le
 * placage triplanar (UV object-space) sont adaptés ; AUCUN relief.
 */
const BLUE_GLASS_URL = "/textures/verre-bleu.png";

function getBlueGlassTexture(): THREE.Texture {
  if (blueTex) return blueTex;
  const tex = new THREE.TextureLoader().load(
    BLUE_GLASS_URL,
    undefined,
    undefined,
    () => {
      // Repli TEMPORAIRE si l'image n'est pas encore déposée : motif procédural
      // approchant, remplacé par l'image réelle dès qu'elle est présente.
      const fb = makeBlueGlassTexture() as THREE.CanvasTexture;
      tex.image = fb.image as unknown as HTMLImageElement;
      tex.needsUpdate = true;
      fb.dispose();
    }
  );
  configureImageTexture(tex);
  blueTex = tex;
  return tex;
}

/* --- Texture composite verre bleu concassé (Béton bleuté), une fois --- */
let blueTerrazzoTex: THREE.Texture | null = null;

function makeBlueTerrazzoTexture(): THREE.Texture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const rand = createSeededRandom(GRAIN_SEED + 7);

  // Fond sombre (le « liant » entre les éclats, visible dans les interstices).
  ctx.fillStyle = "#0c2e40";
  ctx.fillRect(0, 0, S, S);

  // Palette d'éclats de verre bleu recyclé (profond → clair) + inclusions.
  const glass = [
    "#12617f", "#0e6d94", "#1a7ca0", "#238db0", "#2ba0c8",
    "#3fb5d8", "#177a9e", "#0d5a78", "#1f83a6", "#57c2dd",
  ];
  const lightGlass = ["#8fd4e8", "#b7e4f1", "#6fc8e0"];
  const blackChips = ["#0a0f14", "#0c1a22", "#0e1418"];

  // Dessine un éclat anguleux (polygone convexe irrégulier), répété aux bords
  // pour rester tuilable.
  const drawShard = (
    cx: number,
    cy: number,
    r: number,
    fill: string,
    stroke: string | null
  ) => {
    const nSides = 4 + ((rand() * 3) | 0); // 4 à 6 côtés
    const a0 = rand() * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let k = 0; k < nSides; k++) {
      const a = a0 + (k / nSides) * Math.PI * 2 + (rand() - 0.5) * 0.55;
      const rr = r * (0.55 + rand() * 0.6);
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        if (Math.abs(cx + dx - S / 2) > S / 2 + r) continue;
        if (Math.abs(cy + dy - S / 2) > S / 2 + r) continue;
        ctx.beginPath();
        pts.forEach((p, i) =>
          i
            ? ctx.lineTo(cx + dx + p[0], cy + dy + p[1])
            : ctx.moveTo(cx + dx + p[0], cy + dy + p[1])
        );
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }
  };

  // Empilement dense d'éclats (couvre le fond, ne laisse que de fins interstices).
  const N = 620;
  for (let i = 0; i < N; i++) {
    const r = 9 + rand() * 16; // taille des fragments
    const x = rand() * S, y = rand() * S;
    const roll = rand();
    let fill: string;
    let stroke: string | null = null;
    if (roll < 0.08) {
      fill = blackChips[(rand() * blackChips.length) | 0]; // inclusions noires
    } else if (roll < 0.16) {
      fill = lightGlass[(rand() * lightGlass.length) | 0]; // éclats clairs
    } else {
      fill = glass[(rand() * glass.length) | 0];
      // liseré clair discret sur certains éclats (reflet de verre, couleur only)
      if (rand() < 0.35) stroke = "rgba(190,230,245,0.35)";
    }
    drawShard(x, y, r, fill, stroke);
  }

  // Fin grain global très léger (variation de teinte, pas de relief).
  const img = ctx.getImageData(0, 0, S, S);
  for (let p = 0; p < img.data.length; p += 4) {
    const g = (rand() - 0.5) * 12;
    img.data[p] = Math.max(0, Math.min(255, img.data[p] + g));
    img.data[p + 1] = Math.max(0, Math.min(255, img.data[p + 1] + g));
    img.data[p + 2] = Math.max(0, Math.min(255, img.data[p + 2] + g));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/* --- Placage bois (IMAGE réelle) : intérieur de l'abat-jour, config 01 --- */
let woodTex: THREE.Texture | null = null;
/**
 * Image réelle du placage bois, utilisée TELLE QUELLE comme baseColor de la
 * face intérieure de l'abat-jour (config 01). Aucune retouche, aucun relief ;
 * seuls l'échelle (uInteriorScale) et le placage triplanar sont adaptés.
 */
const WOOD_VENEER_URL = "/textures/placage-bois.webp";
/** Échelle du veinage à l'intérieur de l'abat-jour (tiling triplanar). */
const WOOD_VENEER_SCALE = 8;

function getWoodVeneerTexture(): THREE.Texture {
  if (woodTex) return woodTex;
  const tex = new THREE.TextureLoader().load(WOOD_VENEER_URL);
  configureImageTexture(tex);
  woodTex = tex;
  return tex;
}

/**
 * Chemin de l'IMAGE réelle fournie pour « Béton bleuté ». À déposer dans
 * /public/textures/. L'image est utilisée TELLE QUELLE comme baseColor :
 * aucune retouche (couleur, contraste, saturation, luminosité), aucune
 * recréation. Seuls l'échelle (uCompositeScale) et le placage triplanar
 * (UV object-space) sont adaptés ; AUCUN relief n'est dérivé de l'image.
 */
const BLUE_TERRAZZO_URL = "/textures/beton-bleute.png";

function getBlueTerrazzoTexture(): THREE.Texture {
  if (blueTerrazzoTex) return blueTerrazzoTex;
  const tex = new THREE.TextureLoader().load(
    BLUE_TERRAZZO_URL,
    undefined,
    undefined,
    () => {
      // Repli TEMPORAIRE si l'image n'est pas encore déposée : motif procédural
      // approchant, automatiquement remplacé par l'image réelle dès qu'elle est
      // présente à BLUE_TERRAZZO_URL. (Ce repli n'est jamais utilisé une fois le
      // fichier fourni.)
      const fb = makeBlueTerrazzoTexture() as THREE.CanvasTexture;
      tex.image = fb.image as unknown as HTMLImageElement;
      tex.needsUpdate = true;
      fb.dispose();
    }
  );
  // Couleurs fidèles à l'image (espace sRGB), répétition pour le tiling,
  // filtrage doux. Aucune map de relief associée.
  configureImageTexture(tex);
  blueTerrazzoTex = tex;
  return tex;
}

/* --- Texture travertin (pied, config 02), IMAGE réelle --- */
let travertineTex: THREE.Texture | null = null;

function makeTravertineTexture(): THREE.Texture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);
  const rand = createSeededRandom(GRAIN_SEED + 8);

  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return g;
  };
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const fx = u * n, fy = v * n;
    const x0 = ((Math.floor(fx) % n) + n) % n;
    const y0 = ((Math.floor(fy) % n) + n) % n;
    const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = g[y0 * n + x0], b = g[y0 * n + x1];
    const c = g[y1 * n + x0], d = g[y1 * n + x1];
    return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
  };
  // Grilles BASSE fréquence (peu de cases → grandes plages de couleur) pour
  // que le motif reste lisible une fois minifié à la taille réelle du pied
  // sur l'écran — un motif fin (comme le premier essai, grilles 6/16/48/128,
  // contraste ±14) s'écrasait en aplat gris au mipmapping avant même d'être
  // vu, un pied de lampe occupant très peu de pixels à l'écran.
  const g3 = makeGrid(3), g7 = makeGrid(7), g20 = makeGrid(20);

  // Base beige travertin — contraste largement renforcé (l'écart clair/foncé
  // d'origine, 0x9a↔0xc4, ne survivait pas au mipmapping).
  const dark = [0x6f, 0x63, 0x4d];
  const light = [0xdc, 0xd2, 0xbb];
  const taupe = [0xa8, 0x99, 0x7c];
  const mix = (a: number[], b: number[], t: number) => [
    a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const m1 = sample(g3, 3, u, v) * 0.65 + sample(g7, 7, u, v) * 0.35;
      const m2 = sample(g7, 7, u + 0.41, v + 0.23);
      const grain = sample(g20, 20, u, v);
      let col = mix(dark, light, Math.min(1, Math.max(0, m1)));
      col = mix(col, taupe, m2 * 0.5);
      const g = (grain - 0.5) * 22;
      const p = (y * S + x) * 4;
      img.data[p] = Math.max(0, Math.min(255, col[0] + g));
      img.data[p + 1] = Math.max(0, Math.min(255, col[1] + g));
      img.data[p + 2] = Math.max(0, Math.min(255, col[2] + g));
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Pores du travertin : inclusions sombres et claires, plus grandes et plus
  // opaques qu'au premier essai (0,6–1,8 px, alpha ~0,4) — trop fines pour
  // survivre au mipmapping à cette échelle d'objet, elles disparaissaient
  // avant le grain de fond. Toujours tileables (répétition aux bords).
  const poreColors = [
    "#4a4234", "#5c5344", "#6b6152", "#eee6d2", "#e0d5ba", "#8a7f6a",
  ];
  const drawPore = (x: number, y: number, r: number, color: string, alpha: number) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        if (dx !== 0 && Math.abs(x + dx - S / 2) > S / 2 + r) continue;
        if (dy !== 0 && Math.abs(y + dy - S / 2) > S / 2 + r) continue;
        ctx.beginPath();
        ctx.ellipse(x + dx, y + dy, r, r * (0.5 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  for (let i = 0; i < 420; i++) {
    drawPore(
      rand() * S,
      rand() * S,
      3 + rand() * 6,
      poreColors[(rand() * poreColors.length) | 0],
      0.55 + rand() * 0.35
    );
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Chemin de l'IMAGE réelle fournie pour « Travertin ». À déposer dans
 * /public/textures/travertin.png. Utilisée TELLE QUELLE comme baseColor :
 * aucune retouche (couleur, contraste, saturation, luminosité), aucune
 * recréation. Seuls l'échelle (uCompositeScale) et le placage triplanar
 * (UV object-space) sont adaptés ; AUCUN relief n'est dérivé de l'image (les
 * pores se lisent déjà en couleur, la rugosité du profil fait le reste).
 */
const TRAVERTINE_URL = "/textures/travertin.png";

function getTravertineTexture(): THREE.Texture {
  if (travertineTex) return travertineTex;
  const tex = new THREE.TextureLoader().load(
    TRAVERTINE_URL,
    undefined,
    undefined,
    () => {
      // Repli TEMPORAIRE si l'image n'est pas encore déposée : motif procédural
      // approchant, automatiquement remplacé par l'image réelle dès qu'elle est
      // présente à TRAVERTINE_URL. (Ce repli n'est jamais utilisé une fois le
      // fichier fourni.)
      const fb = makeTravertineTexture() as THREE.CanvasTexture;
      tex.image = fb.image as unknown as HTMLImageElement;
      tex.needsUpdate = true;
      fb.dispose();
    }
  );
  configureImageTexture(tex);
  travertineTex = tex;
  return tex;
}

/* --- Texture acier corten (pièce d'assemblage, config 03), IMAGE réelle --- */
let cortenTex: THREE.Texture | null = null;

/**
 * Chemin de l'image réelle « Acier corten ». Utilisée TELLE QUELLE comme
 * baseColor (aucune retouche, aucun repli procédural) : un fichier manquant
 * ne doit jamais être remplacé silencieusement par un motif de rouille
 * approchant — juste une erreur en console (voir plus bas).
 */
const CORTEN_URL = "/textures/tole-acier-corten.jpg";

/** Échelle du motif de rouille sur la pièce d'assemblage (tiling triplanar) :
 *  PROVISOIRE. Pièce ≈ 0,152 unité objet ≈ 15 cm ; 1 unité ≈ 101 cm, donc
 *  scale 12 ⇒ motif large d'environ 8,4 cm. Valeur exacte à obtenir par
 *  mesure réelle : scale = 101 / largeur en cm de la zone photographiée. */
const CORTEN_SCALE = 12;

function getCortenTexture(): THREE.Texture {
  if (cortenTex) return cortenTex;
  const tex = new THREE.TextureLoader().load(
    CORTEN_URL,
    undefined,
    undefined,
    (err) => {
      // AUCUN repli visuel : une image manquante ne doit jamais passer pour
      // un simple changement de rendu (voir le commentaire de CORTEN_URL).
      console.error(
        `Corten : "${CORTEN_URL}" introuvable — la pièce d'assemblage (config 03) reste sans texture.`,
        err
      );
    }
  );
  configureImageTexture(tex);
  cortenTex = tex;
  return tex;
}

/* --- Texture métal rouillé (douille, config 03), IMAGE réelle --- */
let rustedMetalTex: THREE.Texture | null = null;

/**
 * Chemin de l'image réelle « Douille métal rouille ». Utilisée TELLE QUELLE
 * comme baseColor (aucune retouche, aucun repli procédural) : un fichier
 * manquant ne doit jamais être remplacé silencieusement par un motif
 * approchant — juste une erreur en console (voir plus bas).
 */
const RUSTED_METAL_URL = "/textures/douille-metal-rouille.png";

/** Échelle du motif de rouille sur la douille (tiling triplanar) : PROVISOIRE.
 *  Pièce ≈ 0,066 unité objet ≈ 6,6 cm ; 1 unité ≈ 101 cm, donc scale 25 ⇒
 *  motif large d'environ 4 cm. Valeur exacte à obtenir par mesure réelle :
 *  scale = 101 / largeur en cm de la zone photographiée. */
const RUSTED_METAL_SCALE = 25;

function getRustedMetalTexture(): THREE.Texture {
  if (rustedMetalTex) return rustedMetalTex;
  const tex = new THREE.TextureLoader().load(
    RUSTED_METAL_URL,
    undefined,
    undefined,
    (err) => {
      // AUCUN repli visuel : une image manquante ne doit jamais passer pour
      // un simple changement de rendu (voir le commentaire de RUSTED_METAL_URL).
      console.error(
        `Métal rouillé : "${RUSTED_METAL_URL}" introuvable — la douille (config 03) reste sans texture.`,
        err
      );
    }
  );
  configureImageTexture(tex);
  rustedMetalTex = tex;
  return tex;
}

/* --- Texture sable de fonderie (pied, config 02), IMAGE réelle --- */
let foundrySandTex: THREE.Texture | null = null;

/**
 * Chemin de l'image réelle « Sable de fonderie ». Utilisée TELLE QUELLE comme
 * baseColor (aucune retouche, aucun repli procédural) : un fichier manquant
 * ne doit jamais être remplacé silencieusement par un motif approchant —
 * juste une erreur en console (voir plus bas).
 */
const FOUNDRY_SAND_URL = "/textures/sable-fonderie.png";

/** Échelle du motif sur le pied (tiling triplanar) : reprend celle du
 *  travertin qu'elle remplace, même pièce, même ordre de grandeur de grain. */
const FOUNDRY_SAND_SCALE = 16;

function getFoundrySandTexture(): THREE.Texture {
  if (foundrySandTex) return foundrySandTex;
  const tex = new THREE.TextureLoader().load(
    FOUNDRY_SAND_URL,
    undefined,
    undefined,
    (err) => {
      // AUCUN repli visuel : une image manquante ne doit jamais passer pour
      // un simple changement de rendu (voir le commentaire de FOUNDRY_SAND_URL).
      console.error(
        `Sable de fonderie : "${FOUNDRY_SAND_URL}" introuvable — le pied (config 02) reste sans texture.`,
        err
      );
    }
  );
  configureImageTexture(tex);
  foundrySandTex = tex;
  return tex;
}

/* --- Texture Renature (intérieur de l'abat-jour, config 02), IMAGE réelle --- */
let renatureTex: THREE.Texture | null = null;
/** Dédoublonne les chargements concurrents (plusieurs appels avant résolution)
 *  et mémorise le résultat — y compris l'échec, jamais réessayé en boucle. */
let renaturePromise: Promise<THREE.Texture | null> | null = null;

/**
 * Chemin de l'image réelle « Renature », utilisée telle quelle comme baseColor
 * de la face intérieure de l'abat-jour (config 02). Aucun repli : un fichier
 * manquant ne doit jamais être remplacé silencieusement par une approximation
 * (voir loadRenatureTexture) — l'intérieur retombe alors sur la porcelaine
 * nue, avec une erreur explicite en console.
 */
const RENATURE_URL = "/textures/renature.webp";

/** Échelle du motif froissé sur l'abat-jour (tiling triplanar) : 1 unité
 *  objet ≈ 101 cm, donc scale 9 ⇒ motif large d'environ 11 cm. Valeur exacte
 *  à affiner par mesure réelle : scale = 101 / largeur en cm de la zone photographiée. */
const RENATURE_SCALE = 9;

/**
 * Charge l'image Renature au plus une fois. En cas d'échec (fichier absent),
 * n'installe AUCUN repli visuel — juste une erreur en console — pour qu'un
 * fichier manquant reste visible au lieu de passer pour un simple changement
 * de rendu (voir applyInteriorVeneer, qui garde alors l'intérieur en
 * porcelaine nue).
 *
 * Exportée pour le pipeline packshot (voir `components/packshot/Packshot.tsx`,
 * qui l'appelle en préchargement AVANT de monter la scène 3D) : déclencher le
 * chargement tôt garantit que `renatureTex` est déjà posé au tout premier
 * appel d'`applyInteriorVeneer`, qui l'applique alors immédiatement et
 * synchrone — jamais de porcelaine nue intermédiaire à figer par erreur.
 */
export function loadRenatureTexture(): Promise<THREE.Texture | null> {
  if (renaturePromise) return renaturePromise;
  renaturePromise = new Promise((resolve) => {
    const tex = new THREE.TextureLoader().load(
      RENATURE_URL,
      () => {
        renatureTex = tex;
        resolve(tex);
      },
      undefined,
      (err) => {
        console.error(
          `Renature : "${RENATURE_URL}" introuvable — l'intérieur de l'abat-jour (config 02) reste en porcelaine nue.`,
          err
        );
        resolve(null);
      }
    );
    configureImageTexture(tex);
  });
  return renaturePromise;
}

/**
 * Résout une fois le chargement Renature EN COURS terminé (texture posée ou
 * échec confirmé) — jamais tant qu'il est en attente. `null` si aucun
 * chargement n'a été déclenché (aucune config 02 encore rendue).
 *
 * Exportée pour le seul pipeline packshot (voir la prop `onMaterialsSettled`
 * de `components/hero/Lamp3D.tsx`) : le marqueur `data-packshot-ready` ne doit
 * basculer qu'une fois la matière RÉELLEMENT stable, pas seulement au montage
 * du canvas WebGL — sinon la capture peut intervenir AVANT que
 * `applyInteriorVeneer("renature")` (config 02) ait remplacé la porcelaine
 * nue par la vraie texture, ce qui produisait une vignette non déterministe
 * (deux résultats possibles selon le timing du chargement de l'image —
 * découvert en comparant deux générations successives octet pour octet).
 */
export function pendingRenatureLoad(): Promise<unknown> {
  return renaturePromise ?? Promise.resolve();
}

/**
 * Matières composites procédurales (texture couleur + échelle/relief).
 * `both: true` → la texture couvre AUSSI les faces intérieures (abat-jour vu
 * de l'intérieur), avec la même échelle/orientation (triplanar object-space).
 */
const COMPOSITE: Record<
  string,
  { tex: () => THREE.Texture; scale: number; bump: number; rough: number; both?: boolean }
> = {
  // Brique : image réelle, couleur uniquement (aucun relief, aucune variation
  // de rugosité), visible extérieur ET intérieur de l'abat-jour. Tiling
  // volontairement modéré : l'image n'est pas « seamless », donc un tiling
  // élevé ferait apparaître une grille de coutures. Peu de répétitions +
  // matière uniforme → pas de couture visible.
  brick: { tex: getTerracottaTexture, scale: 9, bump: 0, rough: 0, both: true },
  // Coquilles d'huîtres : image réelle, couleur uniquement (aucun relief,
  // aucune variation de rugosité), visible extérieur ET intérieur de l'abat-jour.
  shell: { tex: getShellTexture, scale: 14, bump: 0, rough: 0, both: true },
  // Verre de bouteille : image réelle (verre recyclé vert foncé), couleur
  // uniquement, aucun relief, visible extérieur ET intérieur des pièces.
  glassBottle: { tex: getBottleGlassTexture, scale: 14, bump: 0, rough: 0, both: true },
  // Wasterial® - Coquilles de moules (ex « Noir mat ») : image réelle, couleur
  // uniquement, aucun relief, visible extérieur ET intérieur de l'abat-jour.
  blackConcrete: { tex: getBlackConcreteTexture, scale: 16, bump: 0, rough: 0, both: true },
  // Verre bleu : couleur uniquement (aucun relief, aucune variation de
  // rugosité), et visible sur l'EXTÉRIEUR ET L'INTÉRIEUR de l'abat-jour.
  blueGlass: { tex: getBlueGlassTexture, scale: 16, bump: 0, rough: 0, both: true },
  // Béton bleuté : composite de verre bleu concassé — couleur uniquement,
  // aucun relief. Échelle un peu réduite → fragments plus fins (tiling accru).
  blueTerrazzo: { tex: getBlueTerrazzoTexture, scale: 16, bump: 0, rough: 0 },
  // Travertin : le vrai problème du flou n'était pas le tiling (scale) mais
  // le CONTRASTE du repli procédural, écrasé par le mipmapping avant même
  // d'être vu (voir makeTravertineTexture) — corrigé là-bas. Une échelle plus
  // haute (36, essayée entre-temps) aggravait au contraire les choses : plus
  // de répétitions = motif plus fin = encore plus vite mipmappé en aplat.
  // Revenu à un ordre de grandeur comparable au béton bleuté voisin.
  travertine: { tex: getTravertineTexture, scale: 16, bump: 0, rough: 0 },
  // Acier corten : couleur/motif de rouille via l'image, aucun relief ajouté
  // (le profil `corten` porte déjà roughness/metalness/clearcoat adaptés).
  corten: { tex: getCortenTexture, scale: CORTEN_SCALE, bump: 0, rough: 0 },
  // Métal rouillé : couleur/motif d'oxydation via l'image, aucun relief
  // ajouté (le profil `rustedMetal` porte déjà roughness/metalness adaptés).
  rustedMetal: { tex: getRustedMetalTexture, scale: RUSTED_METAL_SCALE, bump: 0, rough: 0 },
  // Sable de fonderie : couleur/grain via l'image, aucun relief ajouté (le
  // profil `foundrySand` porte déjà roughness/clearcoat adaptés).
  foundrySand: { tex: getFoundrySandTexture, scale: FOUNDRY_SAND_SCALE, bump: 0, rough: 0 },
};

/**
 * Crée un matériau physique avec grain triplanar object-space.
 * Le grain (échelle / rugosité / moucheté) est piloté par des uniformes,
 * modifiables à chaud (sans recompilation) via `updateGrain`.
 */
export function createGrainMaterial(
  texture?: THREE.Texture,
  /**
   * true UNIQUEMENT pour la pièce d'assemblage : elle ne doit pas s'éclairer
   * quand on allume l'ampoule (voir uBlockLampLight, plus bas). Les calques
   * three.js ont été essayés et abandonnés — ils filtrent la visibilité
   * caméra↔objet, pas quelle lumière touche quel objet (aucun filtrage de ce
   * type dans le pipeline d'éclairage forward standard, vérifié dans
   * WebGLRenderer.js/WebGLLights.js). Resserrer angle/pointDistance a aussi
   * été essayé : insuffisant, la pièce est trop proche de l'ampoule pour
   * qu'un cône/une portée l'exclue sans assombrir l'abat-jour, à distance
   * comparable. Seule une exclusion explicite, par matériau, dans le shader
   * lui-même donne un vrai zéro sans toucher au reste de la scène.
   */
  blockLampLight = false
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    // Réflexions d'environnement douces (matériaux mats, intérieur d'abat-jour
    // sans reflet spéculaire dur).
    envMapIntensity: 0.6,
    clearcoat: 0.05, // non nul → chemin clearcoat compilé, puis modulable
  });
  // Sans clé stable, un onBeforeCompile personnalisé casse le cache de
  // programmes de three.js : chaque instance recompile son propre shader.
  mat.customProgramCacheKey = () => "lamp-grain-v1";
  // Le grain ET la matière composite sont stockés dans userData → l'init du
  // shader (onBeforeCompile, lazy) lit ces valeurs, quel que soit l'ordre
  // vis-à-vis d'applyProfile (sinon la config par défaut garde la texture par
  // défaut si elle est compilée après applyProfile).
  mat.userData.grain = {
    scale: 26, rough: 0.2, speckle: 0.08, bump: 0.12, composite: 0,
    compTex: null as THREE.Texture | null, compScale: 14, compBump: 0.018, compRough: 0.06, compBoth: 0,
  };
  // Texture intérieure optionnelle (placage bois ou Renature). composite 0 =
  // désactivé.
  mat.userData.interior = {
    composite: 0,
    scale: WOOD_VENEER_SCALE,
    tex: null as THREE.Texture | null,
  };
  mat.userData.blockLampLight = blockLampLight;

  mat.onBeforeCompile = (shader, renderer) => {
    // Le vrai maximum matériel plutôt qu'une valeur en dur (voir
    // applyMaxAnisotropy) — c'est le seul endroit du fichier qui reçoit un
    // renderer.
    applyMaxAnisotropy(renderer);
    shader.uniforms.uGrainTex = { value: texture ?? getNoiseTexture() };
    shader.uniforms.uGrainScale = { value: mat.userData.grain.scale };
    shader.uniforms.uGrainRough = { value: mat.userData.grain.rough };
    shader.uniforms.uSpeckle = { value: mat.userData.grain.speckle };
    shader.uniforms.uBump = { value: mat.userData.grain.bump };
    // Matière composite (Brique = terre cuite, Coquilles = composite olive) :
    // texture couleur échantillonnée en triplanar. Couleur, rugosité et relief
    // partagent EXACTEMENT la même échelle ; relief/rugosité très discrets.
    shader.uniforms.uCompositeTex = { value: mat.userData.grain.compTex ?? getTerracottaTexture() };
    shader.uniforms.uComposite = { value: mat.userData.grain.composite };
    shader.uniforms.uCompositeScale = { value: mat.userData.grain.compScale };
    shader.uniforms.uCompositeBump = { value: mat.userData.grain.compBump };
    shader.uniforms.uCompositeRough = { value: mat.userData.grain.compRough };
    // 1 → la texture composite couvre AUSSI les faces intérieures (Verre bleu).
    shader.uniforms.uCompositeBoth = { value: mat.userData.grain.compBoth };
    // Texture réservée à l'INTÉRIEUR de l'abat-jour (placage bois config 01,
    // Renature config 02) : baseColor pure, aucun relief ni rugosité propres —
    // même traitement que le bois. uInteriorComposite = 1 → l'intérieur
    // utilise uInteriorTex.
    shader.uniforms.uInteriorTex = { value: mat.userData.interior.tex ?? getNoiseTexture() };
    shader.uniforms.uInteriorComposite = { value: mat.userData.interior.composite };
    shader.uniforms.uInteriorScale = { value: mat.userData.interior.scale };
    // Voir le commentaire de blockLampLight (paramètre de createGrainMaterial).
    shader.uniforms.uBlockLampLight = { value: mat.userData.blockLampLight ? 1 : 0 };
    // Filetage hélicoïdal, appliqué à la face INTÉRIEURE seulement.

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vGrainPos; varying vec3 vGrainNrm;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vGrainPos = position; vGrainNrm = normal;`
      );

    shader.fragmentShader = shader.fragmentShader
      // Copie de lights_fragment_begin (three.js 0.185, voir node_modules/three/
      // src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js) avec UN
      // seul ajout, marqué ci-dessous : les deux appels RE_Direct (point, spot —
      // l'ampoule) sont sautés quand uBlockLampLight > 0.5. Tout le reste — les
      // directionnelles, l'indirect (ambiante/environnement), les rect area —
      // reste identique et s'applique toujours. Fragile aux montées de version
      // de three.js (chunk recopié à la main, pas relu depuis le module) : si
      // l'éclairage se met à sembler faux après une mise à jour de three, RE-
      // COMPARER ce bloc à la source du chunk dans le three installé.
      .replace(
        "#include <lights_fragment_begin>",
        `vec3 geometryPosition = - vViewPosition;
        vec3 geometryNormal = normal;
        vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

        vec3 geometryClearcoatNormal = vec3( 0.0 );

        #ifdef USE_CLEARCOAT
          geometryClearcoatNormal = clearcoatNormal;
        #endif

        #ifdef USE_IRIDESCENCE
          float dotNVi = saturate( dot( normal, geometryViewDir ) );
          if ( material.iridescenceThickness == 0.0 ) {
            material.iridescence = 0.0;
          } else {
            material.iridescence = saturate( material.iridescence );
          }
          if ( material.iridescence > 0.0 ) {
            material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
            material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
            material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
            material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
          }
        #endif

        IncidentLight directLight;

        #if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
          PointLight pointLight;
          #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
          PointLightShadow pointLightShadow;
          #endif
          #pragma unroll_loop_start
          for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
            pointLight = pointLights[ i ];
            getPointLightInfo( pointLight, geometryPosition, directLight );
            #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
            pointLightShadow = pointLightShadows[ i ];
            directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
            #endif
            // AJOUT (uBlockLampLight) : la seule ligne qui diffère du chunk d'origine.
            if ( uBlockLampLight < 0.5 ) RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          }
          #pragma unroll_loop_end
        #endif

        #if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
          SpotLight spotLight;
          vec4 spotColor;
          vec3 spotLightCoord;
          bool inSpotLightMap;
          #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
          SpotLightShadow spotLightShadow;
          #endif
          #pragma unroll_loop_start
          for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
            spotLight = spotLights[ i ];
            getSpotLightInfo( spotLight, geometryPosition, directLight );
            #if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
            #define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
            #elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
            #define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
            #else
            #define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
            #endif
            #if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
              spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
              inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
              spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
              directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
            #endif
            #undef SPOT_LIGHT_MAP_INDEX
            #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
            spotLightShadow = spotLightShadows[ i ];
            directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
            #endif
            // AJOUT (uBlockLampLight) : la seule autre ligne qui diffère.
            if ( uBlockLampLight < 0.5 ) RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          }
          #pragma unroll_loop_end
        #endif

        #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
          DirectionalLight directionalLight;
          #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
          DirectionalLightShadow directionalLightShadow;
          #endif
          #pragma unroll_loop_start
          for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
            directionalLight = directionalLights[ i ];
            getDirectionalLightInfo( directionalLight, directLight );
            #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
            directionalLightShadow = directionalLightShadows[ i ];
            directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
            #endif
            RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          }
          #pragma unroll_loop_end
        #endif

        #if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
          RectAreaLight rectAreaLight;
          #pragma unroll_loop_start
          for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
            rectAreaLight = rectAreaLights[ i ];
            RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          }
          #pragma unroll_loop_end
        #endif

        #if defined( RE_IndirectDiffuse )
          vec3 iblIrradiance = vec3( 0.0 );
          vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
          #if defined( USE_LIGHT_PROBES )
            irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
          #endif
          #if ( NUM_HEMI_LIGHTS > 0 )
            #pragma unroll_loop_start
            for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
              irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
            }
            #pragma unroll_loop_end
          #endif
          #ifdef USE_LIGHT_PROBES_GRID
            vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
            vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
            irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
          #endif
        #endif

        #if defined( RE_IndirectSpecular )
          vec3 radiance = vec3( 0.0 );
          vec3 clearcoatRadiance = vec3( 0.0 );
        #endif`
      )
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vGrainPos; varying vec3 vGrainNrm;
        uniform sampler2D uGrainTex; uniform float uGrainScale;
        uniform float uGrainRough; uniform float uSpeckle; uniform float uBump;
        uniform sampler2D uCompositeTex; uniform float uComposite;
        uniform float uCompositeScale; uniform float uCompositeBump; uniform float uCompositeRough;
        uniform float uCompositeBoth;
        uniform sampler2D uInteriorTex; uniform float uInteriorComposite; uniform float uInteriorScale;
        // Voir LIGHTS_FRAGMENT_BEGIN plus bas : coupe la contribution DIRECTE
        // du spot/point de l'ampoule pour ce matériau, sans toucher au reste
        // de la scène (ambiante, directionnelle, environnement).
        uniform float uBlockLampLight;
        vec3 triBlend() {
          // Mélange triplanar ADOUCI : la transition entre les 3 plans est
          // fondue (pas de ligne de couture nette). L'exposant modéré garde une
          // bonne netteté tout en élargissant la bande de fondu ; sur des
          // matières uniformes le léger recouvrement est invisible.
          vec3 bw = abs(normalize(vGrainNrm));
          bw = pow(bw, vec3(3.0));
          return bw / (bw.x + bw.y + bw.z + 1e-5);
        }
        float grainSample() {
          vec3 bw = triBlend();
          return texture2D(uGrainTex, vGrainPos.yz * uGrainScale).r * bw.x
               + texture2D(uGrainTex, vGrainPos.xz * uGrainScale).r * bw.y
               + texture2D(uGrainTex, vGrainPos.xy * uGrainScale).r * bw.z;
        }
        vec3 compositeSample() {
          vec3 bw = triBlend();
          return texture2D(uCompositeTex, vGrainPos.yz * uCompositeScale).rgb * bw.x
               + texture2D(uCompositeTex, vGrainPos.xz * uCompositeScale).rgb * bw.y
               + texture2D(uCompositeTex, vGrainPos.xy * uCompositeScale).rgb * bw.z;
        }
        vec3 interiorSample() {
          vec3 bw = triBlend();
          return texture2D(uInteriorTex, vGrainPos.yz * uInteriorScale).rgb * bw.x
               + texture2D(uInteriorTex, vGrainPos.xz * uInteriorScale).rgb * bw.y
               + texture2D(uInteriorTex, vGrainPos.xy * uInteriorScale).rgb * bw.z;
        }`
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        // La texture (grain/composite) ne s'applique qu'à l'EXTÉRIEUR (faces
        // avant). L'intérieur (faces arrière) reste lisse en couleur de base :
        // un réflecteur propre, sans artefact de texture ni de relief.
        // IMPORTANT : les normales issues de la CAO (IGES) sont inversées, donc
        // l'EXTÉRIEUR visible de la lampe est en réalité « back-facing »
        // (gl_FrontFacing == false). La texture (grain/composite) ne s'applique
        // donc que lorsque !gl_FrontFacing = extérieur. L'intérieur (faces
        // avant) reste lisse en couleur de base : un réflecteur propre, sans
        // artefact de texture ni de relief.
        float gGrain = grainSample();
        float gCompH = 0.0;
        bool vmExterior = !gl_FrontFacing; // extérieur = back-facing (normales CAO inversées)
        // Placage intérieur (bois config 01, Renature config 02) : image réelle
        // appliquée UNIQUEMENT à l'intérieur (faces avant) quand
        // uInteriorComposite = 1 — même mécanisme pour les deux, baseColor pure,
        // aucun relief ni rugosité propres.
        bool vmWoodInterior = (!vmExterior) && (uInteriorComposite > 0.5);
        // Le moucheté d'albédo (grain) reste extérieur uniquement.
        if (vmExterior) {
          diffuseColor.rgb *= 1.0 + (gGrain - 0.5) * uSpeckle;
        }
        if (vmWoodInterior) {
          // baseColor = image intérieure telle quelle (aucune retouche).
          diffuseColor.rgb = interiorSample();
        } else if (uComposite > 0.001 && (vmExterior || uCompositeBoth > 0.5)) {
          // La texture composite couvre l'extérieur, et AUSSI l'intérieur quand
          // uCompositeBoth = 1 (Verre bleu) — même échelle/orientation.
          vec3 tc = compositeSample();
          diffuseColor.rgb = mix(diffuseColor.rgb, tc, uComposite);
          gCompH = dot(tc, vec3(0.299, 0.587, 0.114));
        }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        // Variation de rugosité : extérieur (= !gl_FrontFacing) uniquement.
        if (!gl_FrontFacing) {
          float rSrc = (uComposite > 0.001) ? gCompH : gGrain;
          float rAmp = (uComposite > 0.001) ? uCompositeRough : uGrainRough;
          roughnessFactor = clamp(roughnessFactor + (rSrc - 0.5) * rAmp, 0.03, 1.0);
        }
        // Intérieur en placage (bois ou Renature) : finition légèrement
        // satinée (verni léger), identique pour les deux — aucune variation.
        if (gl_FrontFacing && uInteriorComposite > 0.5) {
          roughnessFactor = 0.5;
        }
        `
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        float hB = (uComposite > 0.001) ? gCompH : gGrain;
        float ampB = (uComposite > 0.001) ? uCompositeBump : uBump;
        if (ampB > 0.001 && !gl_FrontFacing) {
          // Relief procédural : perturbation de la normale via dérivées d'écran.
          vec3 dPx = dFdx(-vViewPosition);
          vec3 dPy = dFdy(-vViewPosition);
          float dHx = dFdx(hB);
          float dHy = dFdy(hB);
          vec3 cX = cross(normal, dPy);
          vec3 cY = cross(dPx, normal);
          float det = dot(dPx, cX);
          vec3 grad = sign(det) * (dHx * cX + dHy * cY);
          normal = normalize(abs(det) * normal - ampB * grad);
        }`
      );

    mat.userData.shader = shader;
  };

  return mat;
}

/** Applique un profil matière (couleur + PBR + grain) sans recompiler. */
export function applyProfile(
  mat: THREE.MeshPhysicalMaterial,
  color: string,
  p: MaterialProfile
) {
  mat.color.set(color);
  mat.roughness = p.roughness;
  mat.metalness = p.metalness;
  mat.clearcoat = Math.max(0.03, p.clearcoat);
  mat.clearcoatRoughness = p.clearcoatRoughness;
  const comp = COMPOSITE[p.kind];
  const composite = comp ? 1 : 0;
  const compTex = comp ? comp.tex() : null;
  mat.userData.grain = {
    scale: p.grainScale,
    rough: p.grainRough,
    speckle: p.speckle,
    bump: p.grainBump,
    composite,
    compTex,
    compScale: comp ? comp.scale : 14,
    compBump: comp ? comp.bump : 0.018,
    compRough: comp ? comp.rough : 0.06,
    compBoth: comp?.both ? 1 : 0,
  };
  const shader = mat.userData.shader as
    | { uniforms: Record<string, { value: unknown }> }
    | undefined;
  if (shader) {
    shader.uniforms.uGrainScale.value = p.grainScale;
    shader.uniforms.uGrainRough.value = p.grainRough;
    shader.uniforms.uSpeckle.value = p.speckle;
    shader.uniforms.uBump.value = p.grainBump;
    shader.uniforms.uComposite.value = composite;
    shader.uniforms.uCompositeBoth.value = comp?.both ? 1 : 0;
    if (comp) {
      shader.uniforms.uCompositeTex.value = compTex;
      shader.uniforms.uCompositeScale.value = comp.scale;
      shader.uniforms.uCompositeBump.value = comp.bump;
      shader.uniforms.uCompositeRough.value = comp.rough;
    }
  }
  mat.needsUpdate = false; // pas de recompilation
}

/** Placage disponible sur la face intérieure de l'abat-jour, ou aucun. */
export type InteriorVeneer = "wood" | "renature" | null;

/** Écrit l'état d'intérieur à la fois dans userData (relu à la prochaine
 *  compilation) et dans les uniformes live si le shader est déjà compilé. */
function setInteriorState(
  mat: THREE.MeshPhysicalMaterial,
  state: { composite: number; scale: number; tex: THREE.Texture | null }
) {
  mat.userData.interior = state;
  const shader = mat.userData.shader as
    | { uniforms: Record<string, { value: unknown }> }
    | undefined;
  if (shader) {
    shader.uniforms.uInteriorComposite.value = state.composite;
    shader.uniforms.uInteriorScale.value = state.scale;
    if (state.tex) shader.uniforms.uInteriorTex.value = state.tex;
  }
}

/**
 * Active (ou désactive) un placage sur la FACE INTÉRIEURE de l'abat-jour :
 * bois (config 01) ou Renature (config 02). À n'appeler que pour le mesh de
 * l'abat-jour concerné. L'extérieur n'est jamais modifié. Aucune
 * recompilation — seuls les uniformes changent. BaseColor pure dans les deux
 * cas : aucun relief, aucune variation de rugosité côté intérieur.
 */
export function applyInteriorVeneer(
  mat: THREE.MeshPhysicalMaterial,
  veneer: InteriorVeneer
) {
  if (veneer === "renature") {
    // IDEMPOTENT — vérifie renatureTex (déjà résolu, synchrone) avant de
    // rebasculer en porcelaine nue. Sans ce garde, chaque nouvel appel (React
    // StrictMode double invoque cet effet en dev, et un changement de
    // configuration le redéclenche aussi) repartait de zéro : la matière
    // clignotait porcelaine nue → Renature à chaque appel, même quand la
    // texture était déjà chargée et appliquée. Sur le pipeline packshot, ce
    // clignotement pouvait geler la capture sur l'état intermédiaire :
    // vignette non déterministe, découverte en comparant deux générations
    // successives octet pour octet (voir components/packshot/Packshot.tsx).
    if (renatureTex) {
      setInteriorState(mat, { composite: 1, scale: RENATURE_SCALE, tex: renatureTex });
      return;
    }
    // Porcelaine nue tant que l'image n'est pas CONFIRMÉE chargée (jamais
    // avant) — un fichier manquant ne doit jamais s'afficher comme un rendu
    // cassé, ni être masqué par un repli qui ressemble à la matière (voir
    // loadRenatureTexture). En cas d'échec, l'état reste ici, avec l'erreur
    // déjà écrite en console par loadRenatureTexture.
    setInteriorState(mat, { composite: 0, scale: RENATURE_SCALE, tex: null });
    loadRenatureTexture().then((tex) => {
      if (tex) setInteriorState(mat, { composite: 1, scale: RENATURE_SCALE, tex });
    });
    return;
  }
  const enabled = veneer === "wood";
  const tex = enabled ? getWoodVeneerTexture() : null;
  setInteriorState(mat, { composite: enabled ? 1 : 0, scale: WOOD_VENEER_SCALE, tex });
}

/**
 * Applique la géométrie de perforation à un matériau — la pièce d'assemblage.
 *
 * REMISE À ZÉRO (voir TASKS.md) : l'implémentation précédente (masque bitmap
 * en texture, découpe par discard dans le shader) a été entièrement retirée,
 * à réécrire de zéro. Le contrat reste inchangé — signature, appelants
 * (Lamp3D, ExplodedLamp3D), option produit, contrôle d'interface — seul CE
 * CORPS est à remplir : c'est ICI que la nouvelle géométrie de perforation
 * devra se brancher.
 */
export function applyPerforation(
  _mat: THREE.MeshPhysicalMaterial,
  _shape: PerforationShape
) {
  // no-op : voir le commentaire ci-dessus.
}

/** Libère les textures procédurales (au démontage du canvas). */
export function disposeLampTextures() {
  noiseTex?.dispose();
  noiseTex = null;
  weaveTex?.dispose();
  weaveTex = null;
  terraTex?.dispose();
  terraTex = null;
  shellTex?.dispose();
  shellTex = null;
  blackTex?.dispose();
  blackTex = null;
  blueTex?.dispose();
  blueTex = null;
  blueTerrazzoTex?.dispose();
  blueTerrazzoTex = null;
  woodTex?.dispose();
  woodTex = null;
  bottleTex?.dispose();
  bottleTex = null;
  travertineTex?.dispose();
  travertineTex = null;
  cortenTex?.dispose();
  cortenTex = null;
  rustedMetalTex?.dispose();
  rustedMetalTex = null;
  foundrySandTex?.dispose();
  foundrySandTex = null;
  renatureTex?.dispose();
  renatureTex = null;
  renaturePromise = null;
}

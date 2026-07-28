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
  | "matte";

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
}

const PROFILES: Record<MaterialKind, Omit<MaterialProfile, "kind">> = {
  // grainBump reste à 0 pour les matières au bruit (le relief exploserait) ;
  // seul le câble (motif de tissage structuré) reçoit du relief.
  porcelain: { roughness: 0.88, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, grainScale: 10, grainRough: 0.45, speckle: 0.3, grainBump: 0 },
  concrete: { roughness: 0.94, metalness: 0, clearcoat: 0.04, clearcoatRoughness: 0.8, grainScale: 9, grainRough: 0.55, speckle: 0.42, grainBump: 0 },
  // brick : la couleur/le grain viennent de la texture terre cuite (composite).
  brick: { roughness: 0.9, metalness: 0, clearcoat: 0.03, clearcoatRoughness: 0.8, grainScale: 22, grainRough: 0.14, speckle: 0.04, grainBump: 0 },
  // shell : composite mat (couleur/grain via la texture coquilles, uComposite).
  shell: { roughness: 0.9, metalness: 0, clearcoat: 0.03, clearcoatRoughness: 0.8, grainScale: 20, grainRough: 0.14, speckle: 0.04, grainBump: 0 },
  // Verre de bouteille (d'après la texture fournie) : composite de verre
  // recyclé vert foncé — couleur via la texture (uComposite), mat/légèrement
  // satiné, AUCUN relief.
  glassBottle: { roughness: 0.55, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.45, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0 },
  glassBlue: { roughness: 0.42, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3, grainScale: 11, grainRough: 0.28, speckle: 0.28, grainBump: 0 },
  // Verre bleu (d'après la texture fournie) : navy dense grisé, mat, très
  // légèrement satiné, fines inclusions claires — couleur via la texture
  // composite (uComposite), AUCUN relief.
  blueGlass: { roughness: 0.82, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.6, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0 },
  // Béton bleuté (d'après la texture fournie) : composite de verre bleu recyclé
  // concassé (éclats bleus + inclusions noires), mat/légèrement satiné, couleur
  // via la texture composite, AUCUN relief.
  blueTerrazzo: { roughness: 0.8, metalness: 0, clearcoat: 0.07, clearcoatRoughness: 0.55, grainScale: 16, grainRough: 0, speckle: 0, grainBump: 0 },
  epoxy: { roughness: 0.5, metalness: 0.08, clearcoat: 0.25, clearcoatRoughness: 0.45, grainScale: 14, grainRough: 0.2, speckle: 0.18, grainBump: 0 },
  metal: { roughness: 0.34, metalness: 0.92, clearcoat: 0.1, clearcoatRoughness: 0.3, grainScale: 40, grainRough: 0.14, speckle: 0.0, grainBump: 0 },
  // Béton noir : couleur via la texture (composite), très mat, AUCUN relief.
  blackConcrete: { roughness: 0.92, metalness: 0, clearcoat: 0.03, clearcoatRoughness: 0.85, grainScale: 20, grainRough: 0, speckle: 0, grainBump: 0 },
  // Gaine textile du câble : tissage plat fin (chaîne/trame), mat, relief
  // discret — évoque un câble gainé de tissu haut de gamme sans excès.
  fabric: { roughness: 0.82, metalness: 0, clearcoat: 0.04, clearcoatRoughness: 0.8, grainScale: 60, grainRough: 0.4, speckle: 0.12, grainBump: 0.32 },
  matte: { roughness: 0.75, metalness: 0, clearcoat: 0.05, clearcoatRoughness: 0.7, grainScale: 11, grainRough: 0.32, speckle: 0.3, grainBump: 0 },
};

/** Déduit le profil matière d'un libellé (planche des variantes). */
export function materialProfile(label: string): MaterialProfile {
  const l = label.toLowerCase();
  let kind: MaterialKind = "matte";
  if (/(inox|aluminium|acier|laiton)/.test(l)) kind = "metal";
  // « WESTERIAL - Coquilles de moules » (ex « Noir mat ») et « Béton noir » →
  // UN SEUL matériau (composite noir mat, image réelle). Placé AVANT la règle
  // huîtres/nacre (le libellé contient « coquilles ») et spécifique pour ne PAS
  // toucher « Câble noir » (fabric) ni « Acier anodisé noir » (metal).
  else if (
    /westerial|coquilles de moules/.test(l) ||
    /noir mat/.test(l) ||
    /béton noir|beton noir/.test(l)
  )
    kind = "blackConcrete";
  else if (/époxy|epoxy/.test(l)) kind = "epoxy";
  // « Wasterial® - Billes de verre » (ex « Verre bleu ») → blueGlass. On matche
  // « billes de verre » (et non « wasterial » nu, sinon « Wasterial® - Brique »
  // serait capté ici). AVANT la règle générique /verre/.
  else if (/billes de verre|verre bleu/.test(l)) kind = "blueGlass";
  else if (/verre/.test(l)) kind = "glassBottle";
  else if (/porcelaine/.test(l)) kind = "porcelain";
  else if (/brique/.test(l)) kind = "brick";
  else if (/(coquille|nacre)/.test(l)) kind = "shell";
  // « Béton bleuté » AVANT le béton générique (composite verre bleu concassé).
  else if (/b[ée]ton bleut/.test(l)) kind = "blueTerrazzo";
  else if (/(béton|beton|terre)/.test(l)) kind = "concrete";
  else if (/(câble|cable)/.test(l)) kind = "fabric";
  return { kind, ...PROFILES[kind] };
}

/**
 * Réglages communs des textures issues d'IMAGES (baseColor). Tiling en MIROIR :
 * les bords des tuiles se raccordent toujours (l'image se reflète), donc aucune
 * couture de répétition ni raccord clair/foncé — même quand l'image n'est pas
 * « seamless ». C'est un réglage de tiling : l'image n'est pas modifiée.
 */
function configureImageTexture(tex: THREE.Texture) {
  tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace; // couleurs fidèles à l'image
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
}

/* --- Texture de bruit (value noise + moucheté), générée une fois --- */
let noiseTex: THREE.Texture | null = null;

function makeNoiseTexture(): THREE.Texture {
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(S, S);

  // Bruit de valeur *multi-octave*, tileable (grilles bouclées) → une texture
  // qui se LIT : marbrures basse fréquence + grain fin. Plus qu'un simple
  // dither, sinon la matière paraît lisse une fois éclairée.
  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
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

  const threadsPerTile = 16; // tissage fin (16 fils/tuile)
  const period = S / threadsPerTile; // 16 px — divise S exactement

  // Grain fin des fibres, tileable (grille bouclée + bilinéaire).
  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
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

  // Bruit de valeur lissé et *tileable* (grille bouclée) → pas de couture.
  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
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

  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
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
      Math.random() * S,
      Math.random() * S,
      0.5 + Math.random() * 2.0,
      fleckColors[(Math.random() * fleckColors.length) | 0],
      0.3 + Math.random() * 0.35
    );
  }
  // Quelques stries fibreuses très discrètes.
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = Math.random() > 0.5 ? "#d8d2bf" : "#6a6248";
    ctx.globalAlpha = 0.08 + Math.random() * 0.1;
    const x = Math.random() * S, y = Math.random() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40, x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 70);
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

  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
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
      Math.random() * S,
      Math.random() * S,
      0.4 + Math.random() * 1.1,
      speckColors[(Math.random() * speckColors.length) | 0],
      0.25 + Math.random() * 0.35
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
 * Chemin de l'IMAGE réelle fournie pour « WESTERIAL - Coquilles de moules »
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

  const makeGrid = (n: number) => {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
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
      Math.random() * S,
      Math.random() * S,
      0.4 + Math.random() * 1.1,
      fleckColors[(Math.random() * fleckColors.length) | 0],
      0.22 + Math.random() * 0.3
    );
  }
  // quelques rares éclats plus clairs (comme les points blancs de la référence)
  for (let i = 0; i < 7; i++) {
    drawFleck(
      Math.random() * S,
      Math.random() * S,
      1.3 + Math.random() * 1.3,
      "#d6e0ee",
      0.35 + Math.random() * 0.25
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
    const nSides = 4 + ((Math.random() * 3) | 0); // 4 à 6 côtés
    const a0 = Math.random() * Math.PI * 2;
    const pts: [number, number][] = [];
    for (let k = 0; k < nSides; k++) {
      const a = a0 + (k / nSides) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
      const rr = r * (0.55 + Math.random() * 0.6);
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
    const r = 9 + Math.random() * 16; // taille des fragments
    const x = Math.random() * S, y = Math.random() * S;
    const roll = Math.random();
    let fill: string;
    let stroke: string | null = null;
    if (roll < 0.08) {
      fill = blackChips[(Math.random() * blackChips.length) | 0]; // inclusions noires
    } else if (roll < 0.16) {
      fill = lightGlass[(Math.random() * lightGlass.length) | 0]; // éclats clairs
    } else {
      fill = glass[(Math.random() * glass.length) | 0];
      // liseré clair discret sur certains éclats (reflet de verre, couleur only)
      if (Math.random() < 0.35) stroke = "rgba(190,230,245,0.35)";
    }
    drawShard(x, y, r, fill, stroke);
  }

  // Fin grain global très léger (variation de teinte, pas de relief).
  const img = ctx.getImageData(0, 0, S, S);
  for (let p = 0; p < img.data.length; p += 4) {
    const g = (Math.random() - 0.5) * 12;
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
const WOOD_VENEER_URL = "/textures/placage-bois.jpg";
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
  // WESTERIAL - Coquilles de moules (ex « Noir mat ») : image réelle, couleur
  // uniquement, aucun relief, visible extérieur ET intérieur de l'abat-jour.
  blackConcrete: { tex: getBlackConcreteTexture, scale: 16, bump: 0, rough: 0, both: true },
  // Verre bleu : couleur uniquement (aucun relief, aucune variation de
  // rugosité), et visible sur l'EXTÉRIEUR ET L'INTÉRIEUR de l'abat-jour.
  blueGlass: { tex: getBlueGlassTexture, scale: 16, bump: 0, rough: 0, both: true },
  // Béton bleuté : composite de verre bleu concassé — couleur uniquement,
  // aucun relief. Échelle un peu réduite → fragments plus fins (tiling accru).
  blueTerrazzo: { tex: getBlueTerrazzoTexture, scale: 16, bump: 0, rough: 0 },
};

/**
 * Crée un matériau physique avec grain triplanar object-space.
 * Le grain (échelle / rugosité / moucheté) est piloté par des uniformes,
 * modifiables à chaud (sans recompilation) via `updateGrain`.
 */
export function createGrainMaterial(
  texture?: THREE.Texture
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
  // Le grain ET la matière composite sont stockés dans userData → l'init du
  // shader (onBeforeCompile, lazy) lit ces valeurs, quel que soit l'ordre
  // vis-à-vis d'applyProfile (sinon la config par défaut garde la texture par
  // défaut si elle est compilée après applyProfile).
  mat.userData.grain = {
    scale: 26, rough: 0.2, speckle: 0.08, bump: 0.12, composite: 0,
    compTex: null as THREE.Texture | null, compScale: 14, compBump: 0.018, compRough: 0.06, compBoth: 0,
  };
  // Texture intérieure optionnelle (placage bois). composite 0 = désactivé.
  mat.userData.interior = { composite: 0, scale: WOOD_VENEER_SCALE, tex: null as THREE.Texture | null };

  mat.onBeforeCompile = (shader) => {
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
    // Texture réservée à l'INTÉRIEUR (placage bois de l'abat-jour, config 01).
    // uInteriorComposite = 1 → l'intérieur utilise uInteriorTex (baseColor).
    shader.uniforms.uInteriorTex = { value: mat.userData.interior.tex ?? getNoiseTexture() };
    shader.uniforms.uInteriorComposite = { value: mat.userData.interior.composite };
    shader.uniforms.uInteriorScale = { value: mat.userData.interior.scale };

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
        // Placage bois : image réelle appliquée UNIQUEMENT à l'intérieur
        // (faces avant) quand uInteriorComposite = 1 (abat-jour config 01).
        bool vmWoodInterior = (!vmExterior) && (uInteriorComposite > 0.5);
        // Le moucheté d'albédo (grain) reste extérieur uniquement.
        if (vmExterior) {
          diffuseColor.rgb *= 1.0 + (gGrain - 0.5) * uSpeckle;
        }
        if (vmWoodInterior) {
          // baseColor = image de placage bois telle quelle (aucune retouche).
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
        // Intérieur en placage bois : finition légèrement satinée (verni léger).
        if (gl_FrontFacing && uInteriorComposite > 0.5) {
          roughnessFactor = 0.5;
        }`
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

/**
 * Active (ou désactive) le placage bois sur la FACE INTÉRIEURE de l'abat-jour.
 * À n'appeler que pour le mesh de l'abat-jour concerné (config 01). L'extérieur
 * n'est jamais modifié. Aucune recompilation, aucun relief.
 */
export function applyInteriorVeneer(
  mat: THREE.MeshPhysicalMaterial,
  enabled: boolean
) {
  mat.userData.interior = {
    composite: enabled ? 1 : 0,
    scale: WOOD_VENEER_SCALE,
    tex: enabled ? getWoodVeneerTexture() : null,
  };
  const shader = mat.userData.shader as
    | { uniforms: Record<string, { value: unknown }> }
    | undefined;
  if (shader) {
    shader.uniforms.uInteriorComposite.value = enabled ? 1 : 0;
    shader.uniforms.uInteriorScale.value = WOOD_VENEER_SCALE;
    if (enabled) shader.uniforms.uInteriorTex.value = getWoodVeneerTexture();
  }
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
}

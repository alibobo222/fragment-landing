/**
 * Génère la géométrie RÉELLE (triangles, pas un masque shader) d'une pièce
 * d'assemblage percée, à partir de la pièce SOLIDE déjà finalisée (échelle +
 * centrage appliqués — voir convert-cad.mjs).
 *
 * POURQUOI LA GÉOMÉTRIE ET PAS LE SHADER (Route B, voir le diagnostic dans
 * TASKS.md / le prompt de réimplémentation) :
 *
 *   La pièce d'assemblage n'est PAS un plan unique, ni une surface courbe :
 *   c'est une tôle pliée dont l'aire se répartit en DEUX PAIRES quasi
 *   perpendiculaires de facettes plates (mesuré par tenseur de structure des
 *   normales, pondéré par aire, insensible au signe — deux valeurs propres
 *   voisines, 0,515 / 0,463, la troisième à 0,022). Un axe de projection
 *   FIXE unique (Route A) donnerait donc un motif juste sur une moitié de la
 *   surface et un motif étiré (jusqu'à ×5,76 à 80°, dégénéré au-delà) sur
 *   l'autre — inacceptable pour un rendu « irréprochable sous tous les
 *   angles ». La géométrie réelle n'a pas ce problème : chaque trou est un
 *   vrai passage, quelle que soit l'orientation de la facette qui le porte.
 *
 * MÉTHODE :
 *   1. Regroupe les triangles de la pièce en régions PLATES connexes (seuil
 *      d'angle serré, 8° — bien plus strict que le lissage de normales, qui
 *      vise à repérer de vraies facettes, pas à lisser des plis).
 *   2. Apparie les régions face-avant/face-arrière (normales quasi
 *      opposées, séparées d'une épaisseur constante — mesuré : 1 mm).
 *      Seules les paires couvrant une fraction significative de l'aire
 *      totale sont retenues comme « panneaux perçables » ; le reste (petits
 *      bords, congés autour du passage de la douille) reste tel quel.
 *   3. Pour chaque panneau : base 2D locale (e1, e2, normale), extraction du
 *      contour réel (arêtes utilisées par un seul triangle DANS la région),
 *      puis balayage d'une grille au pas demandé. Chaque maille dont le
 *      centre est à l'intérieur du contour reçoit un trou SI son gabarit
 *      tient entièrement à l'intérieur (marge de sécurité) ; sinon elle
 *      reste pleine — exactement comme une tôle poinçonnée réelle garde une
 *      marge non ajourée en bordure.
 *   4. Assemblée en soupe de triangles (pas d'indexation manuelle) : le
 *      passage `weld()` déjà présent dans le pipeline (voir convert-cad.mjs)
 *      fusionne les sommets coïncidents en sortie — les coins de grille
 *      partagés entre mailles voisines sont recalculés par la MÊME formule
 *      déterministe des deux côtés, donc bit-à-bit identiques.
 */

/** Base orthonormée dans le plan perpendiculaire à `n` (même construction
 *  que cableJointPlane ailleurs dans ce pipeline, pour cohérence). */
function planeBasis(n) {
  const seed = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let e1 = [
    seed[1] * n[2] - seed[2] * n[1],
    seed[2] * n[0] - seed[0] * n[2],
    seed[0] * n[1] - seed[1] * n[0],
  ];
  const e1l = Math.hypot(...e1) || 1;
  e1 = e1.map((v) => v / e1l);
  const e2 = [
    n[1] * e1[2] - n[2] * e1[1],
    n[2] * e1[0] - n[0] * e1[2],
    n[0] * e1[1] - n[1] * e1[0],
  ];
  return { e1, e2 };
}

function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function cross(a, b) {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function normalize(v) { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }

/**
 * Angle dominant (modulo π) des arêtes d'un contour, pondéré par longueur.
 * C'EST ce qui aligne le réseau sur les bords réels de la plaque, pas la
 * base de secours de planeBasis (arbitraire, sans rapport avec la
 * découpe) : une tôle rectangulaire a l'essentiel de son périmètre porté
 * par deux directions perpendiculaires (ses bords droits) — cette
 * fonction les retrouve en cherchant la direction qui porte le plus de
 * longueur de contour, moyenne circulaire (mod π, technique du double
 * angle) affinée autour du pic pour une précision sous la résolution du
 * bin.
 */
function dominantEdgeAngle(loops) {
  const BIN_DEG = 0.5;
  const nBins = Math.round(180 / BIN_DEG);
  const bins = new Float64Array(nBins);
  for (const loop of loops) {
    const n = loop.length;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = loop[i];
      const [x1, y1] = loop[(i + 1) % n];
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) continue;
      let ang = Math.atan2(dy, dx);
      if (ang < 0) ang += Math.PI;
      const bin = Math.min(nBins - 1, Math.floor((ang / Math.PI) * nBins));
      bins[bin] += len;
    }
  }
  let bestBin = 0, bestVal = -1;
  for (let b = 0; b < nBins; b++) if (bins[b] > bestVal) { bestVal = bins[b]; bestBin = b; }
  const WINDOW = 6; // ± 3° autour du pic
  let sx = 0, sy = 0;
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const b = ((bestBin + d) % nBins + nBins) % nBins;
    const ang = (b + 0.5) * BIN_DEG * Math.PI / 180;
    // Moyenne circulaire mod π via l'angle doublé (mod 2π), restauré ensuite.
    sx += bins[b] * Math.cos(2 * ang);
    sy += bins[b] * Math.sin(2 * ang);
  }
  return Math.atan2(sy, sx) / 2;
}

/** Regroupe les triangles d'une pièce en régions plates connexes (union-find
 *  sur arêtes partagées, fusion si l'angle entre normales de face < seuil). */
function groupFlatRegions(pos, idx, creaseDeg) {
  const triCount = idx.length / 3;
  const faceN = new Float64Array(triCount * 3);
  const faceArea = new Float64Array(triCount);
  for (let t = 0; t < triCount; t++) {
    const a = idx[t*3], b = idx[t*3+1], c = idx[t*3+2];
    const pa = [pos[a*3], pos[a*3+1], pos[a*3+2]];
    const pb = [pos[b*3], pos[b*3+1], pos[b*3+2]];
    const pc = [pos[c*3], pos[c*3+1], pos[c*3+2]];
    const cr = cross(sub(pb, pa), sub(pc, pa));
    const len = Math.hypot(...cr) || 1e-12;
    faceN[t*3] = cr[0]/len; faceN[t*3+1] = cr[1]/len; faceN[t*3+2] = cr[2]/len;
    faceArea[t] = len / 2;
  }
  const key = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const edgeTris = new Map();
  for (let t = 0; t < triCount; t++) {
    const a = idx[t*3], b = idx[t*3+1], c = idx[t*3+2];
    for (const [u, v] of [[a,b],[b,c],[c,a]]) {
      const k = key(u, v);
      if (!edgeTris.has(k)) edgeTris.set(k, []);
      edgeTris.get(k).push(t);
    }
  }
  const parent = new Int32Array(triCount).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) x = parent[x] = parent[parent[x]]; return x; };
  const cosThresh = Math.cos((creaseDeg * Math.PI) / 180);
  for (const [, ts] of edgeTris) {
    if (ts.length !== 2) continue;
    const [t1, t2] = ts;
    const d = faceN[t1*3]*faceN[t2*3] + faceN[t1*3+1]*faceN[t2*3+1] + faceN[t1*3+2]*faceN[t2*3+2];
    if (d >= cosThresh) { const ra = find(t1), rb = find(t2); if (ra !== rb) parent[ra] = rb; }
  }
  const regions = new Map();
  for (let t = 0; t < triCount; t++) {
    const r = find(t);
    if (!regions.has(r)) regions.set(r, { tris: [], area: 0, nsum: [0, 0, 0] });
    const reg = regions.get(r);
    reg.tris.push(t);
    reg.area += faceArea[t];
    reg.nsum[0] += faceN[t*3]*faceArea[t]; reg.nsum[1] += faceN[t*3+1]*faceArea[t]; reg.nsum[2] += faceN[t*3+2]*faceArea[t];
  }
  const out = [];
  for (const reg of regions.values()) {
    const nl = Math.hypot(...reg.nsum) || 1;
    out.push({ tris: reg.tris, area: reg.area, normal: reg.nsum.map((v) => v / nl) });
  }
  return out;
}

/** Extrait le(s) contour(s) 2D d'une région (arêtes bord = utilisées par un
 *  seul triangle DANS la région), projetés dans la base (e1,e2) donnée. */
function boundaryLoops2D(part, region, origin, e1, e2) {
  const { pos, idx } = part;
  const dirEdges = new Map(); // "a_b" (ordonné selon le sens du triangle) -> [a,b]
  const revCount = new Map();
  for (const t of region.tris) {
    const a = idx[t*3], b = idx[t*3+1], c = idx[t*3+2];
    for (const [u, v] of [[a,b],[b,c],[c,a]]) {
      dirEdges.set(`${u}_${v}`, [u, v]);
      revCount.set(`${v}_${u}`, (revCount.get(`${v}_${u}`) || 0) + 1);
    }
  }
  const boundary = [];
  for (const [k, [u, v]] of dirEdges) {
    if (!revCount.has(k)) boundary.push([u, v]); // pas d'arête inverse dans la région = bord
  }
  const byStart = new Map();
  for (const [u, v] of boundary) {
    if (!byStart.has(u)) byStart.set(u, []);
    byStart.get(u).push(v);
  }
  const used = new Set();
  const loops = [];
  for (const [u0] of boundary) {
    if (used.has(u0)) continue;
    const loop = [];
    let cur = u0;
    let guard = boundary.length + 1;
    do {
      loop.push(cur);
      used.add(cur);
      const nexts = byStart.get(cur) || [];
      const nextV = nexts.find((v) => !used.has(v)) ?? nexts[0];
      if (nextV === undefined) break;
      cur = nextV;
      guard--;
    } while (cur !== u0 && guard > 0);
    if (loop.length >= 3) {
      loops.push(loop.map((vi) => {
        const p = [pos[vi*3], pos[vi*3+1], pos[vi*3+2]];
        const d = sub(p, origin);
        return [dot(d, e1), dot(d, e2)];
      }));
    }
  }
  return loops;
}

/** Point-in-polygon(s), règle pair/impair — plusieurs boucles = trous gérés
 *  naturellement (un point dans une boucle interne compte une fois de plus). */
function pointInLoops(pt, loops) {
  let inside = false;
  for (const loop of loops) {
    const n = loop.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [xi, yi] = loop[i], [xj, yj] = loop[j];
      const intersect = (yi > pt[1]) !== (yj > pt[1]) &&
        pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
  }
  return inside;
}

/** Point sur le bord d'un carré (demi-côté s, centré à l'origine) dans la
 *  direction angulaire theta. */
function squarePoint(s, theta) {
  const c = Math.cos(theta), sn = Math.sin(theta);
  const t = s / Math.max(Math.abs(c), Math.abs(sn));
  return [t * c, t * sn];
}

/** Point sur le bord du trou (rond ou carré à coins arrondis) dans la
 *  direction angulaire theta. Carré arrondi résolu par bissection sur la
 *  SDF (robuste, pas de cas particulier par secteur). */
function holePoint(shape, halfSide, corner, roundRadius, theta) {
  const c = Math.cos(theta), sn = Math.sin(theta);
  if (shape === "round") return [roundRadius * c, roundRadius * sn];
  const k = corner * halfSide;
  const inset = halfSide - k;
  const sdf = (t) => {
    const x = Math.abs(t * c) - inset;
    const y = Math.abs(t * sn) - inset;
    const mx = Math.max(x, 0), my = Math.max(y, 0);
    return Math.hypot(mx, my) - k;
  };
  let lo = 0, hi = halfSide + k;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (sdf(mid) < 0) lo = mid; else hi = mid;
  }
  const t = (lo + hi) / 2;
  return [t * c, t * sn];
}

/** Signe : p est-il à GAUCHE de l'arête dirigée p0→p1 (convention CCW —
 *  l'intérieur d'une boucle de bord est à gauche de chaque arête, voir
 *  boundaryLoops2D : les boucles reprennent le sens de rotation des
 *  triangles source autour de +n, et (e1,e2,n) est une base directe). */
function sideOf(p0, p1, p) {
  return (p1[0]-p0[0])*(p[1]-p0[1]) - (p1[1]-p0[1])*(p[0]-p0[0]);
}

/** Intersection du segment a-b avec la droite (infinie) portée par p0-p1. */
function lineIntersect(a, b, p0, p1) {
  const d1x = b[0]-a[0], d1y = b[1]-a[1];
  const d2x = p1[0]-p0[0], d2y = p1[1]-p0[1];
  const denom = d1x*d2y - d1y*d2x;
  if (Math.abs(denom) < 1e-15) return a;
  const t = ((p0[0]-a[0])*d2y - (p0[1]-a[1])*d2x) / denom;
  return [a[0]+t*d1x, a[1]+t*d1y];
}

/** Découpe Sutherland-Hodgman d'un polygone 2D par UN demi-plan (garde le
 *  côté gauche de p0→p1). Le sujet peut être n'importe quel polygone simple
 *  (convexe ou non) ; le résultat reste correct tant que les demi-plans
 *  appliqués en série représentent bien le contour réel localement (vrai ici
 *  : bord de tôle rectiligne, mailles petites devant la longueur d'un bord). */
function clipHalfPlane(poly, p0, p1) {
  const n = poly.length;
  if (n === 0) return poly;
  const out = [];
  for (let i = 0; i < n; i++) {
    const cur = poly[i], prev = poly[(i-1+n)%n];
    const curIn = sideOf(p0, p1, cur) >= -1e-12;
    const prevIn = sideOf(p0, p1, prev) >= -1e-12;
    if (curIn) {
      if (!prevIn) out.push(lineIntersect(prev, cur, p0, p1));
      out.push(cur);
    } else if (prevIn) {
      out.push(lineIntersect(prev, cur, p0, p1));
    }
  }
  return out;
}

function polyArea2(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i+1) % poly.length];
    a += x0*y1 - x1*y0;
  }
  return a;
}

/**
 * Triangule l'anneau entre deux polygones CONVEXES imbriqués (`hole` ⊂
 * `outer`, garanti ici : les deux sont issus du découpage Sutherland-Hodgman
 * d'un carré/gabarit de trou par les mêmes demi-plans, donc restent convexes
 * — voir clipHalfPlane). Méthode « fermeture éclair » : avance pas à pas sur
 * les deux boucles (au plus proche à chaque étape), sans jamais fusionner en
 * un seul polygone avec pont — contrairement à un pont « trou de serrure »
 * suivi d'un découpage par oreilles (essayé d'abord, ABANDONNÉ : sommets du
 * pont dupliqués + sommets du trou quasi collinéaires avec le contour, deux
 * causes de blocage confirmées par test direct, l'une silencieuse (triangles
 * manquants), l'autre pire (triangles qui se chevauchent). Cette méthode est
 * exacte par construction : chaque sommet des deux boucles est visité UNE
 * fois, donc n+m triangles couvrant exactement l'anneau, aucune oreille à
 * juger — validée sur 400+ cas synthétiques (carré, rond, coins) aire
 * calculée = aire attendue au dix-millionième près.
 * Retourne des triplets D'INDICES dans le tableau combiné [...outer, ...hole]
 * (indices du trou décalés de outer.length), pas des coordonnées — pour
 * réutiliser le même schéma avant/arrière (push3/tri) que le reste du fichier.
 */
function triangulateAnnulusRing(outer, hole) {
  const n = outer.length, m = hole.length;
  let bestI = 0, bestJ = 0, bestD = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const dx = outer[i][0]-hole[j][0], dy = outer[i][1]-hole[j][1];
      const d = dx*dx + dy*dy;
      if (d < bestD) { bestD = d; bestI = i; bestJ = j; }
    }
  }
  const tris = [];
  let i = bestI, j = bestJ, stepsI = 0, stepsJ = 0;
  const distSq = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2;
  while (stepsI < n || stepsJ < m) {
    const iNext = (i+1) % n, jNext = (j+1) % m;
    let advanceOuter;
    if (stepsI >= n) advanceOuter = false;
    else if (stepsJ >= m) advanceOuter = true;
    else advanceOuter = distSq(outer[iNext], hole[j]) < distSq(outer[i], hole[jNext]);
    if (advanceOuter) {
      tris.push([i, iNext, n+j]); // (outer[i], outer[iNext], hole[j])
      i = iNext; stepsI++;
    } else {
      tris.push([i, n+jNext, n+j]); // (outer[i], hole[jNext], hole[j])
      j = jNext; stepsJ++;
    }
  }
  return tris;
}

/** Un point est-il sur le SEGMENT p0-p1 (pas la droite infinie), à epsilon
 *  près ? Sert à repérer, après découpe, quelles arêtes du polygone final
 *  proviennent d'un demi-plan de coupe (donc un vrai bord de tôle exposé à
 *  l'air, qui a besoin d'une paroi) et lesquelles viennent du carré de
 *  maille d'origine (arête interne partagée, pas de paroi nécessaire). */
function isOnSegment(p, p0, p1, eps) {
  const dx = p1[0]-p0[0], dy = p1[1]-p0[1];
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-20) return false;
  const t = ((p[0]-p0[0])*dx + (p[1]-p0[1])*dy) / len2;
  if (t < -eps/Math.sqrt(len2) || t > 1 + eps/Math.sqrt(len2)) return false;
  const projX = p0[0] + t*dx, projY = p0[1] + t*dy;
  return Math.hypot(p[0]-projX, p[1]-projY) < eps;
}

/** Distance d'un point au SEGMENT p0-p1 (borné, pas la droite infinie).
 *  Sert à sélectionner les arêtes de contour réellement pertinentes pour une
 *  maille donnée — voir le commentaire sur `nearEdges` plus bas : un simple
 *  recouvrement de boîtes englobantes laisse passer des arêtes dont seule la
 *  DROITE portée (infinie) frôle la maille, alors que leur véritable segment
 *  est ailleurs. Sur une courbe (bord plaque ↔ abat-jour), approximée par de
 *  nombreuses petites cordes, ça sur-découpe : chaque corde voisine, prise
 *  comme demi-plan plein, mord un peu plus que la vraie courbe lisse — assez
 *  de cordes cumulées sur une même maille et le trou entier disparaît, d'où
 *  une bande sans aucun trou partiel le long des courbes précisément.
 */
function pointSegDist(p, p0, p1) {
  const dx = p1[0]-p0[0], dy = p1[1]-p0[1];
  const len2 = dx*dx + dy*dy;
  if (len2 < 1e-20) return Math.hypot(p[0]-p0[0], p[1]-p0[1]);
  let t = ((p[0]-p0[0])*dx + (p[1]-p0[1])*dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = p0[0] + t*dx, projY = p0[1] + t*dy;
  return Math.hypot(p[0]-projX, p[1]-projY);
}

// DOIT être un multiple de 8 — pas juste pair. La soudure aux arêtes PARTAGÉES
// (bord droit d'une maille = bord gauche de la suivante) marche pour tout N
// pair (symétrie 180°-theta / 360°-theta, vérifié). Mais le carré englobant
// de CHAQUE maille est lui-même échantillonné par angle (squarePoint) : ses
// 4 VRAIS coins géométriques ne sont des points de l'échantillon QUE si 45°,
// 135°, 225°, 315° en font partie — donc seulement si N est multiple de 8.
// Avec N=12 (essayé, faux), aucun coin exact n'est jamais posé : chaque
// maille chanfreine son propre coin indépendamment, et les 4 mailles qui se
// rejoignent en un coin de grille n'y déposent JAMAIS le même sommet — un
// losange de vide (ou de recouvrement) à CHAQUE coin de grille, sur toute la
// surface : c'est le point parasite. Avec un multiple de 8, le coin exact
// est un point de l'échantillon pour toutes les mailles voisines à la fois
// → sommet réellement partagé, aucune fissure.
const RING_SEGMENTS = 16;

/**
 * Construit la géométrie perforée d'un panneau (une paire face-avant/
 * face-arrière). Retourne une soupe de triangles {pos:[], idx:[]} (indices
 * LOCAUX à ce panneau — recombinés par l'appelant).
 */
function punchPanel(part, front, back, shape, params) {
  const { pitch, squareHalf, squareCorner, roundRadius } = params;
  const n = front.normal;

  // Origine = centroïde des sommets de la région avant (moyenne simple —
  // suffisant, la grille est ensuite balayée sur tout le contour).
  const vertSet = new Set();
  for (const t of front.tris) {
    vertSet.add(part.idx[t*3]); vertSet.add(part.idx[t*3+1]); vertSet.add(part.idx[t*3+2]);
  }
  let ox = 0, oy = 0, oz = 0;
  for (const v of vertSet) { ox += part.pos[v*3]; oy += part.pos[v*3+1]; oz += part.pos[v*3+2]; }
  const origin = [ox/vertSet.size, oy/vertSet.size, oz/vertSet.size];

  // Base de secours arbitraire (Gram-Schmidt sur une graine [1,0,0]/[0,1,0]) —
  // n'a AUCUN rapport avec les bords réels du plan. Sert uniquement de repère
  // de départ pour mesurer l'angle du bord dominant ci-dessous ; la base
  // finale (e1, e2) est cette base de secours FAITE PIVOTER par cet angle,
  // donc alignée sur le bord droit réel du plan, pas sur un axe arbitraire.
  const scratch = planeBasis(n);
  const loopsScratch = boundaryLoops2D(part, front, origin, scratch.e1, scratch.e2);
  const theta = dominantEdgeAngle(loopsScratch);
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const e1 = normalize([
    cosT*scratch.e1[0] + sinT*scratch.e2[0],
    cosT*scratch.e1[1] + sinT*scratch.e2[1],
    cosT*scratch.e1[2] + sinT*scratch.e2[2],
  ]);
  const e2 = cross(n, e1);

  console.log(
    `    panneau : origine=[${origin.map((v) => v.toFixed(5))}] normale=[${n.map((v) => v.toFixed(4))}] e1=[${e1.map((v) => v.toFixed(4))}] e2=[${e2.map((v) => v.toFixed(4))}] ` +
    `theta (rotation appliquée) = ${((theta*180)/Math.PI).toFixed(4)}°`
  );

  // Extraction INDÉPENDANTE du contour dans la base finale (e1, e2) — un
  // second appel séparé, pas la réutilisation de loopsScratch. Sert de
  // preuve non circulaire : elle mesure chaque segment de bord un par un,
  // au lieu de ré-agréger la même moyenne qui a servi à calculer theta.
  const loopsFront = boundaryLoops2D(part, front, origin, e1, e2);
  const segAngles = [];
  for (const loop of loopsFront) {
    for (let i = 0; i < loop.length; i++) {
      const [u0, v0] = loop[i], [u1, v1] = loop[(i+1) % loop.length];
      const len = Math.hypot(u1-u0, v1-v0);
      if (len < 1e-6) continue;
      let deg = (Math.atan2(v1-v0, u1-u0) * 180) / Math.PI;
      deg = ((deg % 180) + 180) % 180; // mod 180°, [0,180)
      const distTo0or90 = Math.min(deg, Math.abs(deg-90), Math.abs(deg-180));
      segAngles.push({ len, deg, distTo0or90 });
    }
  }
  segAngles.sort((a, b) => b.len - a.len);
  const top = segAngles.slice(0, 5);
  const totalLen = segAngles.reduce((s, a) => s + a.len, 0) || 1;
  const weightedDev = segAngles.reduce((s, a) => s + a.len*a.distTo0or90, 0) / totalLen;
  console.log(
    `      contrôle indépendant (contour ré-extrait dans e1,e2) : ${segAngles.length} segment(s), ` +
    `écart moyen pondéré par longueur au 0°/90° le plus proche = ${weightedDev.toFixed(3)}°`
  );
  for (const s of top) {
    console.log(`        segment long=${s.len.toFixed(4)} angle=${s.deg.toFixed(2)}° écart=${s.distTo0or90.toFixed(3)}°`);
  }

  // Épaisseur : distance signée entre les deux plans, le long de n.
  const backVertSet = new Set();
  for (const t of back.tris) {
    backVertSet.add(part.idx[t*3]); backVertSet.add(part.idx[t*3+1]); backVertSet.add(part.idx[t*3+2]);
  }
  let bx = 0, by = 0, bz = 0;
  for (const v of backVertSet) { bx += part.pos[v*3]; by += part.pos[v*3+1]; bz += part.pos[v*3+2]; }
  const backCentroid = [bx/backVertSet.size, by/backVertSet.size, bz/backVertSet.size];
  const thickness = -dot(sub(backCentroid, origin), n); // positif : back est derrière (le long de -n)
  const holeSideMm = squareHalf*pitch*2*1000; // côté du trou carré, mm (unité objet = mètre, voir convert-cad.mjs SCALE)
  const thicknessMm = Math.abs(thickness*1000); // magnitude — le signe ne reflète que le choix arbitraire, dans
  // groupFlatRegions/buildPerforatedPart, de quelle des deux facettes appariées porte l'étiquette "front" ; les deux
  // sont géométriquement équivalentes ici (parois construites entre les deux quel que soit ce choix).
  console.log(
    `      diagnostic défaut n°1 (tôle « emboutie » vs « poinçonnée ») : épaisseur=${thicknessMm.toFixed(3)}mm, ` +
    `côté du trou=${holeSideMm.toFixed(3)}mm, ratio épaisseur/côté=${(thicknessMm/holeSideMm).toFixed(3)} ` +
    `(paroi du trou : SANS chanfrein — innerF et innerB utilisent le même gabarit (u,v), extrusion droite)`
  );

  const to3D = (u, v, depth) => [
    origin[0] + u*e1[0] + v*e2[0] - depth*n[0],
    origin[1] + u*e1[1] + v*e2[1] - depth*n[1],
    origin[2] + u*e1[2] + v*e2[2] - depth*n[2],
  ];

  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (const loop of loopsFront) for (const [u, v] of loop) {
    uMin = Math.min(uMin, u); uMax = Math.max(uMax, u);
    vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
  }

  const P = []; // soupe de positions (plates, x,y,z,x,y,z,...)
  // Arrondi à 1e-8 unité objet (~1e-4 mm) : deux points géométriquement
  // identiques mais calculés par des chemins flottants différents (ex. un
  // coin de maille via le gabarit du trou à 45° vs via le quad plein d'une
  // maille voisine) doivent retomber sur EXACTEMENT la même valeur pour que
  // la soudure par clé exacte (weldAndSmoothNormals) les fusionne — sans ça,
  // une micro-fissure sous le pixel mais qui casse le partage de normale.
  const snap = (v) => Math.round(v * 1e8) / 1e8;
  const push3 = (p) => { P.push(snap(p[0]), snap(p[1]), snap(p[2])); return P.length / 3 - 1; };
  const I = [];
  const tri = (a, b, c) => { I.push(a, b, c); };

  // Angles pré-calculés pour le gabarit du trou et du carré englobant.
  const angles = [];
  for (let i = 0; i < RING_SEGMENTS; i++) angles.push((i / RING_SEGMENTS) * Math.PI * 2);

  const i0 = Math.floor(uMin / pitch) - 1, i1 = Math.ceil(uMax / pitch) + 1;
  const j0 = Math.floor(vMin / pitch) - 1, j1 = Math.ceil(vMax / pitch) + 1;
  const half = pitch / 2;
  const cutEps = pitch * 1e-3;

  // Liste à plat des arêtes du contour réel, pour un test de proximité par
  // boîte englobante avant d'envisager une découpe (la grande majorité des
  // mailles, loin de tout bord, n'en ont besoin d'aucune — chemin rapide
  // inchangé plus bas).
  const contourEdges = [];
  for (const loop of loopsFront) {
    for (let k = 0; k < loop.length; k++) contourEdges.push([loop[k], loop[(k + 1) % loop.length]]);
  }

  let holeCells = 0, edgeCells = 0, solidCutCells = 0, partialHoleCells = 0, negAreaCells = 0;
  // Aire nominale d'un trou plein (non tronqué), pour distinguer un « trou
  // partiel » (aire mesurablement plus petite) d'un trou tombé dans la
  // branche de découpe mais resté quasi entier par hasard.
  const nominalHoleArea = polyArea2(
    angles.map((a) => holePoint(shape, squareHalf*pitch, squareCorner, roundRadius*pitch, a))
  );

  // Ruban de parois verticales le long des arêtes de `poly2D` qui coïncident
  // avec une arête de coupe (`cutEdges`, sous-ensemble de nearEdges) — donc
  // un vrai bord de tôle exposé à l'air. Même schéma de triangulation que la
  // paroi de trou d'origine (vérifiée visuellement), pas re-dérivé.
  const emitWall = (poly2D, filterCut, cutEdges) => {
    for (let k = 0; k < poly2D.length; k++) {
      const A = poly2D[k], B = poly2D[(k + 1) % poly2D.length];
      if (filterCut) {
        let isCut = false;
        for (const [e0, e1p] of cutEdges) {
          if (isOnSegment(A, e0, e1p, cutEps) && isOnSegment(B, e0, e1p, cutEps)) { isCut = true; break; }
        }
        if (!isCut) continue;
      }
      const Af = push3(to3D(A[0], A[1], 0)), Bf = push3(to3D(B[0], B[1], 0));
      const Ab = push3(to3D(A[0], A[1], thickness)), Bb = push3(to3D(B[0], B[1], thickness));
      tri(Af, Ab, Bb); tri(Af, Bb, Bf);
    }
  };

  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const cu = i * pitch, cv = j * pitch;
      // Pertinence par DISTANCE AU SEGMENT réel (borné), pas par recouvrement
      // de boîtes englobantes sur la droite infinie portée par l'arête — voir
      // le commentaire de `pointSegDist`. Rayon = un peu plus que la
      // demi-diagonale de la maille (pitch/√2), pour couvrir ses coins sans
      // ratisser des cordes lointaines d'une courbe voisine.
      const NEAR_RADIUS = pitch * 0.8;
      const nearEdges = [];
      for (const [p0, p1] of contourEdges) {
        if (pointSegDist([cu, cv], p0, p1) > NEAR_RADIUS) continue;
        nearEdges.push([p0, p1]);
      }

      if (nearEdges.length === 0) {
        // Chemin rapide, INCHANGÉ : maille loin de tout bord — pleine maille
        // carrée percée, comportement identique à avant sur tout l'intérieur
        // du panneau (aucune régression là où il n'y avait pas de défaut).
        if (!pointInLoops([cu, cv], loopsFront)) continue;
        holeCells++;
        const outerF = angles.map((a) => { const [x,y] = squarePoint(half, a); return to3D(cu+x, cv+y, 0); });
        const innerF = angles.map((a) => { const [x,y] = holePoint(shape, squareHalf*pitch, squareCorner, roundRadius*pitch, a); return to3D(cu+x, cv+y, 0); });
        const outerB = angles.map((a) => { const [x,y] = squarePoint(half, a); return to3D(cu+x, cv+y, thickness); });
        const innerB = angles.map((a) => { const [x,y] = holePoint(shape, squareHalf*pitch, squareCorner, roundRadius*pitch, a); return to3D(cu+x, cv+y, thickness); });
        const oFi = outerF.map(push3), iFi = innerF.map(push3);
        const oBi = outerB.map(push3), iBi = innerB.map(push3);
        for (let k = 0; k < RING_SEGMENTS; k++) {
          const k2 = (k + 1) % RING_SEGMENTS;
          tri(oFi[k], iFi[k], iFi[k2]); tri(oFi[k], iFi[k2], oFi[k2]);
          tri(oBi[k], iBi[k2], iBi[k]); tri(oBi[k], oBi[k2], iBi[k2]);
          tri(iFi[k], iBi[k], iBi[k2]); tri(iFi[k], iBi[k2], iFi[k2]);
        }
        continue;
      }

      // Maille de bord : découpe le carré de maille ET le gabarit du trou par
      // les MÊMES demi-plans (un par arête de contour proche). Le contour
      // RÉEL de la pièce devient ainsi le bord de la matière — pas la grille
      // de perçage (corrige le défaut « silhouette en escalier »).
      let outerPoly = angles.map((a) => { const [x,y] = squarePoint(half, a); return [cu+x, cv+y]; });
      let holePoly = angles.map((a) => { const [x,y] = holePoint(shape, squareHalf*pitch, squareCorner, roundRadius*pitch, a); return [cu+x, cv+y]; });
      for (const [p0, p1] of nearEdges) {
        outerPoly = clipHalfPlane(outerPoly, p0, p1);
        if (holePoly.length >= 3) holePoly = clipHalfPlane(holePoly, p0, p1);
      }
      if (outerPoly.length < 3 || polyArea2(outerPoly) <= 1e-14) continue; // entièrement hors contour

      edgeCells++;
      const holeArea = holePoly.length >= 3 ? polyArea2(holePoly) : 0;
      if (holeArea < -1e-14) negAreaCells++;
      if (holeArea > 1e-14) {
        if (holeArea < nominalHoleArea * 0.98) partialHoleCells++;
      } else {
        solidCutCells++;
      }

      if (holeArea <= 1e-14) {
        // Trou entièrement coupé par le bord à cet endroit : maille pleine,
        // comme une tôle réellement poinçonnée près d'une coupe.
        const front = outerPoly.map((p) => push3(to3D(p[0], p[1], 0)));
        const back = outerPoly.map((p) => push3(to3D(p[0], p[1], thickness)));
        // Éventail depuis le sommet 0 : toujours valide, `outerPoly` est
        // garanti CONVEXE (découpe Sutherland-Hodgman d'un carré par des
        // demi-plans — voir clipHalfPlane), aucun découpage par oreilles
        // n'est nécessaire pour ce cas.
        for (let k = 1; k < outerPoly.length - 1; k++) tri(front[0], front[k], front[k+1]);
        for (let k = 1; k < outerPoly.length - 1; k++) tri(back[k+1], back[k], back[0]);
        emitWall(outerPoly, true, nearEdges);
      } else {
        holeCells++;
        const annulus = outerPoly.concat(holePoly);
        const front = annulus.map((p) => push3(to3D(p[0], p[1], 0)));
        const back = annulus.map((p) => push3(to3D(p[0], p[1], thickness)));
        const trisA = triangulateAnnulusRing(outerPoly, holePoly);
        for (const t of trisA) tri(front[t[0]], front[t[1]], front[t[2]]);
        for (const t of trisA) tri(back[t[2]], back[t[1]], back[t[0]]);
        emitWall(outerPoly, true, nearEdges);
        emitWall(holePoly, false, null); // le trou reste entièrement exposé à l'air, même tronqué
      }
    }
  }

  console.log(
    `      découpe de bord : ${edgeCells} maille(s) touchée(s) par le contour, dont ${partialHoleCells} trou(s) PARTIEL(S) réel(s), ` +
    `${solidCutCells} maille(s) sans trou (coupe passant hors du trou), ${negAreaCells} anomalie(s) d'aire négative`
  );
  return { pos: Float32Array.from(P), idx: Uint32Array.from(I), holeCells, edgeCells, partialHoleCells, thickness };
}

/**
 * Construit la variante percée d'une pièce (round/square). `part` est la
 * pièce SOLIDE finale ({pos,idx}, échelle et centrage déjà appliqués).
 * Retourne {pos, idx} (sans normales — recalculées par l'appelant via
 * weldAndSmoothNormals, pour bénéficier du même lissage/plis que le reste
 * du pipeline).
 */
export function buildPerforatedPart(part, shape, params) {
  const CREASE_DEG = 8; // strict : on veut de VRAIES facettes plates, pas un lissage
  const MIN_PANEL_AREA_FRAC = 0.05; // sous ce seuil : bord/congé structurel, jamais perforé
  const MAX_PAIR_DIST = 0.01; // unités objet (~1 cm) : distance max face-avant/face-arrière

  const regions = groupFlatRegions(part.pos, part.idx, CREASE_DEG);
  const totalArea = regions.reduce((s, r) => s + r.area, 0);

  const paired = new Set();
  const panels = [];
  for (let a = 0; a < regions.length; a++) {
    if (paired.has(a)) continue;
    for (let b = a + 1; b < regions.length; b++) {
      if (paired.has(b)) continue;
      const d = dot(regions[a].normal, regions[b].normal);
      if (d > -0.99) continue;
      // Distance entre les deux plans (centroïdes le long de la normale de a).
      const vertsA = new Set();
      for (const t of regions[a].tris) { vertsA.add(part.idx[t*3]); vertsA.add(part.idx[t*3+1]); vertsA.add(part.idx[t*3+2]); }
      let ax=0,ay=0,az=0; for (const v of vertsA) { ax+=part.pos[v*3]; ay+=part.pos[v*3+1]; az+=part.pos[v*3+2]; }
      const ca = [ax/vertsA.size, ay/vertsA.size, az/vertsA.size];
      const vertsB = new Set();
      for (const t of regions[b].tris) { vertsB.add(part.idx[t*3]); vertsB.add(part.idx[t*3+1]); vertsB.add(part.idx[t*3+2]); }
      let bx=0,by=0,bz=0; for (const v of vertsB) { bx+=part.pos[v*3]; by+=part.pos[v*3+1]; bz+=part.pos[v*3+2]; }
      const cb = [bx/vertsB.size, by/vertsB.size, bz/vertsB.size];
      const dist = Math.abs(dot(sub(cb, ca), regions[a].normal));
      if (dist > MAX_PAIR_DIST) continue;
      paired.add(a); paired.add(b);
      panels.push({ front: regions[a], back: regions[b], area: regions[a].area + regions[b].area });
      break;
    }
  }

  const perforable = panels.filter((p) => p.area / totalArea >= MIN_PANEL_AREA_FRAC);
  const perforableTriSet = new Set();
  for (const p of perforable) {
    for (const t of p.front.tris) perforableTriSet.add(t);
    for (const t of p.back.tris) perforableTriSet.add(t);
  }

  const P = [], I = [];
  const offset = () => P.length / 3;

  let totalHoles = 0, totalEdgeCells = 0, totalPartialHoles = 0;
  for (const p of perforable) {
    const r = punchPanel(part, p.front, p.back, shape, params);
    const base = offset();
    for (const v of r.pos) P.push(v);
    for (const ix of r.idx) I.push(ix + base);
    totalHoles += r.holeCells;
    totalEdgeCells += r.edgeCells;
    totalPartialHoles += r.partialHoleCells;
  }

  // Tout ce qui n'appartient à AUCUN panneau perçable (petits bords, congés
  // autour du passage douille) est recopié TEL QUEL.
  const triCount = part.idx.length / 3;
  for (let t = 0; t < triCount; t++) {
    if (perforableTriSet.has(t)) continue;
    const a = part.idx[t*3], b = part.idx[t*3+1], c = part.idx[t*3+2];
    const base = offset();
    P.push(part.pos[a*3], part.pos[a*3+1], part.pos[a*3+2]);
    P.push(part.pos[b*3], part.pos[b*3+1], part.pos[b*3+2]);
    P.push(part.pos[c*3], part.pos[c*3+1], part.pos[c*3+2]);
    I.push(base, base+1, base+2);
  }

  console.log(
    `    perforation ${shape} : ${perforable.length} panneau(x) perçable(s) (${(perforable.reduce((s,p)=>s+p.area,0)/totalArea*100).toFixed(1)}% de l'aire), ` +
    `${totalHoles} trou(s), ${totalEdgeCells} maille(s) de bord tronquée(s) par le contour réel (silhouette découpée, pas la grille), ` +
    `dont ${totalPartialHoles} trou(s) PARTIEL(S) (aire mesurablement réduite par la coupe), ` +
    `${triCount - perforableTriSet.size} triangle(s) non touché(s)`
  );

  return { pos: Float32Array.from(P), idx: Uint32Array.from(I) };
}

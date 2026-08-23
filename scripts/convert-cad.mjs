/**
 * Pipeline CAO → GLB pour la lampe Noir Minéral.
 *
 * Source : cad-sources/lampe2a.IGS (IGES ASCII SolidWorks, millimètres).
 *   Les fichiers b/c sont le même modèle à d'autres orientations de l'abat-jour.
 *   Les .SLDASM/.SLDPRT/.SLDDRW (binaires) et .bip (KeyShot) ne sont pas
 *   lisibles sans SolidWorks/KeyShot — l'IGES suffit ici.
 *
 * Outil : occt-import-js (OpenCASCADE compilé en WebAssembly) tessellise
 *   l'IGES ; @gltf-transform assemble un GLB optimisé.
 *
 * Le fichier IGES contient trois nœuds (petit / grand / ampoule2). On les
 * découpe en composantes connexes pour isoler cinq volumes sémantiques :
 *   Shade (abat-jour), Connector (pièce métallique), Base (pied),
 *   Cable (câble), Bulb (ampoule).
 *
 * Usage : npm run cad
 * Ne modifie jamais les sources (lecture seule).
 */
import occtimportjs from "occt-import-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { weld, dedup, prune } from "@gltf-transform/functions";
import { buildPerforatedPart } from "./perforation-mesh.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "cad-sources", "lampe2a.IGS");
const OUT = join(root, "public", "models", "lampe-optimisee.glb");

const occt = await occtimportjs();
const res = occt.ReadIgesFile(new Uint8Array(readFileSync(SRC)), {
  linearUnit: "millimeter",
  linearDeflectionType: "bounding_box_ratio",
  linearDeflection: 0.004,
  angularDeflection: 0.35,
});
if (!res.success) throw new Error("Lecture IGES échouée");

/**
 * Découpe une soupe de triangles en composantes connexes (weld 0,1 mm).
 *
 * `faceRanges` (optionnel) est le tableau `brep_faces` d'occt-import-js —
 * `[{first, last}, ...]`, bornes de triangles (inclusives, indexées comme
 * `index`) d'une face B-Rep d'origine de l'IGES. Quand il est fourni, chaque
 * composante retourne un `faceId` (un entier par triangle, dans l'ordre de
 * `idx`) qui identifie sa face B-Rep d'origine — consommé par
 * `splitSocketCable` pour classifier une face ENTIÈRE d'un coup plutôt que
 * triangle par triangle (voir sa doc pour le pourquoi).
 */
function components(pos, index, normal, faceRanges) {
  const kkey = (i) =>
    `${Math.round(pos[i * 3] * 10)}_${Math.round(pos[i * 3 + 1] * 10)}_${Math.round(pos[i * 3 + 2] * 10)}`;
  const rep = new Map();
  const vid = new Int32Array(pos.length / 3);
  let nid = 0;
  for (let i = 0; i < vid.length; i++) {
    const k = kkey(i);
    if (!rep.has(k)) rep.set(k, nid++);
    vid[i] = rep.get(k);
  }
  const parent = new Int32Array(nid).map((_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  for (let t = 0; t < index.length; t += 3) {
    const r = find(vid[index[t]]);
    parent[find(vid[index[t + 1]])] = r;
    parent[find(vid[index[t + 2]])] = r;
  }
  // Triangle (0-based) → indice de face B-Rep d'origine, si fourni.
  let triFace = null;
  if (faceRanges) {
    triFace = new Int32Array(index.length / 3);
    for (let fi = 0; fi < faceRanges.length; fi++) {
      const { first, last } = faceRanges[fi];
      for (let t = first; t <= last; t++) triFace[t] = fi;
    }
  }
  const groups = new Map();
  for (let t = 0; t < index.length; t += 3) {
    const r = find(vid[index[t]]);
    if (!groups.has(r)) groups.set(r, { tris: [], faces: [] });
    const g = groups.get(r);
    g.tris.push(index[t], index[t + 1], index[t + 2]);
    if (triFace) g.faces.push(triFace[t / 3]);
  }
  return [...groups.values()].map(({ tris, faces }) => {
    const remap = new Map();
    const P = [], N = [], I = [];
    for (const oi of tris) {
      if (!remap.has(oi)) {
        remap.set(oi, P.length / 3);
        P.push(pos[oi * 3], pos[oi * 3 + 1], pos[oi * 3 + 2]);
        if (normal) N.push(normal[oi * 3], normal[oi * 3 + 1], normal[oi * 3 + 2]);
      }
      I.push(remap.get(oi));
    }
    const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (let i = 0; i < P.length; i += 3)
      for (let k = 0; k < 3; k++) {
        b[k] = Math.min(b[k], P[i + k]);
        b[3 + k] = Math.max(b[3 + k], P[i + k]);
      }
    const center = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
    const size = [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
    return {
      pos: new Float32Array(P),
      nrm: normal ? new Float32Array(N) : null,
      idx: Uint32Array.from(I),
      faceId: faces.length ? Uint32Array.from(faces) : null,
      center,
      size,
      dist: Math.hypot(center[0], center[1], center[2]),
      tris: I.length / 3,
    };
  });
}

const byNode = {};
for (const n of res.root.children) {
  const m = res.meshes[n.meshes[0]];
  byNode[n.name] = components(
    m.attributes.position.array,
    m.index.array,
    m.attributes.normal?.array,
    m.brep_faces
  );
}

// Classification sémantique (déterminée par inspection géométrique) :
/**
 * Scinde douille (métal) / fil (textile) par FACE B-REP D'ORIGINE (occt
 * `brep_faces`), jamais triangle par triangle.
 *
 * Un premier critère par triangle (axial + radial sur le barycentre) créait
 * une « couronne de facettes » colorées câble à la jonction, visible sur la
 * lampe assemblée ET la vue éclatée : diagnostiqué en dumpant les triangles
 * à ±5 mm de la jonction (proj, rayon, appartenance) puis en projetant la
 * géométrie brute en 2D — voir la vue en bout, qui montre un CÔNE continu
 * (le manchon qui resserre la douille sur le câble, une face IGES à part
 * entière, rayon ~4 à ~20 mm) coupé par la moitié par le seuil de rayon :
 * le rayon y varie CONTINÛMENT le long de la face, pas de façon bimodale —
 * un critère par triangle ne peut alors que trancher au milieu de la face,
 * pas à son bord.
 *
 * Le rayon PAR TRIANGLE n'est donc pas le bon critère à la jonction. Le
 * rayon MAX D'UNE FACE ENTIÈRE, lui, l'est : le fil textile (une face
 * unique de ~400 mm de long, occt en fait deux moitiés) ne dépasse jamais
 * quelques mm de rayon nulle part sur sa longueur, alors que toute face
 * métallique (manchon compris) dépasse largement rThresh quelque part sur
 * son étendue. Chaque face est donc classée EN BLOC :
 *
 *   1. étendue axiale (maxProj - minProj) > SPAN_THRESH → CÂBLE d'office.
 *      Seul le fil, qui court sur ~400 mm, a une étendue pareille ; les faces
 *      métalliques de jonction, même les plus longues mesurées (~49 mm, un
 *      corps de douille qui s'étire sur sa longueur), restent très en-deçà.
 *   2. sinon, hors de la zone de jonction (minProj > socketEnd) → CÂBLE.
 *      Protège une face courte et lointaine (un détail quelconque du fil,
 *      loin de la douille) contre une lecture de rayon faussée par la
 *      courbure du câble à cette distance de cNear (voir cableJointPlane) —
 *      elle ne passe même pas au test de rayon.
 *   3. sinon, rayon max (ancré sur cNear — fiable ici : la zone de jonction
 *      est courte et proche de cNear) > rThresh → DOUILLE, sinon CÂBLE.
 *
 * Résultat : le manchon (cône continu) est capturé ENTIER par le critère 1
 * ou 3 selon sa forme — jamais tranché en deux couleurs au milieu de sa
 * propre surface.
 */
function splitSocketCable(part, bulbC, cNear, A, socketEnd, rThresh) {
  // mm — mesuré : les faces de jonction (douille, manchon) vont jusqu'à
  // ~49 mm d'étendue axiale ; le fil (deux faces occt pour ses deux moitiés)
  // s'étire sur ~420 mm. 100 mm laisse une marge large des deux côtés.
  const SPAN_THRESH = 100;

  // 1) Un seul verdict SOCKET/CABLE par face B-Rep, sur son étendue entière.
  const byFace = new Map(); // faceId → liste des débuts de triangle (t)
  for (let t = 0; t < part.idx.length; t += 3) {
    const fid = part.faceId ? part.faceId[t / 3] : -1;
    if (!byFace.has(fid)) byFace.set(fid, []);
    byFace.get(fid).push(t);
  }
  const faceIsSocket = new Map();
  for (const [fid, triStarts] of byFace) {
    let minProj = Infinity, maxProj = -Infinity, maxRadial = 0;
    for (const t of triStarts) {
      for (const vi of [part.idx[t], part.idx[t + 1], part.idx[t + 2]]) {
        const x = part.pos[vi * 3], y = part.pos[vi * 3 + 1], z = part.pos[vi * 3 + 2];
        const dxb = x - bulbC[0], dyb = y - bulbC[1], dzb = z - bulbC[2];
        const proj = dxb * A[0] + dyb * A[1] + dzb * A[2];
        if (proj < minProj) minProj = proj;
        if (proj > maxProj) maxProj = proj;
        const dx = x - cNear[0], dy = y - cNear[1], dz = z - cNear[2];
        const pr = dx * A[0] + dy * A[1] + dz * A[2];
        const radial = Math.hypot(dx - pr * A[0], dy - pr * A[1], dz - pr * A[2]);
        if (radial > maxRadial) maxRadial = radial;
      }
    }
    const span = maxProj - minProj;
    faceIsSocket.set(fid, span <= SPAN_THRESH && minProj <= socketEnd && maxRadial > rThresh);
  }

  // 2) Répartition des triangles selon le verdict de leur face.
  const near = { P: [], N: [], I: [] }; // douille (métal)
  const far = { P: [], N: [], I: [] };  // fil (textile)
  const push = (dst, remap, oi) => {
    if (!remap.has(oi)) {
      remap.set(oi, dst.P.length / 3);
      dst.P.push(part.pos[oi * 3], part.pos[oi * 3 + 1], part.pos[oi * 3 + 2]);
      if (part.nrm)
        dst.N.push(part.nrm[oi * 3], part.nrm[oi * 3 + 1], part.nrm[oi * 3 + 2]);
    }
    dst.I.push(remap.get(oi));
  };
  const rN = new Map(), rF = new Map();
  for (let t = 0; t < part.idx.length; t += 3) {
    const fid = part.faceId ? part.faceId[t / 3] : -1;
    const isSocket = faceIsSocket.get(fid);
    const a = part.idx[t], b = part.idx[t + 1], c = part.idx[t + 2];
    push(isSocket ? near : far, isSocket ? rN : rF, a);
    push(isSocket ? near : far, isSocket ? rN : rF, b);
    push(isSocket ? near : far, isSocket ? rN : rF, c);
  }
  const mk = (o) => ({
    pos: new Float32Array(o.P),
    nrm: part.nrm ? new Float32Array(o.N) : null,
    idx: Uint32Array.from(o.I),
  });
  return { near: mk(near), far: mk(far) };
}

/**
 * Calcule le plan de jonction douille/fil : un plan perpendiculaire à l'axe
 * LOCAL du câble, placé juste après la face de sortie de la douille (métal).
 * Tout est déduit de la géométrie (aucune constante en dur) :
 *  - axe A = direction du fil fin juste après la jonction ;
 *  - le plan est posé à l'extension maximale de la douille (rayon large) le
 *    long de A, + 2 mm de marge, pour englober toute la douille métallique.
 */
function cableJointPlane(part, bulbC) {
  const P = part.pos, n = P.length / 3;
  const distBulb = (i) =>
    Math.hypot(P[i * 3] - bulbC[0], P[i * 3 + 1] - bulbC[1], P[i * 3 + 2] - bulbC[2]);
  const meanIn = ([lo, hi]) => {
    let sx = 0, sy = 0, sz = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const d = distBulb(i);
      if (d >= lo && d < hi) { sx += P[i * 3]; sy += P[i * 3 + 1]; sz += P[i * 3 + 2]; c++; }
    }
    return c ? [sx / c, sy / c, sz / c] : null;
  };
  // Axe local du fil, juste au-delà de la douille (le fil est droit sur ~70 mm).
  const cNear = meanIn([92, 120]);
  const cFar = meanIn([125, 165]);
  let A = [cFar[0] - cNear[0], cFar[1] - cNear[1], cFar[2] - cNear[2]];
  const al = Math.hypot(A[0], A[1], A[2]) || 1;
  A = [A[0] / al, A[1] / al, A[2] / al];
  // Rayon LOCAL de section par tranches de 5 mm le long de A. Le rayon est
  // mesuré par rapport au centroïde de CHAQUE tranche (et non à une ligne
  // ancrée au bulbe), donc immunisé contre la courbure du fil et l'ancrage :
  // douille ≈ 23 mm, fil fin ≈ 9 mm. On repère la dernière tranche « large »
  // (> 14 mm) → face de sortie de la douille.
  const proj = (i) =>
    (P[i * 3] - bulbC[0]) * A[0] + (P[i * 3 + 1] - bulbC[1]) * A[1] + (P[i * 3 + 2] - bulbC[2]) * A[2];
  const BIN = 5;
  const bins = new Map();
  for (let i = 0; i < n; i++) {
    const b = Math.floor(proj(i) / BIN);
    if (!bins.has(b)) bins.set(b, []);
    bins.get(b).push(i);
  }
  let maxProj = -1e9;
  for (const [b, verts] of bins) {
    if (verts.length < 4) continue;
    let cx = 0, cy = 0, cz = 0;
    for (const i of verts) { cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; }
    cx /= verts.length; cy /= verts.length; cz /= verts.length;
    let r = 0;
    for (const i of verts) {
      const dx = P[i * 3] - cx, dy = P[i * 3 + 1] - cy, dz = P[i * 3 + 2] - cz;
      const along = dx * A[0] + dy * A[1] + dz * A[2];
      const rad = Math.hypot(dx - along * A[0], dy - along * A[1], dz - along * A[2]);
      if (rad > r) r = rad;
    }
    if (r > 14) maxProj = Math.max(maxProj, (b + 1) * BIN); // bord lointain de la tranche
  }
  const t = maxProj + 2; // borne axiale juste après la face de sortie de la douille
  const P0 = [bulbC[0] + t * A[0], bulbC[1] + t * A[1], bulbC[2] + t * A[2]];
  return { P0, A, joint: t, cNear, socketEnd: t };
}

/**
 * Ferme les ouvertures d'une pièce SAUF la plus grande (l'ouverture principale).
 * 1) soude les sommets proches (referme les micro-coutures entre patchs) ;
 * 2) repère les boucles frontière ; 3) bouche toutes sauf la plus grande.
 */
function closeHoles(part, weldTol = 1.4) {
  const { pos, nrm, idx } = part;
  const q = (v) => Math.round(v / weldTol);
  const map = new Map();
  const P = [], N = [];
  const remap = new Int32Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) {
    const k = `${q(pos[i * 3])}_${q(pos[i * 3 + 1])}_${q(pos[i * 3 + 2])}`;
    if (!map.has(k)) {
      map.set(k, P.length / 3);
      P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      if (nrm) N.push(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
    }
    remap[i] = map.get(k);
  }
  const I = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = remap[idx[t]], b = remap[idx[t + 1]], c = remap[idx[t + 2]];
    if (a !== b && b !== c && a !== c) I.push(a, b, c);
  }
  // arêtes frontière (utilisées 1 seule fois), avec direction (winding).
  const ek = (u, v) => (u < v ? u * 1e7 + v : v * 1e7 + u);
  const ecount = new Map(), edir = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    for (let e = 0; e < 3; e++) {
      const u = tri[e], v = tri[(e + 1) % 3], k = ek(u, v);
      ecount.set(k, (ecount.get(k) || 0) + 1);
      if (!edir.has(k)) edir.set(k, [u, v]);
    }
  }
  const nextOf = new Map();
  for (const [k, c] of ecount) if (c === 1) { const [u, v] = edir.get(k); nextOf.set(u, v); }
  const visited = new Set(), loops = [];
  for (const [u] of nextOf) {
    if (visited.has(u)) continue;
    const loop = []; let cur = u;
    while (cur !== undefined && !visited.has(cur)) { visited.add(cur); loop.push(cur); cur = nextOf.get(cur); }
    if (loop.length >= 3) loops.push(loop);
  }
  const perim = (loop) => {
    let p = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length];
      p += Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
    }
    return p;
  };
  loops.sort((a, b) => perim(b) - perim(a));
  const maxP = loops.length ? perim(loops[0]) : 0;
  // Garde l'ouverture principale (la plus grande) OUVERTE ; ne bouche que les
  // ouvertures secondaires SIGNIFICATIVES (le dessous), pas les micro-boucles
  // de couture — sinon on crée des triangles parasites (z-fighting, facettes).
  const toCap = loops.slice(1).filter((l) => perim(l) > maxP * 0.28);
  console.log(
    `  closeHoles: ${loops.length} boucle(s) ; ${toCap.length} bouchée(s) (ouverture principale conservée)`
  );
  // On CONSERVE les normales analytiques d'occt (lisses et précises) ; on ne
  // calcule une normale que pour le sommet central de chaque bouchon.
  for (const loop of toCap) {
    const c = [0, 0, 0], nn = [0, 0, 0];
    for (const vi of loop) {
      c[0] += P[vi * 3]; c[1] += P[vi * 3 + 1]; c[2] += P[vi * 3 + 2];
      if (nrm) { nn[0] += N[vi * 3]; nn[1] += N[vi * 3 + 1]; nn[2] += N[vi * 3 + 2]; }
    }
    const ci = P.length / 3;
    P.push(c[0] / loop.length, c[1] / loop.length, c[2] / loop.length);
    if (nrm) {
      const len = Math.hypot(nn[0], nn[1], nn[2]) || 1;
      N.push(nn[0] / len, nn[1] / len, nn[2] / len);
    }
    for (let i = 0; i < loop.length; i++) I.push(loop[i], loop[(i + 1) % loop.length], ci);
  }
  return { pos: new Float32Array(P), nrm: nrm ? new Float32Array(N) : null, idx: Uint32Array.from(I) };
}

/**
 * Aucune arête dièdre du modèle ne tombe entre 30° et 60° (distribution
 * bimodale, mesuré sur les 6 pièces) : 40° sépare donc sans ambiguïté les
 * coutures de patchs (lisses) des arêtes de conception (vives, à préserver).
 */
const CREASE_ANGLE_DEG = 40;

/**
 * Soude les sommets EXACTEMENT coïncidents (jonctions de patchs OCCT) et
 * recalcule leurs normales à partir de la topologie fusionnée, plutôt que de
 * faire confiance aux normales analytiques d'occt à ces coutures.
 *
 * Pourquoi pas smoothSeamNormals (ancienne tentative, jamais branchée) : elle
 * moyennait les normales EXISTANTES sans souder la topologie. Or, vérifié sur
 * lampe-optimisee.glb : à position strictement identique, les normales
 * analytiques d'occt divergent en médiane de 90 à 110° selon la pièce (jusqu'à
 * 175° sur Cable) — pas un bruit de tessellation, une vraie incohérence
 * d'orientation entre patchs adjacents (l'orientation FORWARD/REVERSED du
 * patch dans le B-Rep IGES, honorée indépendamment par occt à la
 * tessellation). MOYENNER des normales qui pointent à moitié en sens opposé
 * produit un vecteur quasi nul ou faux → c'est exactement la source des
 * « dents de scie, plis » qui avaient fait abandonner cette piste.
 *
 * Le winding (ordre des sommets), lui, EST fiable : vérifié cohérent avec la
 * normale analytique sur les 652 triangles de l'abat-jour (produit scalaire
 * entre 0,97 et 1 partout, aucune inversion). En soudant la topologie puis en
 * dérivant les normales des normales de FACE (produit vectoriel des arêtes,
 * pondéré par l'aire — magnitude du produit vectoriel non normalisé), le
 * résultat est correct par construction : plus aucune moyenne de vecteurs
 * contradictoires, une normale de sommet unique et lisse à chaque couture.
 *
 * ⚠️ SEUIL D'ANGLE DE PLI (regression corrigée). Une première version soudait
 * ET lissait SANS seuil : les arêtes de CONCEPTION réellement vives (tôle
 * perforée, angles francs) se retrouvaient alors ombrées comme des surfaces
 * continues — des facettes triangulaires visibles là où l'objet a un vrai
 * pli. Sous CREASE_ANGLE_DEG, la normale est partagée (moyenne pondérée par
 * aire, comme avant) ; au-dessus, le sommet est DUPLIQUÉ et chaque face garde
 * sa propre normale — la méthode standard du « crease angle ».
 */
function weldAndSmoothNormals(part) {
  const { pos, idx } = part;
  const n = pos.length / 3;

  // 1) Soudure des positions EXACTEMENT coïncidentes (inchangé).
  const key = (i) => `${pos[i * 3]}_${pos[i * 3 + 1]}_${pos[i * 3 + 2]}`;
  const map = new Map();
  const remap = new Int32Array(n);
  const P = [];
  for (let i = 0; i < n; i++) {
    const k = key(i);
    if (!map.has(k)) {
      map.set(k, P.length / 3);
      P.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    }
    remap[i] = map.get(k);
  }
  const I = new Uint32Array(idx.length);
  for (let t = 0; t < idx.length; t++) I[t] = remap[idx[t]];
  const triCount = I.length / 3;
  const weldedVerts = P.length / 3;

  // 2) Normale de face par triangle — non normalisée (pondération par aire)
  // ET normalisée (test d'angle dièdre entre faces adjacentes).
  const faceN = new Float64Array(triCount * 3);
  const faceNu = new Float64Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const cx = P[c * 3], cy = P[c * 3 + 1], cz = P[c * 3 + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const fx = e1y * e2z - e1z * e2y, fy = e1z * e2x - e1x * e2z, fz = e1x * e2y - e1y * e2x;
    faceN[t * 3] = fx; faceN[t * 3 + 1] = fy; faceN[t * 3 + 2] = fz;
    const l = Math.hypot(fx, fy, fz) || 1;
    faceNu[t * 3] = fx / l; faceNu[t * 3 + 1] = fy / l; faceNu[t * 3 + 2] = fz / l;
  }

  // 3) Arêtes → triangles qui la portent (pour repérer les paires adjacentes).
  const edgeTris = new Map();
  const ek = (u, v) => (u < v ? `${u}_${v}` : `${v}_${u}`);
  for (let t = 0; t < triCount; t++) {
    const a = I[t * 3], b = I[t * 3 + 1], c = I[t * 3 + 2];
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const k = ek(u, v);
      if (!edgeTris.has(k)) edgeTris.set(k, []);
      edgeTris.get(k).push(t);
    }
  }

  // 4) Union-find sur les COINS de triangle (t*3+slot, un par occurrence de
  // sommet). Deux coins d'un même sommet soudé sont unis — donc partageront
  // une normale — seulement si leurs triangles sont adjacents par une arête
  // PASSANT PAR CE SOMMET dont l'angle dièdre reste sous le seuil.
  const cornerCount = triCount * 3;
  const parent = new Int32Array(cornerCount);
  for (let i = 0; i < cornerCount; i++) parent[i] = i;
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const union = (x, y) => {
    const rx = find(x), ry = find(y);
    if (rx !== ry) parent[rx] = ry;
  };
  const cornerAt = (t, vert) => {
    for (let s = 0; s < 3; s++) if (I[t * 3 + s] === vert) return t * 3 + s;
    return -1;
  };
  const cosThreshold = Math.cos((CREASE_ANGLE_DEG * Math.PI) / 180);
  let sharpEdges = 0;
  for (const [k, tris] of edgeTris) {
    if (tris.length < 2) continue; // arête de bord : rien à souder ni à trancher
    const [u, v] = k.split("_").map(Number);
    for (let i = 0; i < tris.length; i++) {
      for (let j = i + 1; j < tris.length; j++) {
        const t1 = tris[i], t2 = tris[j];
        const dot =
          faceNu[t1 * 3] * faceNu[t2 * 3] +
          faceNu[t1 * 3 + 1] * faceNu[t2 * 3 + 1] +
          faceNu[t1 * 3 + 2] * faceNu[t2 * 3 + 2];
        if (dot >= cosThreshold) {
          union(cornerAt(t1, u), cornerAt(t2, u));
          union(cornerAt(t1, v), cornerAt(t2, v));
        } else {
          sharpEdges++;
        }
      }
    }
  }

  // 5) Un sommet de sortie par groupe (racine union-find), normale = moyenne
  // pondérée par aire des faces du groupe uniquement.
  const groupOf = new Map();
  const outP = [];
  const outN = [];
  const outIdx = new Uint32Array(cornerCount);
  for (let t = 0; t < triCount; t++) {
    for (let s = 0; s < 3; s++) {
      const corner = t * 3 + s;
      const vert = I[corner];
      const root = find(corner);
      let outVi = groupOf.get(root);
      if (outVi === undefined) {
        outVi = outP.length / 3;
        outP.push(P[vert * 3], P[vert * 3 + 1], P[vert * 3 + 2]);
        outN.push(0, 0, 0);
        groupOf.set(root, outVi);
      }
      outIdx[corner] = outVi;
    }
  }
  for (let t = 0; t < triCount; t++) {
    for (let s = 0; s < 3; s++) {
      const outVi = outIdx[t * 3 + s];
      outN[outVi * 3] += faceN[t * 3];
      outN[outVi * 3 + 1] += faceN[t * 3 + 1];
      outN[outVi * 3 + 2] += faceN[t * 3 + 2];
    }
  }
  for (let i = 0; i < outN.length; i += 3) {
    const l = Math.hypot(outN[i], outN[i + 1], outN[i + 2]) || 1;
    outN[i] /= l; outN[i + 1] /= l; outN[i + 2] /= l;
  }

  const finalVerts = outP.length / 3;
  console.log(
    `  weldAndSmoothNormals: ${n} → ${weldedVerts} sommets soudés (${n - weldedVerts} fusionnés), ` +
      `${sharpEdges} arête(s) vive(s) préservée(s) (seuil ${CREASE_ANGLE_DEG}°) → ` +
      `${finalVerts} sommets finaux (${finalVerts - weldedVerts} dupliqué(s) pour les plis)`
  );
  return { pos: new Float32Array(outP), nrm: new Float32Array(outN), idx: outIdx };
}

const named = {};
{
  const [far, near] = byNode.grand.sort((a, b) => b.dist - a.dist);
  named.Cable = far; // composante la plus éloignée = câble + douille
  named.Shade = near;
}
{
  const [low, high] = byNode.petit.sort((a, b) => a.center[1] - b.center[1]);
  named.Base = low; // plus bas sur l'axe d'empilement = pied
  named.Connector = high; // pièce métallique intermédiaire
}
named.Bulb = byNode.ampoule2[0];

// La pièce « Cable » contient la douille large (près de l'ampoule) + le fil fin.
// On sépare par un critère AXIAL + RADIAL : la douille = zone axiale de la
// douille ET coque large (rayon > 9 mm) ; le fil fin (rayon ~4-5 mm) reste
// « câble » PARTOUT, y compris à sa sortie de la douille. Ainsi le métal ne
// déborde jamais sur le fil (une coupe purement axiale ne pouvait pas séparer
// le fil fin de l'anneau métallique qui l'entoure à la même position axiale).
{
  const { A, cNear, socketEnd } = cableJointPlane(named.Cable, named.Bulb.center);
  const R_THRESH = 9; // entre le fil (~4-5 mm) et la coque de douille (14-26 mm)

  const { near: socket, far: cable } = splitSocketCable(
    named.Cable, named.Bulb.center, cNear, A, socketEnd, R_THRESH
  );
  named.Socket = socket; // douille / embout large (métal)
  named.Cable = cable; // fil textile
  console.log(
    `  jonction câble : socketEnd @ ${socketEnd.toFixed(1)} mm, rThresh ${R_THRESH} mm, socket tris=${socket.idx.length / 3}, câble tris=${cable.idx.length / 3}`
  );
}

console.log("Classification :");
for (const [k, v] of Object.entries(named))
  console.log(`  ${k.padEnd(9)} tris=${v.idx.length / 3}`);

// Soudure + normales lisses sur CHAQUE pièce (voir weldAndSmoothNormals) :
// la couture de patchs OCCT n'est pas propre à l'abat-jour.
console.log("Soudure des coutures de patchs :");
for (const name of Object.keys(named)) {
  console.log(`  ${name} :`);
  named[name] = weldAndSmoothNormals(named[name]);
}

// mm→m + centrage sur la bbox globale (orientation réglée côté three.js).
const SCALE = 0.001;
const gb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
for (const v of Object.values(named))
  for (let i = 0; i < v.pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      gb[k] = Math.min(gb[k], v.pos[i + k]);
      gb[3 + k] = Math.max(gb[3 + k], v.pos[i + k]);
    }
const c = [(gb[0] + gb[3]) / 2, (gb[1] + gb[4]) / 2, (gb[2] + gb[5]) / 2];
for (const v of Object.values(named))
  for (let i = 0; i < v.pos.length; i += 3) {
    v.pos[i] = (v.pos[i] - c[0]) * SCALE;
    v.pos[i + 1] = (v.pos[i + 1] - c[1]) * SCALE;
    v.pos[i + 2] = (v.pos[i + 2] - c[2]) * SCALE;
  }

// Variantes PERÇÉES de la pièce d'assemblage (Route B — géométrie réelle,
// voir scripts/perforation-mesh.mjs pour le diagnostic et la méthode).
// Générées ici, sur la pièce déjà à l'échelle finale : le pas (250 mailles
// par unité objet) est défini dans CES unités, pas en millimètres CAO.
// côté du trou = 0,75 × pas (mesuré sur la photo du prototype, cf. retour
// utilisateur) ; rayon du rond = même AIRE OUVERTE que le carré : pour un
// carré de côté s, aire = s² ; pour un disque de même aire, r = s/√π.
// s = 0.75 × pitch ⇒ r = 0.75/√π × pitch ≈ 0,4231 × pitch.
const SQUARE_SIDE_OVER_PITCH = 0.75;
const PERFORATION_PARAMS = {
  pitch: 1 / 250,
  squareHalf: SQUARE_SIDE_OVER_PITCH / 2,
  squareCorner: 0.22,
  roundRadius: (SQUARE_SIDE_OVER_PITCH / 2) / Math.sqrt(Math.PI) * 2,
};
console.log("Perforation de la pièce d'assemblage (géométrie réelle) :");
const perforated = {};
for (const shape of ["round", "square"]) {
  const punched = buildPerforatedPart(named.Connector, shape, PERFORATION_PARAMS);
  perforated[shape] = weldAndSmoothNormals(punched);
}

const doc = new Document();
doc.getRoot().getAsset().generator = "noir-mineral-cad-pipeline";
const buffer = doc.createBuffer();
const scene = doc.createScene("LampeNoirMineral");
const colors = {
  Shade: [0.12, 0.12, 0.13, 1],
  Connector: [0.7, 0.7, 0.72, 1],
  Base: [0.55, 0.54, 0.5, 1],
  Socket: [0.72, 0.72, 0.74, 1],
  Cable: [0.16, 0.25, 0.85, 1],
  Bulb: [1, 0.96, 0.9, 1],
};
for (const name of ["Shade", "Connector", "Base", "Socket", "Cable", "Bulb"]) {
  const v = named[name];
  if (!v) continue;
  const prim = doc
    .createPrimitive()
    .setAttribute(
      "POSITION",
      doc.createAccessor(`${name}_P`).setType("VEC3").setArray(v.pos).setBuffer(buffer)
    );
  if (v.nrm)
    prim.setAttribute(
      "NORMAL",
      doc.createAccessor(`${name}_N`).setType("VEC3").setArray(v.nrm).setBuffer(buffer)
    );
  prim.setIndices(
    doc.createAccessor(`${name}_I`).setType("SCALAR").setArray(v.idx).setBuffer(buffer)
  );
  const mat = doc
    .createMaterial(`${name}_MAT`)
    .setBaseColorFactor(colors[name])
    .setRoughnessFactor(name === "Bulb" ? 0.25 : 0.7)
    .setMetallicFactor(name === "Connector" ? 0.8 : 0);
  if (name === "Bulb") mat.setEmissiveFactor([0.9, 0.82, 0.62]);
  prim.setMaterial(mat);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
}

// Nœuds porteurs des géométries perçées — JAMAIS rendus directement (voir
// Lamp3D.tsx / ExplodedLamp3D.tsx, qui les repèrent par nom, en extraient la
// géométrie pour l'assigner au mesh « Connector » visible, puis les masquent
// et les détachent). Même matériau que Connector : sans effet puisqu'ils ne
// sont jamais affichés tels quels, mais garde le GLB cohérent si inspecté.
for (const shape of ["round", "square"]) {
  const v = perforated[shape];
  const name = `Connector_${shape}`;
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", doc.createAccessor(`${name}_P`).setType("VEC3").setArray(v.pos).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor(`${name}_N`).setType("VEC3").setArray(v.nrm).setBuffer(buffer))
    .setIndices(doc.createAccessor(`${name}_I`).setType("SCALAR").setArray(v.idx).setBuffer(buffer));
  const mat = doc
    .createMaterial(`${name}_MAT`)
    .setBaseColorFactor(colors.Connector)
    .setRoughnessFactor(0.7)
    .setMetallicFactor(0.8);
  prim.setMaterial(mat);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
}

await doc.transform(weld(), dedup(), prune());
const glb = await new NodeIO().writeBinary(doc);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, glb);
console.log(`\nGLB écrit (${(glb.length / 1024).toFixed(0)} Ko) → ${OUT}`);

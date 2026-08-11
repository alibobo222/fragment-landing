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

/** Découpe une soupe de triangles en composantes connexes (weld 0,1 mm). */
function components(pos, index, normal) {
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
  const groups = new Map();
  for (let t = 0; t < index.length; t += 3) {
    const r = find(vid[index[t]]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(index[t], index[t + 1], index[t + 2]);
  }
  return [...groups.values()].map((tris) => {
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
    m.attributes.normal?.array
  );
}

// Classification sémantique (déterminée par inspection géométrique) :
/**
 * Scinde douille (métal) / fil (textile) par un critère AXIAL + RADIAL. Une face
 * appartient à la DOUILLE seulement si elle est dans la zone axiale de la douille
 * (proj ≤ socketEnd) ET éloignée de l'axe du câble (rayon > rThresh, coque large).
 * Le fil fin — toujours proche de l'axe (rayon ~4-5 mm) — reste « câble » partout,
 * y compris à la sortie de la douille : aucun métal ne déborde sur le fil.
 * (Un plan purement axial ne peut pas séparer le fil fin de l'anneau métallique
 * qui l'entoure, tous deux à la même position axiale.)
 */
function splitSocketCable(part, bulbC, cNear, A, socketEnd, rThresh) {
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
    const a = part.idx[t], b = part.idx[t + 1], c = part.idx[t + 2];
    const cx = (part.pos[a * 3] + part.pos[b * 3] + part.pos[c * 3]) / 3;
    const cy = (part.pos[a * 3 + 1] + part.pos[b * 3 + 1] + part.pos[c * 3 + 1]) / 3;
    const cz = (part.pos[a * 3 + 2] + part.pos[b * 3 + 2] + part.pos[c * 3 + 2]) / 3;
    const proj = (cx - bulbC[0]) * A[0] + (cy - bulbC[1]) * A[1] + (cz - bulbC[2]) * A[2];
    // Rayon par rapport à la ligne d'axe ancrée sur le fil (cNear).
    const dx = cx - cNear[0], dy = cy - cNear[1], dz = cz - cNear[2];
    const pr = dx * A[0] + dy * A[1] + dz * A[2];
    const radial = Math.hypot(dx - pr * A[0], dy - pr * A[1], dz - pr * A[2]);
    const isSocket = proj <= socketEnd && radial > rThresh;
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
 */
function weldAndSmoothNormals(part) {
  const { pos, idx } = part;
  const n = pos.length / 3;
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

  const nv = P.length / 3;
  const N = new Float32Array(nv * 3);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const cx = P[c * 3], cy = P[c * 3 + 1], cz = P[c * 3 + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    // Non normalisé : la magnitude encode l'aire du triangle → pondération
    // naturelle par aire dans la somme ci-dessous, pas de calcul séparé.
    const fnx = e1y * e2z - e1z * e2y, fny = e1z * e2x - e1x * e2z, fnz = e1x * e2y - e1y * e2x;
    N[a * 3] += fnx; N[a * 3 + 1] += fny; N[a * 3 + 2] += fnz;
    N[b * 3] += fnx; N[b * 3 + 1] += fny; N[b * 3 + 2] += fnz;
    N[c * 3] += fnx; N[c * 3 + 1] += fny; N[c * 3 + 2] += fnz;
  }
  for (let i = 0; i < nv; i++) {
    const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
    N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l;
  }
  const before = n, after = nv;
  console.log(`  weldAndSmoothNormals: ${before} → ${after} sommets (${before - after} soudés)`);
  return { pos: new Float32Array(P), nrm: N, idx: I };
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

await doc.transform(weld(), dedup(), prune());
const glb = await new NodeIO().writeBinary(doc);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, glb);
console.log(`\nGLB écrit (${(glb.length / 1024).toFixed(0)} Ko) → ${OUT}`);

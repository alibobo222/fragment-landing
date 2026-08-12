/**
 * FILETAGE INTÉRIEUR DE LA DOUILLE — vraie géométrie 3D.
 *
 * Le modèle issu de la CAO ne contient AUCUN filetage : la douille est un simple
 * tube lisse. Il n'y avait donc rien à révéler par shader. Le filet est ici
 * réellement CRÉÉ : un boudin balayé le long d'une hélice, ajouté comme sous-mesh
 * ENFANT de la douille. Le parentage fait le reste — le filet suit la pièce
 * pendant l'éclatement sans code de synchronisation, la géométrie de la douille
 * n'est pas touchée d'un sommet, et rien n'est ajouté à l'extérieur.
 *
 * ⚠️ TOUT LE PROBLÈME EST DE TROUVER L'AXE ET SON CENTRE. Trois méthodes ont
 * échoué avant celle-ci, et il vaut la peine de dire pourquoi :
 *
 *   - La boîte englobante donne 0,0657 × 0,0657 × 0,047, ce qui suggère un axe
 *     en Z. C'est faux : la douille est INCLINÉE dans le modèle, et une boîte
 *     alignée sur les axes ne dit rien de l'orientation d'une pièce inclinée.
 *   - La covariance des normales, estimateur classique d'axe de cylindre, se
 *     trompe ici SI on l'applique à tout le maillage : les deux faces annulaires
 *     des bouts portent l'essentiel des sommets, si bien que la direction
 *     dominante est l'axe et non le plan perpendiculaire — l'estimateur renvoie
 *     exactement la mauvaise direction. La méthode elle-même reste juste ; il
 *     suffit d'écarter ces deux faces avant de l'appliquer (voir plus bas).
 *   - Le centroïde des sommets n'est pas sur l'axe : les deux faces ne sont pas
 *     également maillées, et il dérive hors du tube.
 *
 * L'axe est donc AJUSTÉ EN DEUX TEMPS. D'abord un balayage grossier qui cherche
 * la direction pour laquelle la distance à l'axe est la plus constante — la
 * définition même d'un cylindre. Mais ce critère est une dispersion RELATIVE
 * (écart-type ÷ rayon moyen), et sur une pièce aussi trapue que cette douille
 * (0,066 × 0,066 × 0,046, presque un cube), il manque de contraste : une
 * direction fausse peut afficher un rayon moyen plus grand que le vrai axe et
 * gagner quand même. Le résultat grossier sert donc seulement de POINT DE
 * DÉPART à un second ajustement, sur la paroi latérale seule (sommets dont la
 * normale n'est pas quasi axiale) : ses normales sont perpendiculaires à l'axe
 * par construction, qui est donc le vecteur propre de plus petite valeur
 * propre de leur covariance — exact, et sans le biais du balayage grossier.
 */
import * as THREE from "three";

/** Pas du filet, en fraction du diamètre d'alésage. Un culot à vis normalisé
 *  tourne autour de 0,13 ; on élargit un peu pour la lisibilité à l'écran. */
const PITCH_RATIO = 0.17;

/** Rayon du boudin, en fraction du rayon d'alésage : l'épaisseur du filet. */
const WIRE_RATIO = 0.12;

/** Fraction de la hauteur réellement filetée — sur une douille réelle, le filet
 *  ne court pas jusqu'aux bords. */
const HEIGHT_RATIO = 0.8;

/** Quantile retenu pour lire l'alésage : quelques sommets siègent très près de
 *  l'axe et tirent les déciles bas vers le vide ; la médiane basse capte la
 *  paroi intérieure sans se faire piéger. */
const BORE_QUANTILE = 0.35;

const SEGMENTS_PER_TURN = 32;
const RADIAL_SEGMENTS = 8;

/** Au-delà de ce cosinus avec l'axe candidat, une normale appartient à une
 *  face de bout (quasi axiale), pas à la paroi cylindrique — voir le second
 *  ajustement dans fitAxis(). */
const END_FACE_COS = 0.7;

/** Passes de filtrage/ajustement sur la paroi latérale : le filtre se
 *  resserre à chaque passe, à mesure que l'axe se précise. */
const WALL_FIT_PASSES = 3;

/** Sommets de paroi minimum pour qu'un ajustement sur les normales ait un
 *  sens statistique ; en dessous, la passe est ignorée. */
const MIN_WALL_SAMPLES = 8;

/** Fraction de la hauteur exclue à CHAQUE bout avant le second ajustement :
 *  les congés/chanfreins de raccord n'y sont pas à rayon constant, comme les
 *  faces de bout elles-mêmes (voir END_FACE_COS). Mesuré sur la douille
 *  réelle : sans cette marge la dispersion de l'alésage plafonne à 0,39 (les
 *  raccords arrondis dominent le sous-échantillon) ; à 0,3 elle tombe à 0,15
 *  sans réduire l'échantillon au point de le rendre statistiquement fragile. */
const END_MARGIN_RATIO = 0.3;

/** Dispersion radiale relative (alésage seul, cœur de la paroi) au-delà de
 *  laquelle on renonce à ajouter le filet plutôt que d'en dessiner un de
 *  travers — un filet absent se remarque à peine, un filet faux ruine la
 *  pièce. Sur la douille réelle, l'ajustement le plus serré atteint 0,15 :
 *  0,2 laisse une marge raisonnable sans revalider un échec (0,39 sans
 *  filtrage par hauteur). */
const SPREAD_GUARD = 0.2;

/** Hélice à rayon constant, dans un repère canonique (axe = Z). */
class HelixCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private radius: number,
    private pitch: number,
    private turns: number,
    private z0: number
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const a = Math.PI * 2 * this.turns * t;
    return target.set(
      this.radius * Math.cos(a),
      this.radius * Math.sin(a),
      this.z0 + this.pitch * this.turns * t
    );
  }
}

interface Fit {
  axis: THREE.Vector3;
  center: THREE.Vector3;
  /** Dispersion radiale relative : 0 = cylindre parfait. Sert de score. */
  spread: number;
}

interface AxisFit extends Fit {
  /** Axe avant le second ajustement (paroi latérale) — diagnostic console
   *  uniquement, voir addSocketThread(). */
  coarseAxis: THREE.Vector3;
}

/** Plus petite valeur propre (et son vecteur propre) d'une matrice 3×3
 *  symétrique [[a,b,c],[b,d,e],[c,e,f]], par la solution trigonométrique
 *  exacte de Smith (1961) — une formule close est amplement suffisante pour
 *  du 3×3 et évite d'embarquer une dépendance d'algèbre linéaire pour ça. */
function smallestEigenvector(
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number
): THREE.Vector3 {
  const p1 = b * b + c * c + e * e;
  if (p1 < 1e-20) {
    // Déjà diagonale : la plus petite valeur propre est le plus petit terme
    // diagonal, l'axe correspondant est un vecteur de base.
    if (a <= d && a <= f) return new THREE.Vector3(1, 0, 0);
    if (d <= a && d <= f) return new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3(0, 0, 1);
  }
  const q = (a + d + f) / 3;
  const p2 = (a - q) ** 2 + (d - q) ** 2 + (f - q) ** 2 + 2 * p1;
  const p = Math.sqrt(p2 / 6);
  const inv = 1 / p;
  const B = [
    (a - q) * inv, b * inv, c * inv,
    b * inv, (d - q) * inv, e * inv,
    c * inv, e * inv, (f - q) * inv,
  ];
  const detB =
    B[0] * (B[4] * B[8] - B[5] * B[7]) -
    B[1] * (B[3] * B[8] - B[5] * B[6]) +
    B[2] * (B[3] * B[7] - B[4] * B[6]);
  const r = THREE.MathUtils.clamp(detB / 2, -1, 1);
  const phi = Math.acos(r) / 3;
  const eig1 = q + 2 * p * Math.cos(phi);
  const eig3 = q + 2 * p * Math.cos(phi + (2 * Math.PI) / 3);
  const eig2 = 3 * q - eig1 - eig3;
  const lambda = Math.min(eig1, eig2, eig3);

  // Vecteur propre : noyau de (M − λI), par produit vectoriel de deux lignes
  // indépendantes (deux essais au cas où le premier couple serait colinéaire).
  const row0 = new THREE.Vector3(a - lambda, b, c);
  const row1 = new THREE.Vector3(b, d - lambda, e);
  const row2 = new THREE.Vector3(c, e, f - lambda);
  let axis = new THREE.Vector3().crossVectors(row0, row1);
  if (axis.lengthSq() < 1e-12) axis = new THREE.Vector3().crossVectors(row0, row2);
  if (axis.lengthSq() < 1e-12) axis = new THREE.Vector3().crossVectors(row1, row2);
  return axis.lengthSq() > 1e-20 ? axis.normalize() : new THREE.Vector3(0, 0, 1);
}

/** Évalue une direction : centre par moindres carrés, puis dispersion radiale. */
function scoreAxis(points: Float32Array, n: number, axis: THREE.Vector3): Fit {
  const v = new THREE.Vector3();
  const center = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
    center.add(v.addScaledVector(axis, -v.dot(axis)));
  }
  center.divideScalar(n);

  let mean = 0;
  let hSum = 0;
  const radii = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    v.set(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]).sub(center);
    const h = v.dot(axis);
    hSum += h;
    radii[i] = v.addScaledVector(axis, -h).length();
    mean += radii[i];
  }
  mean /= n;
  let varSum = 0;
  for (let i = 0; i < n; i++) varSum += (radii[i] - mean) ** 2;
  center.addScaledVector(axis, hSum / n);
  return {
    axis: axis.clone(),
    center,
    spread: mean > 1e-9 ? Math.sqrt(varSum / n) / mean : Infinity,
  };
}

/**
 * Recherche de l'axe : balayage grossier de la sphère (point de départ), puis
 * second ajustement sur les normales de la paroi latérale seule — voir le
 * commentaire de fichier. `normals` est optionnel (repli sur le grossier
 * seul) : la géométrie CAO en porte toujours, mais l'appelant ne le garantit
 * pas au niveau des types.
 */
function fitAxis(
  points: Float32Array,
  normals: Float32Array | null,
  n: number
): AxisFit {
  const dir = new THREE.Vector3();
  let best: Fit = scoreAxis(points, n, new THREE.Vector3(0, 0, 1));
  const evaluate = (theta: number, phi: number) => {
    dir.set(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta)
    );
    const fit = scoreAxis(points, n, dir);
    if (fit.spread < best.spread) best = fit;
  };

  const COARSE = 24;
  for (let i = 0; i <= COARSE; i++)
    for (let j = 0; j < 2 * COARSE; j++)
      evaluate((Math.PI * i) / COARSE, (Math.PI * j) / COARSE);

  // Deux raffinements locaux autour du meilleur candidat.
  for (let pass = 0; pass < 2; pass++) {
    const b = best;
    const theta0 = Math.acos(THREE.MathUtils.clamp(b.axis.z, -1, 1));
    const phi0 = Math.atan2(b.axis.y, b.axis.x);
    const win = (Math.PI / COARSE) * Math.pow(0.25, pass);
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++)
        evaluate(theta0 + (win * i) / 6, phi0 + (win * j) / 6);
  }

  const coarseAxis = best.axis.clone();
  if (!normals) return { ...best, coarseAxis };

  // Bande de hauteur « cœur », loin des deux bouts (voir END_MARGIN_RATIO) :
  // un congé ou un chanfrein de raccord y a une normale ni axiale ni radiale,
  // donc ni exclu par END_FACE_COS ni à rayon constant — il fausserait la
  // covariance et la dispersion autant qu'une face de bout franche. La bande
  // est fixée une fois, sur l'axe grossier : une différence de quelques degrés
  // ne change pas assez l'ordre en hauteur pour justifier de la recalculer.
  let hMin = Infinity, hMax = -Infinity;
  const hv = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    hv.set(points[i * 3] - best.center.x, points[i * 3 + 1] - best.center.y, points[i * 3 + 2] - best.center.z);
    const h = hv.dot(best.axis);
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
  }
  const hLo = hMin + (hMax - hMin) * END_MARGIN_RATIO;
  const hHi = hMax - (hMax - hMin) * END_MARGIN_RATIO;
  const inCoreBand = (i: number): boolean => {
    hv.set(points[i * 3] - best.center.x, points[i * 3 + 1] - best.center.y, points[i * 3 + 2] - best.center.z);
    const h = hv.dot(best.axis);
    return h >= hLo && h <= hHi;
  };

  // Second ajustement : filtre les faces de bout (normale quasi axiale) et la
  // bande de hauteur hors cœur, puis ajuste l'axe aux moindres carrés sur les
  // normales de la paroi restante. Répété : le filtre se resserre à mesure
  // que l'axe se précise.
  let axis = best.axis.clone();
  for (let pass = 0; pass < WALL_FIT_PASSES; pass++) {
    let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, count = 0;
    for (let i = 0; i < n; i++) {
      if (!inCoreBand(i)) continue;
      const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
      if (Math.abs(nx * axis.x + ny * axis.y + nz * axis.z) > END_FACE_COS) continue;
      a += nx * nx; b += nx * ny; c += nx * nz;
      d += ny * ny; e += ny * nz; f += nz * nz;
      count++;
    }
    if (count < MIN_WALL_SAMPLES) break; // paroi non identifiable à ce stade : on garde le dernier axe
    const refined = smallestEigenvector(a, b, c, d, e, f);
    axis = refined.dot(axis) < 0 ? refined.negate() : refined; // continuité de signe entre passes
  }

  // Centre provisoire sur TOUTE la paroi latérale du cœur (alésage + face
  // extérieure mêlés) : sans biais pour le centrage seul — une projection
  // perpendiculaire moyennée sur un tour complet ne dépend pas du rayon.
  const wallPts = new Float32Array(n * 3);
  let wallCount = 0;
  for (let i = 0; i < n; i++) {
    if (!inCoreBand(i)) continue;
    const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
    if (Math.abs(nx * axis.x + ny * axis.y + nz * axis.z) > END_FACE_COS) continue;
    wallPts[wallCount * 3] = points[i * 3];
    wallPts[wallCount * 3 + 1] = points[i * 3 + 1];
    wallPts[wallCount * 3 + 2] = points[i * 3 + 2];
    wallCount++;
  }
  if (wallCount < MIN_WALL_SAMPLES) return { ...best, coarseAxis };
  const { center } = scoreAxis(wallPts, wallCount, axis);

  // Dispersion FINALE mesurée sur le SEUL alésage du cœur (normale radiale
  // pointant vers l'axe, donc côté matière face au vide intérieur) : le
  // mélanger à la face extérieure — un rayon différent — rendrait la
  // dispersion relative ininterprétable même avec un axe parfait. C'est
  // l'alésage que le filet doit suivre, c'est donc lui, et lui seul, qu'on
  // vérifie — hors bande de transition des deux bouts.
  const radial = new THREE.Vector3();
  const innerPts = new Float32Array(wallCount * 3);
  let innerCount = 0;
  for (let i = 0; i < n; i++) {
    if (!inCoreBand(i)) continue;
    const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
    if (Math.abs(nx * axis.x + ny * axis.y + nz * axis.z) > END_FACE_COS) continue;
    radial.set(points[i * 3] - center.x, points[i * 3 + 1] - center.y, points[i * 3 + 2] - center.z);
    radial.addScaledVector(axis, -radial.dot(axis));
    if (nx * radial.x + ny * radial.y + nz * radial.z >= 0) continue; // face extérieure
    innerPts[innerCount * 3] = points[i * 3];
    innerPts[innerCount * 3 + 1] = points[i * 3 + 1];
    innerPts[innerCount * 3 + 2] = points[i * 3 + 2];
    innerCount++;
  }
  if (innerCount < MIN_WALL_SAMPLES) return { ...best, coarseAxis };

  return { ...scoreAxis(innerPts, innerCount, axis), coarseAxis };
}

export function addSocketThread(
  socket: THREE.Mesh,
  material: THREE.Material
): THREE.Mesh | null {
  const attr = socket.geometry.getAttribute("position") as
    | THREE.BufferAttribute
    | undefined;
  if (!attr || attr.count === 0) return null;

  const n = attr.count;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pts[i * 3] = attr.getX(i);
    pts[i * 3 + 1] = attr.getY(i);
    pts[i * 3 + 2] = attr.getZ(i);
  }

  const nAttr = socket.geometry.getAttribute("normal") as
    | THREE.BufferAttribute
    | undefined;
  let nrms: Float32Array | null = null;
  if (nAttr && nAttr.count === n) {
    nrms = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      nrms[i * 3] = nAttr.getX(i);
      nrms[i * 3 + 1] = nAttr.getY(i);
      nrms[i * 3 + 2] = nAttr.getZ(i);
    }
  }

  const { axis, center, spread, coarseAxis } = fitAxis(pts, nrms, n);

  // Alésage et hauteur, mesurés le long de l'axe ajusté (sur TOUT le
  // maillage : contrairement à l'axe, cette mesure n'est pas biaisée par les
  // faces de bout).
  const v = new THREE.Vector3();
  const radii: number[] = [];
  let hMin = Infinity;
  let hMax = -Infinity;
  for (let i = 0; i < n; i++) {
    v.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]).sub(center);
    const h = v.dot(axis);
    if (h < hMin) hMin = h;
    if (h > hMax) hMax = h;
    radii.push(v.addScaledVector(axis, -h).length());
  }
  radii.sort((a, b) => a - b);
  const bore = radii[Math.floor(BORE_QUANTILE * radii.length)] ?? 0;
  const outer = radii[radii.length - 1] ?? 0;
  const height = hMax - hMin;

  console.log(
    `[socketThread] axe grossier (${coarseAxis.x.toFixed(3)}, ${coarseAxis.y.toFixed(3)}, ${coarseAxis.z.toFixed(3)}) ` +
      `→ affiné (${axis.x.toFixed(3)}, ${axis.y.toFixed(3)}, ${axis.z.toFixed(3)}), ` +
      `écart ${THREE.MathUtils.radToDeg(coarseAxis.angleTo(axis)).toFixed(1)}°, ` +
      `alésage ${bore.toFixed(4)}, dispersion paroi ${spread.toFixed(4)} (seuil ${SPREAD_GUARD})`
  );

  if (bore <= 1e-5 || height <= 1e-5) return null;
  // Garde-fou : au-delà du seuil, l'axe n'est pas assez fiable pour dessiner
  // un filet droit — voir SPREAD_GUARD.
  if (spread > SPREAD_GUARD) return null;

  // Le boudin ne doit ni percer la paroi extérieure ni obstruer l'alésage.
  const wire = Math.min(bore * WIRE_RATIO, Math.max((outer - bore) * 0.45, 1e-5));
  const pitch = bore * 2 * PITCH_RATIO;
  const span = height * HEIGHT_RATIO;
  const turns = Math.max(2, span / pitch);

  const geometry = new THREE.TubeGeometry(
    new HelixCurve(bore, pitch, turns, -span / 2),
    Math.round(turns * SEGMENTS_PER_TURN),
    wire,
    RADIAL_SEGMENTS,
    false
  );
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis)
  );
  geometry.translate(center.x, center.y, center.z);

  const thread = new THREE.Mesh(geometry, material);
  thread.name = "SocketThread";
  thread.castShadow = false;
  thread.receiveShadow = false;
  socket.add(thread);
  return thread;
}

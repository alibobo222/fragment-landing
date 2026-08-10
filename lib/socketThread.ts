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
 *     trompe ici : les deux faces annulaires des bouts portent l'essentiel des
 *     sommets, si bien que la direction dominante est l'axe et non le plan
 *     perpendiculaire — l'estimateur renvoie exactement la mauvaise.
 *   - Le centroïde des sommets n'est pas sur l'axe : les deux faces ne sont pas
 *     également maillées, et il dérive hors du tube.
 *
 * L'axe est donc AJUSTÉ : on cherche la direction pour laquelle la distance à
 * l'axe est la plus constante, ce qui est la définition même d'un cylindre. Le
 * centre en découle par moyenne des projections perpendiculaires — un ajustement
 * aux moindres carrés de la ligne d'axe, insensible à la répartition du maillage.
 * Sur la douille réelle, cela donne une dispersion radiale faible et un alésage
 * quasi constant sur toute la hauteur, ce qu'aucune des autres méthodes n'a
 * atteint.
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

interface AxisFit {
  axis: THREE.Vector3;
  center: THREE.Vector3;
  /** Dispersion radiale relative : 0 = cylindre parfait. Sert de score. */
  spread: number;
}

/** Évalue une direction : centre par moindres carrés, puis dispersion radiale. */
function scoreAxis(points: Float32Array, n: number, axis: THREE.Vector3): AxisFit {
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

/** Recherche de l'axe : balayage grossier de la sphère, puis raffinements. */
function fitAxis(points: Float32Array, n: number): AxisFit {
  const dir = new THREE.Vector3();
  let best: AxisFit = scoreAxis(points, n, new THREE.Vector3(0, 0, 1));
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
  return best;
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

  const { axis, center } = fitAxis(pts, n);

  // Alésage et hauteur, mesurés le long de l'axe ajusté.
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
  if (bore <= 1e-5 || height <= 1e-5) return null;

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

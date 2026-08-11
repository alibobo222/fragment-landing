"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";
import {
  variants,
  defaultVariantId,
  defaultPerforation,
  type PerforationShape,
} from "@/data/product";
import {
  LAMP_MODEL_URL,
  lampMeshMapping,
  finishFor,
  shadeTransmission,
  canEmit,
  lampLightConfig as cfg,
  type LampPart,
} from "@/data/lampModel";
import {
  createGrainMaterial,
  applyProfile,
  applyInteriorVeneer,
  applyPerforation,
  materialProfile,
  getWeaveTexture,
} from "@/lib/lampTextures";
import { addSocketThread } from "@/lib/socketThread";
import type { PartVariants } from "@/components/hero/Lamp3D";

/**
 * Vue éclatée 3D de la lampe, pilotée par le scroll.
 *
 * Le modèle, les matériaux, les couleurs et les textures sont EXACTEMENT ceux
 * du configurateur (mêmes helpers `createGrainMaterial` / `applyProfile` /
 * `applyInteriorVeneer`). Aucune simplification du modèle.
 *
 * Chaque pièce est aplatie sous `root` (`root.attach`) puis translatée le long
 * de l'axe de montage RÉEL de la lampe (douille → abat-jour), avec un léger
 * décalage latéral du groupe électrique (douille / ampoule / câble) pour
 * retrouver la composition de l'illustration de référence. La progression
 * (0 = assemblée, 1 = éclatée) vient du scroll et est lissée frame à frame :
 * animation GPU, réversible, sans mouvement brusque.
 */

// Cadrage : même angle 3/4 que le configurateur, reculé pour laisser respirer
// les pièces éclatées (haut ↔ bas), avec une marge blanche autour.
//
// Les trois composantes sont proportionnelles : les faire varier ensemble
// change la DISTANCE sans toucher à la direction du regard (angle 3/4 conservé).
// Réglée pour que la composition éclatée remplisse largement sa fenêtre — un
// recul plus prudent avait été essayé et rendait la lampe trop petite. La place
// nécessaire à la nomenclature est prise sur l'ÉTALEMENT LATÉRAL des pièces
// (voir EXPLODE ci-dessous), pas en éloignant la caméra : on garde ainsi un
// objet grand ET des marges franches à gauche et à droite.
const CAMERA: [number, number, number] = [0.405, 0.27, 1.15];
const FOV = 30;

// Rotation d'affichage du GROUPE PARENT (toutes les pièces). Orientation de base
// -0.35 rad + 90° vers la gauche (+π/2, antihoraire vu de dessus). Devient
// l'orientation de référence, assemblée comme éclatée ; la caméra n'est PAS
// tournée pour la simuler.
const DISPLAY_ROT: [number, number, number] = [0, -0.35 + Math.PI / 2, 0];

// Config 01 légèrement moins lumineuse (cohérent avec le configurateur).
const CONFIG1_BRIGHTNESS = 0.85;

/**
 * Multiplicateur CENTRAL d'amplitude de l'éclaté : règle d'un seul endroit la
 * distance globale parcourue par les pièces (les valeurs `EXPLODE` ci-dessous
 * fixent les distances RELATIVES entre pièces, cette constante l'échelle).
 *
 * ⚠️ Cette constante et `CAMERA` se règlent ENSEMBLE. Ce qui fait qu'une pièce
 * paraît grande à l'écran, ce n'est pas seulement la distance de caméra : c'est
 * l'encombrement total de la composition, qui doit tenir dans le cadre. Écarter
 * moins les pièces libère du cadre, donc permet de rapprocher la caméra, donc
 * grossit chaque pièce. Éloigner la caméra pour « faire de la place » produit
 * l'effet inverse de celui recherché.
 */
const EXPLODE_SCALE = 1.64;

/**
 * Amplitude d'éclatement RELATIVE par pièce, en fraction de la hauteur du corps
 * (abat-jour ↔ pied). `axis` = le long de l'axe de montage (+ vers l'abat-jour) ;
 * `lat` = décalage latéral (le groupe électrique sort vers la droite de l'écran,
 * comme sur l'illustration). Multipliée par `EXPLODE_SCALE`.
 */
// Deux réglages cohabitent ici, pour deux raisons distinctes.
//
// `lat` (écartement latéral) est resserré : le groupe électrique s'écartait
// jusqu'à toucher le bord droit de la colonne, là où vivent les étiquettes 04 à
// 06. Il reste nettement détaché, mais laisse une marge franche — c'est ce qui
// permet de garder la lampe grande.
//
// `axis` (position le long de l'axe de montage) ÉTAGE le groupe électrique.
// Ampoule, douille et câble étaient tassés sur 18 % de la hauteur totale : trois
// étiquettes distinctes désignaient un même petit amas, ce qui rendait la
// planche illisible quelle que soit la position des étiquettes. Ils occupent
// maintenant environ un tiers de la hauteur, dans l'ordre 04 → 05 → 06, sans
// changer l'encombrement global (l'amplitude abat-jour ↔ pied reste 1,8).
// ⚠️ ABAISSER L'ASSEMBLAGE SANS LE RAPPROCHER DE L'AMPOULE est contradictoire
// si l'on ne bouge que lui : sur l'axe de montage, l'assemblage est AU-DESSUS de
// l'ampoule, donc le descendre les rapproche mécaniquement. C'est pour ça que le
// petit abaissement précédent n'a rien réglé — il allait dans le mauvais sens.
//
// Tout le groupe électrique descend donc avec lui, et davantage. Ce qui compte
// n'est pas la position absolue mais l'ÉCART entre les deux pièces les plus
// larges de la lampe, les seules à se recouvrir à la projection :
//
//   assemblage ↔ ampoule    : 0,39 → 0,52   (le plus grand écart de la planche)
//   abat-jour  ↔ assemblage : 0,59 → 0,70
//
// L'encombrement total passe de 1,84 à 1,92 : ni le cadrage ni la taille
// apparente de la lampe ne changent de façon perceptible.
// ⚠️ CE QUI COMPTE EST L'ÉCART, PAS LA POSITION.
//
// Deux tentatives ont échoué avant celle-ci, pour deux raisons différentes.
// D'abord abaisser le seul assemblage : sur l'axe de montage il est AU-DESSUS de
// l'ampoule, donc le descendre les rapprochait. Ensuite descendre tout le groupe
// électrique : l'écart a bien augmenté, mais pas assez pour deux pièces aussi
// LARGES que l'assemblage (tôle pliée) et l'ampoule — leurs centres s'écartent
// alors que leurs silhouettes continuent de se recouvrir à la projection.
//
// La bonne manœuvre est de REDISTRIBUER l'amplitude au lieu de l'augmenter :
// l'écart assemblage ↔ ampoule gagne un tiers, tandis que EXPLODE_SCALE baisse
// d'autant (1,95 → 1,64) pour que l'encombrement total reste IDENTIQUE. La lampe
// ne rapetisse donc pas d'un pixel — c'est le partage de l'espace entre pièces
// qui change, au profit de la seule paire qui posait problème.
//
//   assemblage ↔ ampoule : 1,01 → 1,35 unités (+33 %)
//   encombrement total   : 3,74 → 3,74 unités (inchangé)
// ⚠️ VALEURS CALCULÉES SUR LA GÉOMÉTRIE RÉELLE, pas réglées à vue.
//
// L'erreur des versions précédentes : `unit` (la distance entre les centres de
// l'abat-jour et de l'assemblage) vaut 0,0356 — alors que les pièces mesurent
// entre 0,09 et 0,22 de haut. L'unité d'éclatement est donc TROIS À SIX FOIS
// PLUS PETITE que les pièces qu'elle est censée écarter. Des valeurs autour de
// 1 séparaient les CENTRES sans jamais séparer les VOLUMES : à la mesure, les
// cinq paires consécutives se recouvraient, pas seulement assemblage ↔ ampoule.
//
// Autre méprise corrigée : dans la lampe montée, l'ampoule est AU-DESSUS de
// l'assemblage (elle est logée dans l'abat-jour). Les anciens réglages les
// faisaient donc se croiser pendant l'éclatement — d'où un recouvrement garanti
// à mi-course quoi qu'on fasse.
//
// Chaque écart vaut désormais la somme des demi-hauteurs réelles des deux pièces
// plus une marge, l'ordre naturel du montage étant respecté :
//
//   abat-jour ↔ ampoule    marge 0,008
//   ampoule   ↔ assemblage marge 0,008
//   assemblage ↔ douille   marge 0,008
//   douille   ↔ pied       marge 0,008
//
// Le câble reste hors de ce calcul : sa boîte englobante (0,33 × 0,29) est
// énorme alors que le tube lui-même est fin, donc la boîte déborde sur tout sans
// que rien ne se voie. Il est séparé LATÉRALEMENT, ce qui suffit visuellement.
const EXPLODE: Record<LampPart, { axis: number; lat: number }> = {
  shade: { axis: 0.92, lat: 0 },
  // SEULE pièce retouchée. Elle recouvrait l'ampoule ; la mesure de la géométrie
  // montre qu'il suffit de les séparer dans UNE direction, et que la largeur est
  // libre — personne n'occupe la gauche du cadre. Un décalage latéral de 1,15
  // porte l'écart réel à ~0,108, soit un peu plus que la somme de leurs
  // demi-largeurs (0,106). La composition VERTICALE, elle, ne bouge pas : c'est
  // ce qui avait été détruit par la version précédente, où j'écartais tout le
  // monde pour résoudre une collision entre deux pièces.
  connector: { axis: 0.05, lat: -1.15 },
  bulb: { axis: -0.62, lat: 0.36 },
  socket: { axis: -0.86, lat: 0.44 },
  cable: { axis: -1.1, lat: 0.48 },
  base: { axis: -1.36, lat: 0 },
};

const NAME_TO_PART: Record<string, LampPart> = {};
for (const [part, names] of Object.entries(lampMeshMapping))
  for (const n of names) NAME_TO_PART[n] = part as LampPart;

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface PartMove {
  part: LampPart;
  mesh: THREE.Object3D;
  orig: THREE.Vector3;
  off: THREE.Vector3;
  /** Centre géométrique de la pièce (repère local du mesh) → repère de position. */
  localCenter: THREE.Vector3;
  /** Points pris SUR la surface (repère local) → cibles réelles des flèches. */
  samples: THREE.Vector3[];
  /** Tampon de projection réutilisé chaque frame (aucune allocation en boucle). */
  projected: Float32Array;
}

/** Nombre de points de surface échantillonnés par pièce pour l'ancrage. */
const ANCHOR_SAMPLES = 24;

/**
 * Position 2D projetée d'une pièce (normalisée 0→1 dans la boîte du canvas).
 *
 * `nx`/`ny` sont le centre géométrique — utile pour situer la pièce, mais
 * INSUFFISANT pour y faire pointer une flèche : sur une pièce creuse ou courbe,
 * le centre de la boîte englobante tombe dans le vide. C'est exactement ce qui
 * arrivait au câble, dont le centre de boîte se situe à côté du tube, jamais
 * dessus. D'où l'impression de flèches désignant le néant.
 *
 * `pts` porte donc en plus un échantillon de points pris SUR la surface réelle
 * (des sommets de la géométrie), projetés à l'écran et filtrés de ceux qui
 * passent derrière la caméra. La couche d'annotations y choisit le point le plus
 * pertinent selon la position de son étiquette.
 */
export interface ProjectedAnchor {
  nx: number;
  ny: number;
  visible: boolean;
  /** Paires (nx, ny) successives, valides jusqu'à `count` points. */
  pts: Float32Array;
  count: number;
}
export type AnchorMap = Partial<Record<LampPart, ProjectedAnchor>>;

const _projV = new THREE.Vector3();

function ExplodedModel({
  partVariants,
  lampOn,
  warm,
  perforation,
  progressRef,
  anchorsRef,
}: {
  partVariants: PartVariants;
  lampOn: boolean;
  warm: boolean;
  perforation: PerforationShape;
  progressRef: MutableRefObject<number>;
  /** Reçoit à chaque frame la projection 2D de chaque pièce (pour l'overlay). */
  anchorsRef?: MutableRefObject<AnchorMap | null>;
}) {
  const { scene } = useGLTF(LAMP_MODEL_URL);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const reduce = useReducedMotion();

  const {
    root,
    materials,
    moves,
    baseMove,
    baseHalfHeight,
    groundY,
    shadowScale,
    shadowFar,
    thread,
  } = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);

    const materials: Partial<Record<LampPart, THREE.MeshStandardMaterial>> = {};
    const boxes: Partial<Record<LampPart, THREE.Box3>> = {};
    const meshByPart: Partial<Record<LampPart, THREE.Mesh>> = {};

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const part = NAME_TO_PART[mesh.name];
      if (!part) return;

      let mat: THREE.MeshStandardMaterial;
      if (part === "bulb") {
        // Ampoule : matériau LISSE (pas de grain), identique au configurateur.
        const bm = new THREE.MeshStandardMaterial({
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        bm.emissive = new THREE.Color("#ffefd8");
        bm.emissiveIntensity = 0;
        mat = bm;
      } else {
        const gm =
          part === "cable"
            ? createGrainMaterial(getWeaveTexture())
            : createGrainMaterial();
        if (part === "shade") {
          gm.emissive = new THREE.Color(cfg.color);
          gm.emissiveIntensity = 0;
        }
        mat = gm;
      }

      // Même verrou d'émission que dans le configurateur (voir `canEmit`).
      if (!canEmit(part)) {
        mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = 0;
      }

      materials[part] = mat;
      mesh.material = mat;
      mesh.castShadow = false;
      mesh.receiveShadow = false;

      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      boxes[part] = boxes[part] ? boxes[part]!.union(b) : b;
      meshByPart[part] = mesh;
    });

    const centerOf = (p: LampPart) =>
      boxes[p] ? boxes[p]!.getCenter(new THREE.Vector3()) : null;

    // Axe de montage réel : de la douille vers l'abat-jour.
    const shadeC = centerOf("shade") ?? new THREE.Vector3();
    const socketC = centerOf("connector") ?? centerOf("base") ?? shadeC.clone();
    const up = shadeC.clone().sub(socketC);
    const unit = Math.max(up.length(), 1e-4);
    up.normalize();

    // Latéral CONSCIENT DE LA ROTATION du groupe : on veut que l'écartement du
    // groupe électrique reste horizontal À L'ÉCRAN (vers la droite), quelle que
    // soit la rotation d'affichage. On vise donc +X monde ⟂ à l'axe (exprimé en
    // repère AFFICHÉ, post-rotation), puis on ramène ce vecteur en repère `root`
    // (pré-rotation) car les offsets sont appliqués sous le groupe tourné.
    const qDisp = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(DISPLAY_ROT[0], DISPLAY_ROT[1], DISPLAY_ROT[2])
    );
    const upWorld = up.clone().applyQuaternion(qDisp);
    let latWorld = new THREE.Vector3(1, 0, 0).projectOnPlane(upWorld);
    if (latWorld.lengthSq() < 1e-6)
      latWorld = new THREE.Vector3(0, 0, 1).projectOnPlane(upWorld);
    latWorld.normalize();
    const lat = latWorld.applyQuaternion(qDisp.clone().invert());

    // Corps (abat-jour + pied) pour recentrer le cadrage.
    const body = new THREE.Box3();
    if (boxes.shade) body.union(boxes.shade);
    if (boxes.base) body.union(boxes.base);
    const c = body.getCenter(new THREE.Vector3());

    // Aplatit chaque pièce sous `root` (préserve la position monde) puis mémorise
    // sa position d'origine + son vecteur d'éclatement (exprimé dans root-space).
    const moves: PartMove[] = [];
    for (const key of Object.keys(meshByPart) as LampPart[]) {
      const mesh = meshByPart[key]!;
      root.attach(mesh);
      const e = EXPLODE[key] ?? { axis: 0, lat: 0 };
      const off = up
        .clone()
        .multiplyScalar(e.axis * unit * EXPLODE_SCALE)
        .addScaledVector(lat, e.lat * unit * EXPLODE_SCALE);
      // Centre géométrique dans le repère LOCAL du mesh (invariant au déplacement).
      const localCenter =
        mesh.geometry?.boundingBox?.getCenter(new THREE.Vector3()) ??
        new THREE.Vector3();

      // Échantillon de sommets répartis dans le tampon de géométrie : ce sont
      // des points garantis SUR la matière, contrairement au centre de boîte.
      const samples: THREE.Vector3[] = [];
      const posAttr = mesh.geometry?.getAttribute("position");
      if (posAttr && posAttr.count > 0) {
        const stride = Math.max(1, Math.floor(posAttr.count / ANCHOR_SAMPLES));
        for (let vi = 0; vi < posAttr.count && samples.length < ANCHOR_SAMPLES; vi += stride) {
          samples.push(new THREE.Vector3().fromBufferAttribute(posAttr, vi));
        }
      }
      if (samples.length === 0) samples.push(localCenter.clone());

      moves.push({
        part: key,
        mesh,
        orig: mesh.position.clone(),
        off,
        localCenter,
        samples,
        projected: new Float32Array(samples.length * 2),
      });
    }

    // FILETAGE INTÉRIEUR de la douille — vraie géométrie, créée ici et
    // rattachée à la pièce (voir lib/socketThread.ts). Vue éclatée uniquement :
    // c'est elle qui doit faire comprendre le vissage de l'ampoule. Le filet
    // partage le matériau de la douille, donc il suit la finition métallique de
    // la configuration choisie sans code supplémentaire. Créé APRÈS la boucle
    // d'aplatissement, pour ne pas muter la scène pendant qu'on la parcourt.
    // FILETAGE INTÉRIEUR de la douille — vraie géométrie, créée ici et
    // rattachée à la pièce (voir lib/socketThread.ts). Vue éclatée uniquement.
    // L'axe et le centre du logement y sont AJUSTÉS sur la géométrie : la pièce
    // est inclinée dans le modèle, aucune approximation ne tient.
    const socketMesh = meshByPart.socket;
    const socketMat = materials.socket;
    const thread =
      socketMesh && socketMat ? addSocketThread(socketMesh, socketMat) : null;

    root.position.sub(c);

    // Ombre de contact douce, au niveau du pied assemblé (fixe : composition
    // « posée » dans l'espace, esprit photo de galerie).
    const baseBox = boxes.base ?? body;
    const groundY = baseBox.min.y - c.y;
    const bodySize = body.getSize(new THREE.Vector3());
    const baseSize = baseBox.getSize(new THREE.Vector3());
    const shadowScale = Math.max(
      Math.max(baseSize.x, baseSize.z) * 3.2,
      bodySize.x * 1.7
    );
    const shadowFar = Math.max(bodySize.y * 1.2, 0.001);

    // Pièce dont l'ombre de contact doit suivre le déplacement (le pied).
    const baseMove = moves.find((m) => m.part === "base") ?? null;
    // Demi-hauteur du pied : sert à poser l'ombre sous sa FACE INFÉRIEURE, et
    // non sous son centre géométrique (sinon l'ombre traverserait la pièce).
    const baseHalfHeight = baseSize.y / 2;

    return {
      root,
      materials,
      moves,
      baseMove,
      baseHalfHeight,
      groundY,
      shadowScale,
      shadowFar,
      thread,
    };
  }, [scene]);

  // Matières + couleurs de la variante courante (identiques au configurateur).
  // Application directe (état statique : la vue éclatée reflète la config en cours).
  useEffect(() => {
    const apply = (part: Exclude<LampPart, "bulb">, idx: number) => {
      const m = materials[part] as THREE.MeshPhysicalMaterial | undefined;
      if (!m) return;
      const finish = finishFor(part, variants[idx]);
      applyProfile(m, finish.color, materialProfile(finish.label));
      if (!canEmit(part)) {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      }
    };
    apply("shade", partVariants.shade);
    apply("connector", partVariants.connector);
    apply("base", partVariants.base);
    apply("socket", partVariants.connector); // douille = finition de l'assemblage
    apply("cable", partVariants.cable);

    // MÊME traitement que le configurateur, via le MÊME helper : la pièce
    // d'assemblage garde une identité visuelle identique dans les deux vues.
    const connectorMat = materials.connector as THREE.MeshPhysicalMaterial | undefined;
    if (connectorMat) applyPerforation(connectorMat, perforation);

    // Le placage bois intérieur est une DONNÉE, pas un cas particulier du
    // rendu : la variante le déclare via `shadeInner`. Ajouter demain une
    // configuration à intérieur bois ne demandera aucune retouche ici.
    // La luminosité, elle, reste indexée sur l'identifiant : c'est un réglage
    // d'éclairage propre au prototype, sans rapport avec la matière.
    const isConfig01 = variants[partVariants.shade].id === defaultVariantId;
    const shadeMat = materials.shade as THREE.MeshPhysicalMaterial | undefined;
    if (shadeMat)
      applyInteriorVeneer(shadeMat, Boolean(variants[partVariants.shade].shadeInner));

    // Émission (source lumineuse) : reflète l'état allumé/éteint + température,
    // sans lumière projetée (les pièces sont séparées). Éclairage principal =
    // studio + environnement, inchangé.
    const b = isConfig01 ? CONFIG1_BRIGHTNESS : 1;
    const on = lampOn ? 1 : 0;
    const lightColor = new THREE.Color(warm ? cfg.colorWarm : cfg.colorCold);
    if (materials.bulb) {
      materials.bulb.emissive.copy(lightColor);
      materials.bulb.emissiveIntensity = cfg.emissiveIntensity * on * b;
    }
    if (materials.shade) {
      materials.shade.emissive.copy(lightColor);
      materials.shade.emissiveIntensity =
        cfg.glassGlowMax *
        shadeTransmission(variants[partVariants.shade].shade.label) *
        on *
        b;
    }
    invalidate();
  }, [materials, partVariants, lampOn, warm, perforation, invalidate]);

  // La géométrie du filet est la SEULE que ce composant crée — les autres
  // viennent du GLTF mis en cache par drei et sont partagées, donc à ne jamais
  // libérer. Celle-ci doit l'être au démontage, sinon chaque passage de scroll
  // en laisse une derrière lui.
  useEffect(() => () => thread?.geometry.dispose(), [thread]);

  // Ancre de l'ombre de contact : suit le pied dans les TROIS axes, lue chaque
  // frame sur sa matrice monde (voir useFrame plus bas).
  const shadowAnchorRef = useRef<THREE.Group>(null);
  const _shadowOff = useMemo(() => new THREE.Vector3(), []);

  // Progression lissée : suit le scroll (0 → 1) sans à-coups, réversible.
  // Lerp volontairement doux (k faible) : mouvement contemplatif, jamais saccadé.
  const cur = useRef(0);
  useFrame(() => {
    const target = easeInOut(Math.min(1, Math.max(0, progressRef.current)));
    const k = reduce ? 1 : 0.1;
    let p = cur.current + (target - cur.current) * k;
    if (Math.abs(target - p) < 0.0004) p = target;
    if (p !== cur.current) {
      cur.current = p;
      for (const { mesh, orig, off } of moves)
        mesh.position.copy(orig).addScaledVector(off, p);
      invalidate();
    }

    // Ombre de contact — recalée sous la position RÉELLE du pied, dans les trois
    // axes, à partir de sa matrice monde (rotation d'affichage comprise).
    //
    // ⚠️ Version précédente : seuls X et Z suivaient, Y restait cloué au sol de
    // la composition assemblée (groundY), au nom d'un « vrai sol ne monte ni ne
    // descend ». Sauf que le pied DESCEND d'environ 1,6 fois la hauteur du corps
    // pendant l'éclatement : l'ombre restait donc loin au-dessus de lui,
    // visiblement décrochée. Une vue éclatée n'est pas une scène posée sur un
    // sol — c'est une planche technique où chaque pièce flotte ; l'ombre y est
    // un ancrage visuel attaché à la pièce, pas un plan de référence.
    if (baseMove && shadowAnchorRef.current) {
      baseMove.mesh.updateWorldMatrix(true, false);
      _shadowOff
        .copy(baseMove.localCenter)
        .applyMatrix4(baseMove.mesh.matrixWorld);
      shadowAnchorRef.current.position.set(
        _shadowOff.x,
        _shadowOff.y - baseHalfHeight,
        _shadowOff.z
      );
    }

    // Projection 2D vers coordonnées écran → ancrage des annotations HTML/SVG.
    // Centre de pièce ET points de surface. Les objets d'ancrage sont créés une
    // seule fois puis mutés : rien n'est alloué dans la boucle de rendu.
    if (anchorsRef) {
      const out: AnchorMap = anchorsRef.current ?? {};
      for (const mv of moves) {
        mv.mesh.updateWorldMatrix(true, false);

        _projV.copy(mv.localCenter).applyMatrix4(mv.mesh.matrixWorld).project(camera);
        const centreVisible = _projV.z < 1;
        const cx = _projV.x * 0.5 + 0.5;
        const cy = -_projV.y * 0.5 + 0.5;

        let n = 0;
        for (const sample of mv.samples) {
          _projV.copy(sample).applyMatrix4(mv.mesh.matrixWorld).project(camera);
          if (_projV.z >= 1) continue; // derrière la caméra : inutilisable
          mv.projected[n * 2] = _projV.x * 0.5 + 0.5;
          mv.projected[n * 2 + 1] = -_projV.y * 0.5 + 0.5;
          n++;
        }

        const slot = out[mv.part];
        if (slot) {
          slot.nx = cx;
          slot.ny = cy;
          slot.visible = centreVisible;
          slot.count = n;
        } else {
          out[mv.part] = {
            nx: cx,
            ny: cy,
            visible: centreVisible,
            pts: mv.projected,
            count: n,
          };
        }
      }
      anchorsRef.current = out;
    }
  });

  return (
    <>
      <group rotation={DISPLAY_ROT}>
        <primitive object={root} />
      </group>
      {/* Repositionnée chaque frame SOUS LE PIED, en X, Y ET Z (voir useFrame)
          : l'ombre reste collée à la face inférieure de la pièce pendant tout
          l'éclatement, au lieu de rester accrochée au sol de la composition
          assemblée. La position initiale ci-dessous ne sert qu'au premier rendu. `frames={Infinity}` : se redessine en continu
          (nécessaire puisqu'elle bouge, contrairement à la scène assemblée
          statique du configurateur). */}
      <group ref={shadowAnchorRef} position={[0, groundY, 0]}>
        <ContactShadows
          scale={shadowScale}
          far={shadowFar}
          resolution={512}
          blur={2.7}
          opacity={0.42}
          color="#1b1b22"
          frames={Infinity}
        />
      </group>
    </>
  );
}

function ProceduralEnv() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

export function ExplodedLamp3D({
  partVariants,
  lampOn,
  warm,
  perforation = defaultPerforation,
  progressRef,
  active,
  onCreated,
  anchorsRef,
}: {
  partVariants: PartVariants;
  lampOn: boolean;
  warm: boolean;
  /** Géométrie des perforations de la pièce d'assemblage. */
  perforation?: PerforationShape;
  progressRef: MutableRefObject<number>;
  /** Section proche du viewport → boucle de rendu continue (suit le scroll). */
  active: boolean;
  onCreated?: () => void;
  /** Reçoit la projection 2D des pièces pour l'overlay d'annotations. */
  anchorsRef?: MutableRefObject<AnchorMap | null>;
}) {
  return (
    <Canvas
      camera={{ position: CAMERA, fov: FOV }}
      dpr={[1, 1.8]}
      frameloop={active ? "always" : "demand"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={() => onCreated?.()}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Éclairage de studio identique au configurateur (principal, inchangé). */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[2.5, 4, 2]} intensity={1.55} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.5} color="#cdd6ff" />
      <ProceduralEnv />
      <ExplodedModel
        partVariants={partVariants}
        lampOn={lampOn}
        warm={warm}
        perforation={perforation}
        progressRef={progressRef}
        anchorsRef={anchorsRef}
      />
    </Canvas>
  );
}

useGLTF.preload(LAMP_MODEL_URL);

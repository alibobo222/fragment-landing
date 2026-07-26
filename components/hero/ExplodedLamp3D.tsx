"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import { useReducedMotion } from "framer-motion";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";
import { variants, defaultVariantId } from "@/data/product";
import {
  LAMP_MODEL_URL,
  lampMeshMapping,
  finishFor,
  shadeTransmission,
  lampLightConfig as cfg,
  type LampPart,
} from "@/data/lampModel";
import {
  createGrainMaterial,
  applyProfile,
  applyInteriorVeneer,
  materialProfile,
  getWeaveTexture,
} from "@/lib/lampTextures";
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
const CAMERA: [number, number, number] = [0.54, 0.36, 1.54];
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
 */
const EXPLODE_SCALE = 1.85;

/**
 * Amplitude d'éclatement RELATIVE par pièce, en fraction de la hauteur du corps
 * (abat-jour ↔ pied). `axis` = le long de l'axe de montage (+ vers l'abat-jour) ;
 * `lat` = décalage latéral (le groupe électrique sort vers la droite de l'écran,
 * comme sur l'illustration). Multipliée par `EXPLODE_SCALE`.
 */
const EXPLODE: Record<LampPart, { axis: number; lat: number }> = {
  shade: { axis: 0.9, lat: 0 },
  connector: { axis: 0.32, lat: -0.28 },
  bulb: { axis: -0.06, lat: 0.5 },
  socket: { axis: -0.2, lat: 0.56 },
  cable: { axis: -0.38, lat: 0.86 },
  base: { axis: -0.88, lat: 0 },
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
  /** Centre géométrique de la pièce (repère local du mesh) → ancrage des flèches. */
  localCenter: THREE.Vector3;
}

/** Position 2D projetée d'une pièce (normalisée 0→1 dans la boîte du canvas). */
export interface ProjectedAnchor {
  nx: number;
  ny: number;
  visible: boolean;
}
export type AnchorMap = Partial<Record<LampPart, ProjectedAnchor>>;

const _projV = new THREE.Vector3();

function ExplodedModel({
  partVariants,
  lampOn,
  warm,
  progressRef,
  anchorsRef,
}: {
  partVariants: PartVariants;
  lampOn: boolean;
  warm: boolean;
  progressRef: MutableRefObject<number>;
  /** Reçoit à chaque frame la projection 2D de chaque pièce (pour l'overlay). */
  anchorsRef?: MutableRefObject<AnchorMap | null>;
}) {
  const { scene } = useGLTF(LAMP_MODEL_URL);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const reduce = useReducedMotion();

  const { root, materials, moves, groundY, shadowScale, shadowFar } = useMemo(() => {
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
      moves.push({ part: key, mesh, orig: mesh.position.clone(), off, localCenter });
    }

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

    return { root, materials, moves, groundY, shadowScale, shadowFar };
  }, [scene]);

  // Matières + couleurs de la variante courante (identiques au configurateur).
  // Application directe (état statique : la vue éclatée reflète la config en cours).
  useEffect(() => {
    const apply = (part: Exclude<LampPart, "bulb">, idx: number) => {
      const m = materials[part] as THREE.MeshPhysicalMaterial | undefined;
      if (!m) return;
      const finish = finishFor(part, variants[idx]);
      applyProfile(m, finish.color, materialProfile(finish.label));
    };
    apply("shade", partVariants.shade);
    apply("connector", partVariants.connector);
    apply("base", partVariants.base);
    apply("socket", partVariants.connector); // douille = finition de l'assemblage
    apply("cable", partVariants.cable);

    const isConfig01 = variants[partVariants.shade].id === defaultVariantId;
    const shadeMat = materials.shade as THREE.MeshPhysicalMaterial | undefined;
    if (shadeMat) applyInteriorVeneer(shadeMat, isConfig01);

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
  }, [materials, partVariants, lampOn, warm, invalidate]);

  // Progression lissée : suit le scroll (0 → 1) sans à-coups, réversible.
  const cur = useRef(0);
  useFrame(() => {
    const target = easeInOut(Math.min(1, Math.max(0, progressRef.current)));
    const k = reduce ? 1 : 0.16;
    let p = cur.current + (target - cur.current) * k;
    if (Math.abs(target - p) < 0.0004) p = target;
    if (p !== cur.current) {
      cur.current = p;
      for (const { mesh, orig, off } of moves)
        mesh.position.copy(orig).addScaledVector(off, p);
      invalidate();
    }

    // Projection 2D des centres de pièces → ancrage des annotations HTML/SVG.
    // (6 projections/frame : négligeable ; le texte reste HORS de la scène 3D.)
    if (anchorsRef) {
      const out: AnchorMap = anchorsRef.current ?? {};
      for (const mv of moves) {
        mv.mesh.updateWorldMatrix(true, false);
        _projV.copy(mv.localCenter).applyMatrix4(mv.mesh.matrixWorld).project(camera);
        out[mv.part] = {
          nx: _projV.x * 0.5 + 0.5,
          ny: -_projV.y * 0.5 + 0.5,
          visible: _projV.z < 1,
        };
      }
      anchorsRef.current = out;
    }
  });

  return (
    <>
      <group rotation={DISPLAY_ROT}>
        <primitive object={root} />
      </group>
      <ContactShadows
        position={[0, groundY, 0]}
        scale={shadowScale}
        far={shadowFar}
        resolution={512}
        blur={2.7}
        opacity={0.42}
        color="#1b1b22"
        frames={1}
      />
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
  progressRef,
  active,
  onCreated,
  anchorsRef,
}: {
  partVariants: PartVariants;
  lampOn: boolean;
  warm: boolean;
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
        progressRef={progressRef}
        anchorsRef={anchorsRef}
      />
    </Canvas>
  );
}

useGLTF.preload(LAMP_MODEL_URL);

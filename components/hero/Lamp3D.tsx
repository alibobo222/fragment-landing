"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, ContactShadows } from "@react-three/drei";
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
  kelvinToRGB,
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
  type InteriorVeneer,
} from "@/lib/lampTextures";

export interface PartVariants {
  shade: number;
  connector: number;
  base: number;
  cable: number;
}

// Réglages de cadrage (déterminés visuellement).
const CAMERA: [number, number, number] = [0.2, 0.12, 0.44];
const FOV = 32;

// Luminosité de la lampe par configuration (multiplicateur). La config 01 est
// légèrement moins lumineuse à la demande ; toutes les autres restent à 1.
const CONFIG1_BRIGHTNESS = 0.85;

const NAME_TO_PART: Record<string, LampPart> = {};
for (const [part, names] of Object.entries(lampMeshMapping))
  for (const n of names) NAME_TO_PART[n] = part as LampPart;

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

function LampModel({
  partVariants,
  lampOn,
  kelvin,
  perforation,
}: {
  partVariants: PartVariants;
  lampOn: boolean;
  /** Température de couleur courante, en kelvins (curseur continu). */
  kelvin: number;
  perforation: PerforationShape;
}) {
  const { scene } = useGLTF(LAMP_MODEL_URL);
  const invalidate = useThree((s) => s.invalidate);
  const reduce = useReducedMotion();

  // Clone, matériaux dédiés, positions des pièces et lumières de la lampe.
  const { root, materials, spot, point, groundY, shadowScale, shadowFar } = useMemo(() => {
    const root = scene.clone(true);
    root.updateMatrixWorld(true);

    const materials: Partial<Record<LampPart, THREE.MeshStandardMaterial>> = {};
    const boxes: Partial<Record<LampPart, THREE.Box3>> = {};

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const part = NAME_TO_PART[mesh.name];
      if (!part) return;

      let mat: THREE.MeshStandardMaterial;
      if (part === "bulb") {
        const bm = new THREE.MeshStandardMaterial({
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        bm.emissive = new THREE.Color("#ffefd8"); // blanc chaud doux
        bm.emissiveIntensity = 0; // monte au fade-in
        mat = bm;
      } else {
        // Matière texturée (grain triplanar procédural) selon la configuration.
        // Le câble reçoit une texture textile tressée dans toutes les configs.
        // blockLampLight : seules l'abat-jour, l'ampoule et la douille doivent
        // s'éclairer avec l'ampoule (voir createGrainMaterial) — la pièce
        // d'assemblage, le pied et le câble en restent hors.
        const blockLampLight = part === "connector" || part === "base" || part === "cable";
        const gm =
          part === "cable"
            ? createGrainMaterial(getWeaveTexture(), blockLampLight)
            : createGrainMaterial(undefined, blockLampLight);
        if (part === "shade") {
          // Émission « de transmission » : couleur de la lumière, montée au frame.
          gm.emissive = new THREE.Color(cfg.color);
          gm.emissiveIntensity = 0;
        }
        mat = gm;
      }
      // Verrou d'émission : toute pièce hors liste d'autorisation (donc la
      // pièce d'assemblage et la douille) a son émission mise à zéro et n'est
      // plus jamais touchée par la logique d'allumage.
      if (!canEmit(part)) {
        mat.emissive.setRGB(0, 0, 0);
        mat.emissiveIntensity = 0;
      }

      materials[part] = mat;
      mesh.material = mat;
      mesh.castShadow = cfg.shadows && part !== "bulb";
      mesh.receiveShadow = false;

      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      boxes[part] = boxes[part] ? boxes[part]!.union(b) : b;
    });

    const centerOf = (p: LampPart) =>
      boxes[p] ? boxes[p]!.getCenter(new THREE.Vector3()) : null;

    // Origine de la lumière = ampoule (sinon centre intérieur de l'abat-jour).
    const bulbPos = centerOf("bulb") ?? centerOf("shade") ?? new THREE.Vector3();
    const shadeC = centerOf("shade") ?? bulbPos.clone();
    const socketC = centerOf("connector") ?? centerOf("base") ?? shadeC.clone();
    // Axe d'ouverture réel : de la douille vers l'abat-jour.
    const openingDir = shadeC.clone().sub(socketC).normalize();

    // Recentrage du cadrage sur le corps (abat-jour + pied).
    const body = new THREE.Box3();
    if (boxes.shade) body.union(boxes.shade);
    if (boxes.base) body.union(boxes.base);
    const c = body.getCenter(new THREE.Vector3());
    root.position.sub(c);

    // Lumière dirigée sortant par l'ouverture (enfant de root → suit la lampe).
    const spot = new THREE.SpotLight(
      new THREE.Color(cfg.color),
      0,
      cfg.distance,
      cfg.angle,
      cfg.penumbra,
      cfg.decay
    );
    spot.position.copy(bulbPos);
    const target = new THREE.Object3D();
    target.position.copy(bulbPos).addScaledVector(openingDir, 0.6);
    root.add(target);
    spot.target = target;
    if (cfg.shadows) {
      spot.castShadow = true;
      spot.shadow.mapSize.set(512, 512);
      spot.shadow.bias = -0.0015;
    }
    root.add(spot);

    // Diffusion intérieure douce.
    const point = new THREE.PointLight(
      new THREE.Color(cfg.color),
      0,
      cfg.pointDistance,
      cfg.decay
    );
    point.position.copy(bulbPos);
    root.add(point);

    // Ombre de contact : plan horizontal au niveau du pied (monde). Échelle
    // dérivée de l'empreinte du corps (hors câble, qui s'étale au sol).
    const baseBox = boxes.base ?? body;
    const groundY = baseBox.min.y - c.y;
    const bodySize = body.getSize(new THREE.Vector3());
    const baseSize = baseBox.getSize(new THREE.Vector3());
    const shadowScale = Math.max(
      Math.max(baseSize.x, baseSize.z) * 3.2,
      bodySize.x * 1.7
    );
    const shadowFar = Math.max(bodySize.y * 1.2, 0.001);

    return { root, materials, spot, point, groundY, shadowScale, shadowFar };
  }, [scene]);

  // Cible de transmission de l'abat-jour selon la matière courante.
  const shadeGlowTarget = useRef(0);
  // Couleurs cibles par partie → interpolation douce au changement de config
  // (jamais de « claquement » : la couleur de base glisse vers sa cible).
  const colorTargets = useRef<Partial<Record<LampPart, THREE.Color>>>({});
  const firstColorApply = useRef(true);
  // Multiplicateur de luminosité de la lampe (réduit pour la config 01).
  const brightnessRef = useRef(1);
  const lit = useRef(0); // progression de l'allumage 0→1
  // Couleur de lumière courante (interpolée en continu vers la cible). Initialisée
  // à la couleur d'init des lumières : le 1er frame interpole vers la teinte
  // cible, ce qui unifie toutes les sources (spot/point/ampoule/glow).
  const lightColor = useRef(new THREE.Color(cfg.color));
  // Cible de couleur du curseur Kelvin — recalculée uniquement quand `kelvin`
  // change (pas à chaque frame), puis lue par `useFrame` ci-dessous, qui
  // continue de lisser `lightColor` vers elle. Le curseur peut envoyer une
  // rafale de valeurs très proches pendant un glissement : ce lissage évite
  // tout saut visuel, même si l'utilisateur relâche brutalement le curseur.
  const tempTarget = useRef(new THREE.Color(kelvinToRGB(kelvin)));
  useEffect(() => {
    tempTarget.current.set(kelvinToRGB(kelvin));
  }, [kelvin]);
  useEffect(() => {
    const apply = (part: Exclude<LampPart, "bulb">, idx: number) => {
      const m = materials[part] as THREE.MeshPhysicalMaterial | undefined;
      if (!m) return;
      const finish = finishFor(part, variants[idx]);
      const tgt = (colorTargets.current[part] ??= new THREE.Color());
      tgt.set(finish.color);
      // On repart de la couleur COURANTE (sauf au tout premier rendu) et on
      // interpole vers la cible dans useFrame → transition douce des matières.
      const startHex = firstColorApply.current
        ? finish.color
        : "#" + m.color.getHexString();
      applyProfile(m, startHex, materialProfile(finish.material));
      // Ré-affirmé après chaque application de profil : changer de matière ne
      // doit en aucun cas rallumer l'émission d'une pièce qui n'y a pas droit.
      if (!canEmit(part)) {
        m.emissive.setRGB(0, 0, 0);
        m.emissiveIntensity = 0;
      }
    };
    apply("shade", partVariants.shade);
    apply("connector", partVariants.connector);
    apply("base", partVariants.base);
    apply("socket", partVariants.connector); // douille = assemblage, sauf `variant.socket`
    apply("cable", partVariants.cable);
    firstColorApply.current = false;

    // TÔLE PERFORÉE — pièce d'assemblage UNIQUEMENT. Réappliqué à chaque
    // changement de configuration : la finition métallique change (acier brut,
    // aluminium, laiton, inox, anodisé), le percement, lui, ne change jamais.
    // La douille (`socket`), qui partage pourtant la finition de l'assemblage,
    // n'est volontairement PAS percée : ce n'est pas une tôle.
    const connectorMat = materials.connector as THREE.MeshPhysicalMaterial | undefined;
    if (connectorMat) applyPerforation(connectorMat, perforation);

    // Placage à l'INTÉRIEUR de l'abat-jour. L'extérieur reste inchangé.
    // Config 01 : bois brûlé. Config 02 : Renature. Les autres gardent la
    // même matière dedans et dehors (pas de placage).
    const isConfig01 = variants[partVariants.shade].id === defaultVariantId;
    const shadeVariantId = variants[partVariants.shade].id;
    const interiorVeneer: InteriorVeneer =
      isConfig01 ? "wood"
      : shadeVariantId === "porcelaine-acier-noir" ? "renature"
      : null;
    const shadeMat = materials.shade as THREE.MeshPhysicalMaterial | undefined;
    if (shadeMat) applyInteriorVeneer(shadeMat, interiorVeneer);

    // Luminosité de la lampe : légèrement réduite pour la config 01. On
    // ré-applique immédiatement (le fade-in peut être terminé au changement).
    brightnessRef.current = isConfig01 ? CONFIG1_BRIGHTNESS : 1;
    const e = easeOut(lit.current);
    spot.intensity = cfg.spotIntensity * e * brightnessRef.current;
    point.intensity = cfg.pointIntensity * e * brightnessRef.current;
    if (materials.bulb)
      materials.bulb.emissiveIntensity = cfg.emissiveIntensity * e * brightnessRef.current;

    shadeGlowTarget.current =
      cfg.glassGlowMax *
      shadeTransmission(variants[partVariants.shade].shade.material);
    invalidate();
  }, [materials, partVariants, perforation, invalidate, spot, point]);

  // Libère les matériaux créés par ce montage (un par pièce, voir useMemo
  // ci-dessus) : sans ça, chaque aller-retour de scroll en laisse derrière lui.
  // Les géométries, elles, viennent du GLTF mis en cache par drei et sont
  // partagées entre scènes — jamais disposées ici.
  useEffect(() => {
    return () => {
      for (const mat of Object.values(materials)) mat?.dispose();
    };
  }, [materials]);

  useFrame((_, dt) => {
    let needsRender = false;

    // Allumage / extinction progressif vers l'état cible (bouton on/off).
    // Au chargement, la lampe est ÉTEINTE : `lit` vaut 0 et y reste tant que
    // personne n'appuie. Au clic : fondu fluide dans un sens ou l'autre. Seules
    // les intensités lumineuses varient.
    const target = lampOn ? 1 : 0;
    if (lit.current !== target) {
      if (reduce) {
        lit.current = target;
      } else {
        const step = (dt * 1000) / cfg.toggleDuration;
        lit.current =
          lit.current < target
            ? Math.min(target, lit.current + step)
            : Math.max(target, lit.current - step);
      }
      const e = easeOut(lit.current);
      const b = brightnessRef.current;
      spot.intensity = cfg.spotIntensity * e * b;
      point.intensity = cfg.pointIntensity * e * b;
      if (materials.bulb) materials.bulb.emissiveIntensity = cfg.emissiveIntensity * e * b;
      needsRender = true;
    }

    // Température de couleur : interpolation douce et CONTINUE vers la cible
    // pilotée par le curseur Kelvin (`tempTarget`, recalculée dans l'effet
    // ci-dessus à chaque valeur du curseur). N'affecte QUE la couleur des
    // lumières (spot/point/ampoule/glow), jamais les intensités. Quand la
    // lampe est éteinte (intensités 0), aucun effet visible ; la température
    // reste mémorisée et se restaure au rallumage.
    const colorTarget = tempTarget.current;
    const c = lightColor.current;
    const cd =
      Math.abs(c.r - colorTarget.r) +
      Math.abs(c.g - colorTarget.g) +
      Math.abs(c.b - colorTarget.b);
    if (cd > 0.0008) {
      const k = reduce ? 1 : 1 - Math.exp((-dt * 1000) / (cfg.tempTransitionMs / 3));
      c.lerp(colorTarget, reduce ? 1 : k);
      spot.color.copy(c);
      point.color.copy(c);
      // Seules les pièces autorisées suivent la couleur de la lumière. La
      // pièce d'assemblage n'apparaît volontairement pas ici.
      if (materials.bulb && canEmit("bulb")) materials.bulb.emissive.copy(c);
      if (materials.shade && canEmit("shade")) materials.shade.emissive.copy(c);
      needsRender = true;
    }

    // Transmission de l'abat-jour : interpolation douce (pas de clignotement).
    const shade = materials.shade;
    if (shade) {
      const tgt = shadeGlowTarget.current * easeOut(lit.current);
      if (Math.abs(shade.emissiveIntensity - tgt) > 0.002) {
        const k = reduce ? 1 : 1 - Math.exp((-dt * 1000) / (cfg.transitionMs / 3));
        shade.emissiveIntensity += (tgt - shade.emissiveIntensity) * k;
        needsRender = true;
      }
    }

    // Interpolation douce des couleurs de base (changement de configuration).
    const parts: LampPart[] = ["shade", "connector", "base", "socket", "cable"];
    for (const part of parts) {
      const m = materials[part];
      const tgt = colorTargets.current[part];
      if (!m || !tgt) continue;
      const c = m.color;
      const cd =
        Math.abs(c.r - tgt.r) + Math.abs(c.g - tgt.g) + Math.abs(c.b - tgt.b);
      if (cd > 0.003) {
        const k = reduce ? 1 : 1 - Math.exp((-dt * 1000) / 120);
        c.lerp(tgt, reduce ? 1 : k);
        needsRender = true;
      }
    }

    if (needsRender) invalidate();
  });

  return (
    <>
      <group rotation={[0, -0.35, 0]}>
        <primitive object={root} />
      </group>
      {/* Ombre de contact douce sous le pied (rendu produit). Rendue une fois :
          la lampe est immobile dans le monde (c'est la caméra qui orbite). */}
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

/**
 * Laisse le défilement vertical de la page passer à travers le canvas sur
 * mobile : `touch-action: pan-y` → un swipe vertical fait défiler la page,
 * un glissement horizontal fait tourner la lampe. (OrbitControls force sinon
 * `touch-action: none`, ce qui bloquerait le scroll.)
 */
function TouchScroll() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    el.style.touchAction = "pan-y";
    return () => {
      el.style.touchAction = "";
    };
  }, [gl]);
  return null;
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

export function Lamp3D({
  partVariants,
  spin,
  lampOn,
  kelvin,
  perforation = defaultPerforation,
  onCreated,
  camera = CAMERA,
  fov = FOV,
  controls = true,
}: {
  partVariants: PartVariants;
  /** Rotation automatique au repos (et boucle de rendu continue). */
  spin: boolean;
  lampOn: boolean;
  /** Température de couleur en kelvins — réglage continu (voir `lampLightConfig`). */
  kelvin: number;
  /** Géométrie des perforations de la pièce d'assemblage. */
  perforation?: PerforationShape;
  onCreated?: () => void;
  /** Cadrage caméra — permet un plan différent pour l'atelier. */
  camera?: [number, number, number];
  fov?: number;
  /** Manipulation souris/tactile (rotation). */
  controls?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: camera, fov }}
      dpr={[1, 1.8]}
      frameloop={spin ? "always" : "demand"}
      shadows={cfg.shadows}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={() => onCreated?.()}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Éclairage de studio doux (montre les matériaux sans les écraser)
          — la lampe ajoute ensuite sa propre lumière. */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[2.5, 4, 2]} intensity={1.55} />
      <directionalLight position={[-3, 1.5, -2]} intensity={0.5} color="#cdd6ff" />
      <ProceduralEnv />
      <LampModel
        partVariants={partVariants}
        lampOn={lampOn}
        kelvin={kelvin}
        perforation={perforation}
      />
      {controls && (
        <>
          <TouchScroll />
          {/* Rotation manuelle (souris + tactile), sans zoom ni panoramique,
              pour préserver le cadrage. Rotation automatique douce au repos. */}
          <OrbitControls
            makeDefault
            enablePan={false}
            enableZoom={false}
            enableDamping={spin}
            dampingFactor={0.08}
            rotateSpeed={0.6}
            autoRotate={spin}
            autoRotateSpeed={0.8}
            minPolarAngle={1.02}
            maxPolarAngle={1.72}
          />
        </>
      )}
    </Canvas>
  );
}

useGLTF.preload(LAMP_MODEL_URL);

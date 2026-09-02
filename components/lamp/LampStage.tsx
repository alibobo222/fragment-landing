"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import {
  variants,
  perforationOptions,
  type PerforationShape,
} from "@/data/product";
import { useSelection } from "@/components/SelectionProvider";
import { buttonMotion } from "@/components/ui/motion";
import type { PartVariants } from "@/components/hero/Lamp3D";

// La 3D (three.js) est chargée à la demande, hors du bundle initial.
const Lamp3D = dynamic(
  () => import("@/components/hero/Lamp3D").then((m) => m.Lamp3D),
  { ssr: false }
);

/**
 * Le canvas 3D s'étend sous les contrôles flottants (perforation + allumage,
 * plus bas) au lieu de s'arrêter au bord de la scène — sinon le câble ne peut
 * PAR CONSTRUCTION jamais passer derrière eux (mesuré : le canvas s'arrêtait
 * 6,4 px AVANT leur haut, recouvrement nul à tout angle de rotation).
 *
 * 72 px : les contrôles descendent à 56 px sous le bas de la scène
 * (-bottom-[3.5rem], inchangé — voir plus bas) ; le budget disponible avant
 * de toucher le sélecteur de configuration qui suit (mt-[5rem] = 80 px dans
 * Configurator.tsx) est donc de 80 px. 72 px laisse 16 px de marge visible
 * SOUS les contrôles (le câble y « ressort ») et 8 px de sécurité avant le
 * sélecteur — sans jamais empiéter dessus. Unique consommateur de
 * `<LampStage>` : Configurator.tsx ; cette constante n'a donc rien d'autre à
 * satisfaire.
 */
const CANVAS_EXTRA_PX = 72;

/**
 * Compense l'agrandissement vertical du canvas pour que la lampe garde EXACTEMENT
 * la même taille et la même place à l'écran (la focale seule change, ni la
 * position ni la distance de la caméra) : à focale fixe, agrandir le canvas
 * agrandirait l'objet rendu (même tranche angulaire étalée sur plus de
 * pixels). Élargir l'angle vertical dans les mêmes proportions que la
 * hauteur ajoutée annule cet effet — la démonstration :
 *   px-par-unité = hauteur / (2·tan(fov/2))  (indépendant de la distance)
 * Pour que ce ratio reste constant quand hauteur → hauteur×k, il faut
 * tan(fov/2) → tan(fov/2)×k, d'où la formule ci-dessous.
 */
function compensateFov(baseFovDeg: number, boxHeightPx: number, extraPx: number): number {
  if (boxHeightPx <= 0) return baseFovDeg;
  const k = (boxHeightPx + extraPx) / boxHeightPx;
  const baseHalfRad = (baseFovDeg * Math.PI) / 180 / 2;
  return (2 * Math.atan(k * Math.tan(baseHalfRad)) * 180) / Math.PI;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl") || c.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Scène 3D réutilisable de la lampe.
 *
 * Un SEUL contexte WebGL vit à la fois : le canvas se monte uniquement lorsque
 * la scène approche du viewport (IntersectionObserver) et se démonte lorsqu'elle
 * s'en éloigne. Le hero (chapitre 1) et l'atelier (chapitre 3) n'étant jamais
 * visibles simultanément, on ne charge jamais deux canvas lourds en même temps.
 * Le modèle GLB est mis en cache par drei (préchargé), donc aucun rechargement.
 *
 * L'état (variante, allumage, température) provient du contexte de sélection :
 * une seule source de vérité alimente le hero et l'atelier.
 */
export function LampStage({
  className = "",
  camera,
  fov,
  priority = false,
  showControls = true,
  imageSizes = "(max-width: 1024px) 92vw, 44vw",
}: {
  className?: string;
  camera?: [number, number, number];
  fov?: number;
  /** Image de repli prioritaire (LCP) — réservé au hero. */
  priority?: boolean;
  showControls?: boolean;
  imageSizes?: string;
}) {
  const { variant, lampOn, setLampOn, kelvin, perforation, setPerforation } = useSelection();
  const reduce = useReducedMotion();

  const wrapRef = useRef<HTMLDivElement>(null);
  const [use3D, setUse3D] = useState(false);
  const [active, setActive] = useState(false); // proche du viewport → monter le canvas
  const [ready3D, setReady3D] = useState(false);
  const [contextePerdu, setContextePerdu] = useState(false);
  const mentionRef = useRef<HTMLParagraphElement>(null);
  const controlesRef = useRef<HTMLDivElement>(null);
  // Le focus n'est déplacé QUE s'il était dans les contrôles qu'on retire :
  // le voler à quelqu'un qui lisait plus bas serait pire que le problème.
  const focusADeplacer = useRef(false);
  // three.js appelle forceContextLoss() quand il rend le GPU au démontage :
  // une libération VOULUE émet donc `webglcontextlost` exactement comme un
  // incident. Or ce projet démonte et remonte ses canvas au scroll — sans ce
  // marqueur, un simple aller-retour condamnait la 3D pour la session.
  //
  // Le marqueur est levé AVANT le rendu qui démonte (React applique les états
  // après ce callback) et ne retombe qu'au montage suivant, une fois le
  // nouveau contexte créé.
  const demontageVolontaire = useRef(false);
  const [tabHidden, setTabHidden] = useState(false);
  // Hauteur RÉELLE de la boîte (h-[54svh] dans Configurator.tsx — dépend du
  // viewport, y compris mobile) : mesurée pour calculer la focale compensée
  // du canvas agrandi (voir compensateFov). Mesurée avant peinture pour
  // éviter un premier cadrage non compensé.
  const [boxHeight, setBoxHeight] = useState(0);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBoxHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const currentIndex = Math.max(
    0,
    variants.findIndex((v) => v.id === variant.id)
  );

  // Fondu-enchaîné doux de la scène au changement de configuration (masque le
  // basculement de texture pendant que les couleurs interpolent côté 3D).
  const dissolve = useAnimationControls();
  const firstVarRef = useRef(true);
  useEffect(() => {
    if (firstVarRef.current) {
      firstVarRef.current = false;
      return;
    }
    if (reduce) return;
    dissolve.start({
      opacity: [0.72, 1],
      scale: [0.99, 1],
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    });
  }, [variant.id, dissolve, reduce]);

  useEffect(() => {
    setUse3D(!reduce && webglAvailable());
  }, [reduce]);

  // Pause quand l'onglet n'est plus visible.
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Le focus clavier ne doit pas tomber sur le body quand les contrôles
  // disparaissent : il rejoint la mention, qui explique justement pourquoi.
  useEffect(() => {
    if (!contextePerdu || !focusADeplacer.current) return;
    focusADeplacer.current = false;
    mentionRef.current?.focus();
  }, [contextePerdu]);

  // Monte / démonte le canvas selon la proximité du viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          demontageVolontaire.current = true;
          setReady3D(false);
          // L'échec ne survit pas à la sortie de scène : au prochain passage,
          // la 3D est retentée par le cycle de montage normal.
          setContextePerdu(false);
        }
        setActive(e.isIntersecting);
      },
      { rootMargin: "300px 0px 300px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Contexte WebGL perdu (mémoire, pilote, trop d'onglets 3D) : on démonte la
  // scène et on rend la main à la photo de repli — qui redevient visible ET
  // perd son aria-hidden, puisque les deux dépendent de `ready3D`.
  //
  // Choix ASSUMÉ de ne pas reprendre la 3D si le navigateur restaure le
  // contexte : il faudrait reconstruire des matériaux créés par scène
  // (`onBeforeCompile`), des textures procédurales et un chargement
  // asynchrone, sans garantie — un canvas à moitié reconstruit serait le même
  // écran vide, en moins détectable. Et une restauration survient justement
  // sur une machine à court de ressources : la scène se reperdrait en boucle.
  // La photo est un repli de qualité (c'est déjà le LCP) ; la 3D revient au
  // prochain chargement.
  const mount3D = use3D && active && !contextePerdu;
  const spin = !reduce && !tabHidden && active;
  // Focale compensée pour le canvas agrandi (voir CANVAS_EXTRA_PX /
  // compensateFov ci-dessus) — avant la première mesure (boxHeight===0) ou
  // si l'appelant n'a rien précisé (Lamp3D applique alors son propre repli),
  // la focale demandée est transmise telle quelle.
  const effectiveFov =
    fov !== undefined && boxHeight > 0
      ? compensateFov(fov, boxHeight, CANVAS_EXTRA_PX)
      : fov;

  const parts: PartVariants = {
    shade: currentIndex,
    connector: currentIndex,
    base: currentIndex,
    cable: currentIndex,
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Halo circulaire gris très clair derrière la lampe — profondeur discrète,
          fondu progressif dans le blanc, confiné à la scène (pas de vignettage
          de page). Le canvas est transparent : le halo transparaît autour du 3D. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          // --halo est defini par le sol du chapitre (globals.css) : sombre sur
          // les sols clairs, clair sur le noir du chapitre 03. Sans cela le halo
          // disparaissait purement et simplement sur fond noir.
          background: "radial-gradient(circle at 50% 55%, var(--halo, rgb(41 37 31 / 0.07)) 0%, transparent 62%)",
        }}
      />
      {/* Repli photo : LCP immédiat + secours (pas de WebGL / reduced-motion). */}
      {variants.map((v, i) => (
        <Image
          key={v.id}
          src={v.image}
          alt={v.alt}
          fill
          sizes={imageSizes}
          priority={priority && i === 0}
          className={`object-contain p-3 ${
            reduce ? "" : "transition-opacity duration-700 ease-out"
          } ${i === currentIndex && !ready3D ? "opacity-100" : "opacity-0"}`}
          aria-hidden={i !== currentIndex || ready3D}
        />
      ))}

      {/* Reproduction 3D fidèle (CAO → GLB), interactive (rotation souris/tactile).
          ⚠️ S'étend à -bottom-[72px] (CANVAS_EXTRA_PX) — PAS inset-0 : le
          canvas doit couvrir la zone des contrôles flottants plus bas pour
          que le câble puisse passer visiblement derrière eux (voir le
          commentaire de CANVAS_EXTRA_PX). La boîte de référence (wrapRef,
          la position des contrôles, le cadrage de l'image de repli) ne
          change pas — seule l'étendue du RENDU grandit ; `effectiveFov`
          compense pour que la lampe garde exactement la même taille. */}
      {mount3D && (
        <div
          className={`absolute inset-x-0 top-0 -bottom-[72px] transition-opacity duration-700 ${
            ready3D ? "opacity-100" : "opacity-0"
          }`}
        >
          <motion.div animate={dissolve} className="h-full w-full" style={{ transformOrigin: "center" }}>
            <Lamp3D
              partVariants={parts}
              spin={spin}
              lampOn={lampOn}
              kelvin={kelvin}
              perforation={perforation}
              camera={camera}
              fov={effectiveFov}
              onCreated={() => {
                demontageVolontaire.current = false;
                setReady3D(true);
              }}
              onContextLost={() => {
                // Libération voulue (sortie de viewport) : rien à rattraper.
                if (demontageVolontaire.current) return;
                // Lu AVANT le rendu qui démonte les contrôles, sinon
                // document.activeElement est déjà retombé sur le body.
                focusADeplacer.current =
                  controlesRef.current?.contains(document.activeElement) ?? false;
                setReady3D(false);
                setContextePerdu(true);
              }}
            />
          </motion.div>
        </div>
      )}

      {/* RÉGION VIVE PERMANENTE — rendue dès le premier affichage, vide tant que
          tout va bien. Elle ne doit PAS apparaître en même temps que son texte :
          plusieurs lecteurs d'écran n'annoncent que les mutations d'une région
          déjà observée, et un conteneur inséré avec son contenu passe à la
          trappe. Vide elle n'a aucune hauteur et, étant hors-flux, ne déplace
          rien ; surtout, pas de `display:none`, qui la sortirait de l'arbre
          d'accessibilité et ferait retomber le problème.

          tabIndex={-1} : cible de repli pour le focus clavier (voir l'effet
          plus haut), sans jamais entrer dans l'ordre de tabulation. */}
      {showControls && use3D && (
        <p
          ref={mentionRef}
          role="status"
          tabIndex={-1}
          className="absolute -bottom-6 left-[1.4rem] right-[1.4rem] z-10 text-center text-sm leading-snug text-ink-muted"
        >
          {contextePerdu
            ? "Vue interactive interrompue. Rechargez la page pour la retrouver."
            : ""}
        </p>
      )}

      {/* Contrôles d'éclairage — plats, nets, sans verre ni ombre.
          Retirés — pas désactivés — quand le contexte est perdu :
          perforation et allumage n'agissent QUE sur la scène 3D, aucun des deux
          ne change la photo de repli. Un bouton grisé promettrait un retour qui
          n'aura lieu qu'au rechargement. Le choix de configuration, lui, reste :
          il change la variante, donc la photo. */}
      {showControls && use3D && !contextePerdu && (
        <div
          ref={controlesRef}
          // Les contrôles SORTENT du cadre de la scène : posés en dessous, sur
          // le blanc, plutôt qu'en surimpression sur la lampe. Ils empiétaient
          // sur le produit — et sur un configurateur, c'est l'objet qui doit
          // occuper l'image, pas l'outillage. Rien ne les découpe puisque la
          // scène n'a plus d'`overflow-hidden` ; l'espace qu'ils prennent est
          // réservé sous la scène, donc la lampe ne change pas de taille.
          //
          // ⚠️ COUPLAGE : cette hauteur hors-flux (`-bottom-`) doit rester
          // égale au `mt-` compensatoire du sélecteur dans Configurator/
          // VariantPicker — aucun des deux ne connaît l'autre. Toucher l'une
          // sans l'autre laisse un trou ou fait chevaucher les vignettes.
          className={`absolute -bottom-[3.5rem] left-[1.4rem] right-[1.4rem] z-10 flex flex-col gap-2.5 transition-opacity duration-300 ${
            ready3D ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <PerforationControl value={perforation} onSelect={setPerforation} />
            <LampPowerButton on={lampOn} onToggle={() => setLampOn(!lampOn)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Contrôles d'éclairage — famille « verre » premium, accessibles --- */

/** Bouton icône « verre » pour allumer / éteindre la lampe 3D. */
function LampPowerButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const label = on ? "Éteindre la lampe" : "Allumer la lampe";
  return (
    <motion.button
      type="button"
      {...buttonMotion}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={on}
      title={label}
      data-active={on}
      className="btn-glass btn-glass-icon btn-glass-icon-opaque inline-flex h-11 w-11 items-center justify-center"
    >
      <BulbIcon on={on} />
    </motion.button>
  );
}

/**
 * Sélecteur de PERFORATION — contrôle segmenté « verre », ronde / carrée / aucune.
 *
 * Même famille visuelle que les autres contrôles « verre » : aucun panneau,
 * aucune carte, trois pictogrammes sobres qui montrent la forme du poinçon
 * plutôt que de la nommer. Le nom reste disponible pour les technologies
 * d'assistance.
 */
function PerforationControl({
  value,
  onSelect,
}: {
  value: PerforationShape;
  onSelect: (shape: PerforationShape) => void;
}) {
  return (
    <div role="group" aria-label="Perforation de l'assemblage" className="btn-glass-group btn-glass-group-opaque">
      {perforationOptions.map((o) => (
        <TempOption
          key={o.value}
          active={value === o.value}
          onClick={() => onSelect(o.value)}
          label={`Perforation ${o.label.toLowerCase()}`}
          icon={<PerforationIcon shape={o.value} />}
        />
      ))}
    </div>
  );
}

/** Pictogrammes : un cercle, un carré, une surface pleine. */
function PerforationIcon({ shape }: { shape: PerforationShape }) {
  const common = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    stroke: "currentColor",
    strokeWidth: 1.7,
    "aria-hidden": true as const,
  };
  if (shape === "round")
    return (
      <svg {...common} fill="none">
        <circle cx="12" cy="12" r="6.5" />
      </svg>
    );
  if (shape === "square")
    return (
      <svg {...common} fill="none">
        <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" />
      </svg>
    );
  return (
    <svg {...common} fill="currentColor" fillOpacity={0.5}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="1.5" />
    </svg>
  );
}

function TempOption({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      {...buttonMotion}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      data-active={active}
      className="btn-glass-segment inline-flex h-10 w-10 items-center justify-center"
    >
      {icon}
    </motion.button>
  );
}

function BulbIcon({ on }: { on: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="transition-colors duration-300"
    >
      <path d="M9.5 18h5" />
      <path d="M10 21h4" />
      <path
        d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.2 1.1 2.4h5.8c.1-1.2.4-1.8 1.1-2.4A6.5 6.5 0 0 0 12 2.5Z"
        fill={on ? "currentColor" : "none"}
        fillOpacity={on ? 0.2 : 0}
        className="transition-[fill-opacity] duration-300"
      />
    </svg>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { variants } from "@/data/product";
import { useSelection } from "@/components/SelectionProvider";
import { tapProps } from "@/components/ui/motion";
import type { PartVariants } from "@/components/hero/Lamp3D";

// La 3D (three.js) est chargée à la demande, hors du bundle initial.
const Lamp3D = dynamic(
  () => import("@/components/hero/Lamp3D").then((m) => m.Lamp3D),
  { ssr: false }
);

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
  const { variant, lampOn, setLampOn, warm, setWarm } = useSelection();
  const reduce = useReducedMotion();

  const wrapRef = useRef<HTMLDivElement>(null);
  const [use3D, setUse3D] = useState(false);
  const [active, setActive] = useState(false); // proche du viewport → monter le canvas
  const [ready3D, setReady3D] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

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

  // Monte / démonte le canvas selon la proximité du viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        setActive(e.isIntersecting);
        if (!e.isIntersecting) setReady3D(false);
      },
      { rootMargin: "300px 0px 300px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const mount3D = use3D && active;
  const spin = !reduce && !tabHidden && active;

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
          background:
            "radial-gradient(circle at 50% 55%, rgba(20,20,28,0.07) 0%, rgba(20,20,28,0.03) 32%, rgba(20,20,28,0) 60%)",
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

      {/* Reproduction 3D fidèle (CAO → GLB), interactive (rotation souris/tactile). */}
      {mount3D && (
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            ready3D ? "opacity-100" : "opacity-0"
          }`}
        >
          <motion.div animate={dissolve} className="h-full w-full" style={{ transformOrigin: "center" }}>
            <Lamp3D
              partVariants={parts}
              spin={spin}
              lampOn={lampOn}
              warm={warm}
              camera={camera}
              fov={fov}
              onCreated={() => setReady3D(true)}
            />
          </motion.div>
        </div>
      )}

      {/* Contrôles d'éclairage — plats, nets, sans verre ni ombre. */}
      {showControls && use3D && (
        <div
          className={`absolute bottom-3 right-3 z-10 flex items-center gap-2 transition-opacity duration-300 sm:bottom-4 sm:right-4 ${
            ready3D ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <LightTempControl warm={warm} onSelect={setWarm} />
          <LampPowerButton on={lampOn} onToggle={() => setLampOn(!lampOn)} />
        </div>
      )}
    </div>
  );
}

/* --- Contrôles d'éclairage (plats, carrés, accessibles) --- */

/** Bouton plat pour allumer / éteindre la lampe 3D. */
function LampPowerButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const label = on ? "Éteindre la lampe" : "Allumer la lampe";
  return (
    <motion.button
      type="button"
      {...tapProps}
      onClick={onToggle}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center border transition-[background-color,color,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-1 focus-visible:ring-offset-paper ${
        on
          ? "border-ink bg-ink text-paper"
          : "border-ink/25 bg-paper-pure text-ink-muted hover:border-ink hover:text-ink"
      }`}
    >
      <BulbIcon on={on} />
    </motion.button>
  );
}

/** Sélecteur de température de lumière (plat) : chaude / froide. */
function LightTempControl({
  warm,
  onSelect,
}: {
  warm: boolean;
  onSelect: (warm: boolean) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Température de lumière"
      className="inline-flex items-center border border-ink/25 bg-paper-pure"
    >
      <TempOption active={warm} onClick={() => onSelect(true)} label="Lumière chaude" icon={<SunIcon />} />
      <span aria-hidden className="h-6 w-px bg-ink/15" />
      <TempOption active={!warm} onClick={() => onSelect(false)} label="Lumière froide" icon={<SnowIcon />} />
    </div>
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
      {...tapProps}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${
        active ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"
      }`}
    >
      {icon}
    </motion.button>
  );
}

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}

function SnowIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v20M2.7 6.8l18.6 10.4M21.3 6.8 2.7 17.2" />
      <path d="M12 6.5 9.6 4.9M12 6.5l2.4-1.6M12 17.5l-2.4 1.6M12 17.5l2.4 1.6" />
    </svg>
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

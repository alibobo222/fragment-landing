"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { variants, partOrder, partLabels, type PartKey } from "@/data/product";
import { useSelection } from "@/components/SelectionProvider";
import { track } from "@/lib/analytics";
import { scrollToId } from "@/lib/scroll";
import { Button } from "@/components/ui/Button";
import { AccentText } from "@/components/ui/AccentText";
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

const HOLD_MS = 2400; // pause sur une combinaison complète
const STAGGER = { shade: 0, assembly: 240, base: 480 } as const;

export function Hero() {
  const { select, selectedId } = useSelection();
  const reduce = useReducedMotion();

  // Index affiché par composant (permet le décalage temporel).
  const [shadeIdx, setShadeIdx] = useState(0);
  const [asmIdx, setAsmIdx] = useState(0);
  const [baseIdx, setBaseIdx] = useState(0);
  const [labelIdx, setLabelIdx] = useState(0);

  const [userPaused, setUserPaused] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [manual, setManual] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  // État lumineux de la lampe 3D — allumée par défaut.
  const [lampOn, setLampOn] = useState(true);
  // Température de lumière — chaude (~2700 K) par défaut.
  const [warm, setWarm] = useState(true);

  const cycleRef = useRef(0);

  const running = !reduce && !manual && !userPaused && !hidden && preview === null;

  // Pause quand l'onglet n'est plus visible.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Synchronise le hero avec une sélection faite ailleurs (configurateur) :
  // affiche cette variante et suspend la boucle. (On ignore la valeur initiale.)
  const firstSelRef = useRef(true);
  useEffect(() => {
    if (firstSelRef.current) {
      firstSelRef.current = false;
      return;
    }
    const idx = variants.findIndex((v) => v.id === selectedId);
    if (idx < 0) return;
    setManual(true);
    setPreview(null);
    cycleRef.current = idx;
    setShadeIdx(idx);
    setAsmIdx(idx);
    setBaseIdx(idx);
    setLabelIdx(idx);
  }, [selectedId]);

  // Boucle automatique décalée entre les trois composants.
  useEffect(() => {
    if (!running) return;
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const step = () => {
      const next = (cycleRef.current + 1) % variants.length;
      cycleRef.current = next;
      setShadeIdx(next);
      timers.push(setTimeout(() => alive && setAsmIdx(next), STAGGER.assembly));
      timers.push(setTimeout(() => alive && setBaseIdx(next), STAGGER.base));
      timers.push(setTimeout(() => alive && setLabelIdx(next), STAGGER.base + 60));
      timers.push(
        setTimeout(() => {
          if (alive) step();
        }, STAGGER.base + HOLD_MS)
      );
    };

    timers.push(setTimeout(step, HOLD_MS));
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [running]);

  const displayShade = preview ?? shadeIdx;
  const displayAsm = preview ?? asmIdx;
  const displayBase = preview ?? baseIdx;
  const displayLabel = preview ?? labelIdx;
  const current = variants[displayLabel];

  // Diffuse la couleur dominante du modèle affiché à toute la page, au rythme
  // du hero. Les éléments d'accent (titres, boutons...) consomment var(--accent).
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", current.accent);
    root.setProperty("--accent-on-dark", current.accentOnDark);
  }, [current.accent, current.accentOnDark]);

  const partIndex: Record<PartKey, number> = {
    shade: displayShade,
    assembly: displayAsm,
    base: displayBase,
  };

  const applyManual = useCallback(
    (idx: number) => {
      setManual(true);
      setPreview(null);
      cycleRef.current = idx;
      setShadeIdx(idx);
      setAsmIdx(idx);
      setBaseIdx(idx);
      setLabelIdx(idx);
      select(variants[idx].id, { from: "hero" });
    },
    [select]
  );

  const togglePlay = () => {
    if (running) {
      setUserPaused(true);
    } else {
      setUserPaused(false);
      setManual(false);
    }
  };

  const handlePrimary = () => {
    select(current.id, { from: "hero", silent: true });
    track("hero_cta_click", { variant: current.id });
    scrollToId("configurateur");
  };

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative overflow-hidden pt-2 pb-16 sm:pb-24"
    >
      <div className="u-container grid items-center gap-5 sm:gap-8 lg:grid-cols-[1.02fr_1fr] lg:gap-12">
        {/* Colonne éditoriale */}
        <div className="order-2 lg:order-1">
          <p className="u-eyebrow">Édition composable · Pièce d&apos;atelier</p>
          <h1
            id="hero-title"
            className="u-fluid-display mt-4 font-display uppercase text-ink"
          >
            La lumière{" "}
            <br />
            prend <AccentText>position.</AccentText>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft sm:mt-6 sm:text-lg">
            Une forme brutaliste en trois volumes. À vous d&apos;en choisir les
            matières.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
            <Button onClick={handlePrimary} aria-describedby="hero-config-label">
              Personnaliser ma lampe
            </Button>
            <Button
              variant="secondary"
              onClick={() => scrollToId("matieres")}
            >
              Explorer les matières
            </Button>
          </div>

          {/* Indicateur de composition à trois parties */}
          <div className="mt-10 max-w-md">
            <div className="flex items-center justify-between">
              <span className="u-eyebrow">La composition</span>
              <PlayControl running={running} onToggle={togglePlay} />
            </div>
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {partOrder.map((part) => {
                const finish = variants[partIndex[part]][part];
                return (
                  <li
                    key={part}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <span
                      aria-hidden
                      className="h-5 w-5 shrink-0 border border-ink/15 transition-colors duration-500"
                      style={{ backgroundColor: finish.color }}
                    />
                    <span className="w-24 shrink-0 text-xs uppercase tracking-wider text-ink-muted">
                      {partLabels[part]}
                    </span>
                    <span className="text-sm text-ink transition-colors duration-500">
                      {finish.label}
                    </span>
                  </li>
                );
              })}
            </ul>

            <p
              id="hero-config-label"
              aria-live="polite"
              className="mt-3 text-sm text-ink-soft"
            >
              <span className="font-display text-ink">
                Configuration {current.index}
              </span>{" "}
              — {current.materialsSummary}
            </p>

            {/* Sélecteur rapide de variantes (aussi utilisable sans animation) */}
            <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Aperçu des configurations">
              {variants.map((v, i) => {
                const active = i === displayLabel;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onMouseEnter={() => !manual && setPreview(i)}
                    onMouseLeave={() => setPreview(null)}
                    onFocus={() => !manual && setPreview(i)}
                    onBlur={() => setPreview(null)}
                    onClick={() => applyManual(i)}
                    aria-pressed={active}
                    aria-label={`Configuration ${v.index} : ${v.materialsSummary}`}
                    className={`flex h-9 w-9 items-center justify-center rounded-none border text-xs font-semibold transition-colors ${
                      active
                        ? "u-accent-bg border-transparent text-white"
                        : "border-line text-ink-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    {v.index}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Colonne visuelle */}
        <div className="order-1 lg:order-2">
          <HeroVisual
            currentIndex={displayLabel}
            reduce={!!reduce}
            parts={{
              shade: displayShade,
              connector: displayAsm,
              base: displayBase,
              cable: displayLabel,
            }}
            spin={!reduce && !hidden}
            lampOn={lampOn}
            onToggleLamp={() => setLampOn((v) => !v)}
            warm={warm}
            onSelectTemp={setWarm}
          />
        </div>
      </div>

      <ScrollHint />
    </section>
  );
}

/* --- Sous-composants --- */

function HeroVisual({
  currentIndex,
  reduce,
  parts,
  spin,
  lampOn,
  onToggleLamp,
  warm,
  onSelectTemp,
}: {
  currentIndex: number;
  reduce: boolean;
  parts: PartVariants;
  spin: boolean;
  lampOn: boolean;
  onToggleLamp: () => void;
  warm: boolean;
  onSelectTemp: (warm: boolean) => void;
}) {
  const [use3D, setUse3D] = useState(false);
  const [ready3D, setReady3D] = useState(false);

  useEffect(() => {
    // 3D uniquement si WebGL disponible ET mouvement non réduit.
    setUse3D(!reduce && webglAvailable());
  }, [reduce]);

  return (
    <figure className="relative mx-auto w-full max-w-[18rem] sm:max-w-[33rem] lg:max-w-[42rem]">
      {/* Panneau principal — sans fond dès que la 3D est affichée. */}
      <div
        className={`relative aspect-[780/689] w-full overflow-hidden rounded-sm transition-[background-color] duration-500 ${
          ready3D ? "" : "bg-paper-pure ring-1 ring-line"
        }`}
      >
        {/* Repli photo : LCP immédiat + secours (pas de WebGL / reduced-motion). */}
        {variants.map((v, i) => (
          <Image
            key={v.id}
            src={v.image}
            alt={v.alt}
            fill
            sizes="(max-width: 1024px) 92vw, 44vw"
            priority={i === 0}
            className={`object-contain p-3 ${
              reduce ? "" : "transition-opacity duration-700 ease-out"
            } ${i === currentIndex && !ready3D ? "opacity-100" : "opacity-0"}`}
            aria-hidden={i !== currentIndex || ready3D}
          />
        ))}

        {/* Reproduction 3D fidèle (CAO → GLB). */}
        {use3D && (
          <div
            aria-hidden
            className={`absolute inset-0 transition-opacity duration-700 ${
              ready3D ? "opacity-100" : "opacity-0"
            }`}
          >
            <Lamp3D
              partVariants={parts}
              spin={spin}
              lampOn={lampOn}
              warm={warm}
              onCreated={() => setReady3D(true)}
            />
          </div>
        )}

        {/* Contrôles d'éclairage — plats, nets, sans verre ni ombre. */}
        {use3D && (
          <div
            className={`absolute bottom-4 right-4 z-10 flex items-center gap-2 transition-opacity duration-300 ${
              ready3D ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <LightTempControl warm={warm} onSelect={onSelectTemp} />
            <LampPowerButton on={lampOn} onToggle={onToggleLamp} />
          </div>
        )}
      </div>

      <figcaption className="sr-only">
        Lampe Noir Minéral présentée sous plusieurs angles, avec aperçu des matières
        composables.
      </figcaption>
    </figure>
  );
}

/** Bouton plat (carré, filet d'encre) pour allumer / éteindre la lampe 3D. */
function LampPowerButton({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
  const label = on ? "Éteindre la lampe" : "Allumer la lampe";
  return (
    <button
      type="button"
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
    </button>
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
      <TempOption
        active={warm}
        onClick={() => onSelect(true)}
        label="Lumière chaude"
        emoji="🌞"
      />
      <span aria-hidden className="h-6 w-px bg-ink/15" />
      <TempOption
        active={!warm}
        onClick={() => onSelect(false)}
        label="Lumière froide"
        emoji="❄️"
      />
    </div>
  );
}

function TempOption({
  active,
  onClick,
  label,
  emoji,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center text-base leading-none transition-[background-color,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink ${
        active ? "bg-ink" : "opacity-55 hover:bg-ink/8 hover:opacity-100"
      }`}
    >
      <span aria-hidden>{emoji}</span>
    </button>
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
      {/* Culot */}
      <path d="M9.5 18h5" />
      <path d="M10 21h4" />
      {/* Verre de l'ampoule (rempli d'une teinte d'accent quand allumée) */}
      <path
        d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.7.6 1 1.2 1.1 2.4h5.8c.1-1.2.4-1.8 1.1-2.4A6.5 6.5 0 0 0 12 2.5Z"
        fill={on ? "currentColor" : "none"}
        fillOpacity={on ? 0.2 : 0}
        className="transition-[fill-opacity] duration-300"
      />
    </svg>
  );
}

function PlayControl({
  running,
  onToggle,
}: {
  running: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
      aria-pressed={!running}
    >
      <span aria-hidden className="text-[0.7rem]">
        {running ? "❙❙" : "▶"}
      </span>
      {running ? "Mettre en pause" : "Lecture"}
    </button>
  );
}

function ScrollHint() {
  return (
    <div
      aria-hidden
      className="u-container mt-10 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ink-muted"
    >
      <span className="hero-scroll-line inline-block h-8 w-px bg-ink-muted/50" />
      Faire défiler
    </div>
  );
}

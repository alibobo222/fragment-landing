"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useSelection } from "@/components/SelectionProvider";
import { variants } from "@/data/product";
import { RevealImage } from "@/components/ui/motion";
import { ExplodedAnnotations } from "@/components/chapters/ExplodedAnnotations";
import type { PartVariants } from "@/components/hero/Lamp3D";
import type { AnchorMap } from "@/components/hero/ExplodedLamp3D";

// Scène 3D chargée à la demande (hors bundle initial).
const ExplodedLamp3D = dynamic(
  () => import("@/components/hero/ExplodedLamp3D").then((m) => m.ExplodedLamp3D),
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

const SIZES = "(max-width: 480px) 100vw, 480px";

/** Illustration statique d'origine (repli : pas de WebGL / reduced-motion). */
function StaticEclate() {
  return (
    <figure className="u-container">
      <RevealImage
        className="u-bleed"
        src="/images/chapter2/eclate.webp"
        alt="Vue éclatée : peu de composants — abat-jour, grille pliée, douille, pied — et un montage lisible."
        ratio="aspect-square"
        sizes={SIZES}
        imgClassName="object-cover"
        unoptimized
        y={18}
        zoom={1.03}
      />
    </figure>
  );
}

/**
 * Piste de désassemblage 3D (« pin & scrub »). Montée UNIQUEMENT quand la 3D est
 * disponible : son `trackRef` existe donc dès le premier rendu, ce qui permet à
 * `useScroll({ target })` de se caler sur la plage d'épinglage de la section
 * (et non sur le scroll global de la page).
 */
function ExplodedScrollTrack() {
  const { variant, lampOn, warm } = useSelection();
  const reduce = useReducedMotion();

  const trackRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const progressRef = useRef(0);
  const anchorsRef = useRef<AnchorMap | null>(null);
  // Le titre de chapitre (SectionHeading) est LUI AUSSI épinglé (sticky top-14,
  // z-20, fond blanc opaque) et reste visible pendant toute la traversée de la
  // section — y compris pendant la piste éclatée. Le badge d'action doit donc
  // démarrer SOUS ce panneau, jamais à une hauteur fixe devinée : on mesure sa
  // hauteur réelle (robuste aux changements de texte/police/largeur).
  const [badgeTop, setBadgeTop] = useState(80);
  useEffect(() => {
    const measure = () => {
      const heading = trackRef.current
        ?.closest("section")
        ?.querySelector<HTMLElement>(":scope > div.sticky");
      if (heading) setBadgeTop(heading.getBoundingClientRect().height + 12);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const currentIndex = Math.max(
    0,
    variants.findIndex((v) => v.id === variant.id)
  );
  const parts: PartVariants = {
    shade: currentIndex,
    connector: currentIndex,
    base: currentIndex,
    cable: currentIndex,
  };

  // Progression de désassemblage = position dans la piste (0 en haut → 1 en bas).
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progressRef.current = v;
  });
  const hintOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  // Monte / démonte le canvas selon la proximité du viewport (un seul contexte
  // WebGL lourd à la fois).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        setMounted(e.isIntersecting);
        if (!e.isIntersecting) setReady(false);
      },
      { rootMargin: "300px 0px 300px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={trackRef} className="relative" style={{ height: "220svh" }}>
      <div className="sticky top-14 h-[calc(100svh-3.5rem)] overflow-hidden">
        {/* Halo circulaire gris très clair derrière la lampe (profondeur douce). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 52%, rgba(20,20,28,0.07) 0%, rgba(20,20,28,0.03) 32%, rgba(20,20,28,0) 60%)",
          }}
        />

        {mounted && (
          <div
            className={`absolute inset-0 transition-opacity duration-700 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          >
            <ExplodedLamp3D
              partVariants={parts}
              lampOn={lampOn}
              warm={warm}
              progressRef={progressRef}
              active={mounted}
              onCreated={() => setReady(true)}
              anchorsRef={anchorsRef}
            />
          </div>
        )}

        {/* Couche d'annotations « planche de croquis » — apparaît en fin d'éclaté,
            ancrée sur la projection 2D réelle des pièces (au-dessus du canvas). */}
        {mounted && (
          <ExplodedAnnotations
            scrollYProgress={scrollYProgress}
            anchorsRef={anchorsRef}
            reduce={!!reduce}
          />
        )}

        {/* Étiquette d'action (haut gauche) — badge « verre », persiste tout au
            long de la piste (contrairement à l'invite du bas, qui s'efface dès
            le début du scroll) : signale que la vue répond au scroll. Positionné
            SOUS le titre de chapitre sticky (mesuré dynamiquement, voir plus haut) :
            celui-ci reste épinglé par-dessus toute la section, opaque. */}
        <div
          className="pointer-events-none absolute left-[1.4rem]"
          style={{ top: badgeTop }}
        >
          <div className="btn-glass btn-glass-secondary inline-flex items-center gap-1.5 px-3 py-1.5">
            <span className="u-index text-xs text-ink-muted">Vue éclatée</span>
            <motion.svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-ink-muted"
              aria-hidden
              animate={reduce ? undefined : { y: [0, 3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <path d="M12 5v14M6 13l6 6 6-6" />
            </motion.svg>
          </div>
        </div>

        {/* Invite au scroll — s'efface dès le début du désassemblage. */}
        <motion.div
          style={{ opacity: reduce ? 0 : hintOpacity }}
          className="pointer-events-none absolute inset-x-0 bottom-7 flex flex-col items-center gap-2"
        >
          <span className="u-eyebrow text-ink-muted">Défilez pour désassembler</span>
          <motion.svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-ink-muted"
            aria-hidden
            animate={reduce ? undefined : { y: [0, 4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M12 5v14M6 13l6 6 6-6" />
          </motion.svg>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Vue éclatée 3D pilotée par le scroll, au même emplacement du feed (après
 * « Simple à fabriquer »). Décide entre l'expérience 3D et le repli statique,
 * puis délègue le rendu de la piste à un sous-composant (pour un `useScroll`
 * correctement calé sur la section).
 */
export function ExplodedLampSection() {
  const reduce = useReducedMotion();
  // null = pas encore décidé (SSR / 1er rendu) → repli statique en attendant.
  const [use3D, setUse3D] = useState<boolean | null>(null);

  useEffect(() => {
    setUse3D(!reduce && webglAvailable());
  }, [reduce]);

  if (use3D !== true) return <StaticEclate />;
  return <ExplodedScrollTrack />;
}

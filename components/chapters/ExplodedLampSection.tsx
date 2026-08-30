"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
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
import {
  EXPLODED_TIMELINE as T,
  phaseProgress,
} from "@/components/chapters/explodedTimeline";
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

/**
 * Marge basse (px) réservée SOUS la scène 3D, pour le cartouche de planche.
 * Avec `STAGE_TOP` en haut, elle définit la « fenêtre de scène ».
 *
 * ⚠️ C'est le premier réglage à toucher pour agrandir ou réduire l'éclaté :
 * la fenêtre gagne directement ce que cette marge perd. Le second réglage est
 * la distance de caméra dans `ExplodedLamp3D` (constante `CAMERA`).
 */
const STAGE_BOTTOM = 30;

/**
 * Marge haute (px) de la fenêtre de scène.
 *
 * Elle valait auparavant la hauteur RÉELLE du titre de chapitre épinglé (~110 px),
 * qu'il fallait contourner puisqu'il reste collé en haut d'écran, opaque, pendant
 * toute la traversée de la section. C'était la plus grosse réserve de place du
 * dispositif — confisquée en permanence à la planche technique.
 *
 * La piste éclatée passe désormais AU-DESSUS de ce titre (z-30 + fond blanc) tant
 * qu'elle est épinglée : pendant la vue éclatée, l'écran entier sous l'en-tête du
 * site appartient à la scène ; le titre réapparaît dès que l'épinglage se relâche.
 * D'où cette simple marge de respiration.
 */
const STAGE_TOP = 18;

/** Illustration statique d'origine (repli : pas de WebGL / reduced-motion). */
function StaticEclate({ conteneurRef }: { conteneurRef?: RefObject<HTMLElement | null> }) {
  return (
    <figure ref={conteneurRef} className="u-container">
      <RevealImage
        className="u-bleed"
        src="/images/chapter2/eclate.webp"
        alt="Vue éclatée : peu de composants — abat-jour, grille pliée, douille, pied — et un montage lisible."
        ratio="aspect-square"
        sizes={SIZES}
        imgClassName="object-cover"
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
 *
 * ⚠️ La scène est découpée en ACTES — voir `explodedTimeline.ts`. Le
 * désassemblage ne consomme plus toute la piste : il s'achève à 44 %, les
 * annotations se tracent ensuite sur scène immobile, puis vient un long palier
 * de lecture où plus rien ne bouge. Le fondu de sortie n'intervient qu'après.
 */
function ExplodedScrollTrack({ onContextLost }: { onContextLost: () => void }) {
  const { variant, lampOn, kelvin, perforation } = useSelection();
  const reduce = useReducedMotion();

  const trackRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  // 0 = désassemblage en cours, 1 = nomenclature (tracé puis lecture).
  const [act, setAct] = useState<0 | 1>(0);
  // three.js appelle forceContextLoss() quand il rend le GPU au démontage :
  // une libération VOULUE émet donc `webglcontextlost` exactement comme un
  // incident. Or ce projet démonte et remonte ses canvas au scroll — sans ce
  // marqueur, un simple aller-retour condamnait la 3D pour la session.
  //
  // Le marqueur est levé AVANT le rendu qui démonte (React applique les états
  // après ce callback) et ne retombe qu'au montage suivant, une fois le
  // nouveau contexte créé.
  const demontageVolontaire = useRef(false);
  const progressRef = useRef(0);
  const anchorsRef = useRef<AnchorMap | null>(null);

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

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });

  // La progression 3D n'est PAS la progression de scroll : elle est remappée sur
  // le seul acte de désassemblage. Passé 0.44, elle vaut 1 et les pièces restent
  // parfaitement immobiles pendant que la nomenclature s'écrit et se lit.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    progressRef.current = phaseProgress(v, T.explodeStart, T.explodeEnd);
    const nextAct: 0 | 1 = v >= T.annoStart - 0.04 ? 1 : 0;
    setAct((prev) => (prev === nextAct ? prev : nextAct));
  });

  const hintOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);
  // ⚠️ Aucun fondu de sortie — voir `explodedTimeline.ts`. Il existait pour
  // masquer une tranche disgracieuse au relâchement de l'épinglage, causée par
  // le titre de chapitre épinglé PAR-DESSUS la scène. Ce titre passant désormais
  // DESSOUS (la planche est en z-30), le relâchement est propre : la scène
  // défile simplement vers le haut et le chapitre suivant enchaîne. Le fondu ne
  // servait donc plus à rien, sinon à réserver un écran entier de blanc.
  // Jauge de progression de la piste (2 segments : désassemblage / nomenclature).
  const act1Scale = useTransform(
    scrollYProgress,
    [T.explodeStart, T.explodeEnd],
    [0, 1]
  );
  const act2Scale = useTransform(
    scrollYProgress,
    [T.annoStart, T.annoEnd],
    [0, 1]
  );
  // Cartouche de planche : apparaît une fois les flèches lancées, disparaît
  // avec la scène. Il porte l'argument du chapitre (« peu de composants ») et
  // rattache la planche à la configuration réellement affichée.
  const cartoucheOpacity = useTransform(
    scrollYProgress,
    [T.annoStart, T.annoStart + 0.06],
    [0, 1]
  );

  // Monte / démonte le canvas selon la proximité du viewport (un seul contexte
  // WebGL lourd à la fois).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) {
          demontageVolontaire.current = true;
          setReady(false);
        }
        setMounted(e.isIntersecting);
      },
      { rootMargin: "300px 0px 300px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Pause quand l'onglet n'est plus visible — même garde-fou que LampStage.
  useEffect(() => {
    const onVis = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div ref={trackRef} className="relative" style={{ height: "360svh" }}>
      {/* z-30 + fond blanc : la planche passe PAR-DESSUS le titre de chapitre
          (z-20) tant qu'elle est épinglée, et récupère ainsi toute la hauteur
          d'écran. Elle reste sous l'en-tête du site (z-40), qui doit rester
          atteignable. */}
      <div className="sticky top-14 z-30 h-[calc(100svh-3.5rem)] overflow-hidden bg-white">
        {/* Halo circulaire gris très clair derrière la lampe (profondeur douce). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0"
          style={{
            top: STAGE_TOP,
            bottom: STAGE_BOTTOM,
            background:
              "radial-gradient(circle at 50% 50%, rgba(20,20,28,0.07) 0%, rgba(20,20,28,0.03) 32%, rgba(20,20,28,0) 60%)",
          }}
        />

        {mounted && (
          <div
            className={`absolute inset-x-0 transition-opacity duration-700 ${
              ready ? "opacity-100" : "opacity-0"
            }`}
            style={{ top: STAGE_TOP, bottom: STAGE_BOTTOM }}
          >
            <ExplodedLamp3D
              partVariants={parts}
              lampOn={lampOn}
              kelvin={kelvin}
              perforation={perforation}
              progressRef={progressRef}
              active={mounted && !tabHidden}
              onCreated={() => {
                demontageVolontaire.current = false;
                setReady(true);
              }}
              onContextLost={() => {
                // Libération voulue (sortie de viewport) : rien à rattraper.
                if (demontageVolontaire.current) return;
                onContextLost();
              }}
              anchorsRef={anchorsRef}
            />
          </div>
        )}

        {/* Couche d'annotations « planche de croquis » — se trace sur scène
            immobile (acte 2), puis reste lisible tout le palier (acte 3). */}
        {mounted && (
          <ExplodedAnnotations
            scrollYProgress={scrollYProgress}
            anchorsRef={anchorsRef}
            reduce={!!reduce}
            safeTop={STAGE_TOP}
            stageBottom={STAGE_BOTTOM}
            variant={variant}
          />
        )}

        {/* Étiquette d'acte (haut gauche) — badge « verre » qui NOMME l'étape en
            cours et montre l'avancement dans la piste. Il occupe le coin que le
            titre de chapitre libère pendant l'épinglage. */}
        <div
          className="pointer-events-none absolute left-[1.4rem]"
          style={{ top: STAGE_TOP }}
        >
          <div className="btn-glass btn-glass-secondary inline-flex flex-col gap-1.5 px-3 py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="u-index text-xs text-ink-muted">
                {act === 0 ? "Désassemblage" : "Nomenclature"}
              </span>
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
            {/* Jauge en deux segments : où en est-on dans la scène. */}
            <div aria-hidden className="flex gap-1">
              {[act1Scale, act2Scale].map((scale, i) => (
                <span key={i} className="h-[2px] w-8 overflow-hidden bg-ink/12">
                  <motion.span
                    className="u-accent-bg block h-full w-full origin-left"
                    style={{ scaleX: reduce ? 1 : scale }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Cartouche de planche (bas) — prend la place de l'invite au scroll
            une fois celle-ci effacée. */}
        <motion.div
          style={{ opacity: reduce ? 1 : cartoucheOpacity }}
          className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 px-[1.4rem] text-center"
        >
          {/* Métadonnée sous une image, pas un titre. Jusqu'ici cette ligne
              et l'amorce de la section suivante avaient le même corps, la
              même couleur et le même interlettrage : rien ne disait laquelle
              ferme un chapitre et laquelle en ouvre un.

              `u-eyebrow` fixe corps et interlettrage, et l'emporte sur les
              utilitaires : d'où le `!`. Le `text-[0.6rem]` qui figurait ici
              avant était d'ailleurs sans effet. */}
          <span className="u-eyebrow text-[0.55rem]! tracking-[0.08em]! text-ink-muted">
            06 pièces · assemblage manuel
          </span>
          <span className="u-index text-[0.58rem] tracking-tight text-ink-muted">
            {variant.index} — {variant.name}
          </span>
        </motion.div>

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
  const [contextePerdu, setContextePerdu] = useState(false);
  const repliRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setUse3D(!reduce && webglAvailable());
  }, [reduce]);

  // RÉARMEMENT — un échec ne doit pas devenir définitif. Quand le repli sort
  // du viewport, on relève le drapeau : au prochain passage, la 3D est
  // retentée par le cycle de montage normal. Si elle échoue encore, le filet
  // rebascule aussitôt — sans boucle serrée, puisqu'il faut re-scroller.
  useEffect(() => {
    if (!contextePerdu) return;
    const el = repliRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) setContextePerdu(false);
      },
      { rootMargin: "300px 0px 300px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [contextePerdu]);

  // Même filet que LampStage (voir le commentaire détaillé là-bas) : contexte
  // perdu → l'illustration statique reprend la place, définitivement pour ce
  // chargement. Ici le repli REMPLACE la piste au lieu d'être empilé dessous,
  // donc rien à masquer : c'est le même retour que « pas de WebGL du tout ».
  if (use3D !== true || contextePerdu)
    return <StaticEclate conteneurRef={contextePerdu ? repliRef : undefined} />;
  return <ExplodedScrollTrack onContextLost={() => setContextePerdu(true)} />;
}

"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { type MotionValue } from "framer-motion";
import { Architects_Daughter } from "next/font/google";
import type { AnchorMap } from "@/components/hero/ExplodedLamp3D";
import type { LampPart } from "@/data/lampModel";

// Police « écriture d'architecte » — annotation manuscrite au crayon.
const sketchFont = Architects_Daughter({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

type Side = "left" | "right";
interface AnnoDef {
  part: LampPart;
  num: string;
  label: string;
  side: Side;
  /** Position de l'étiquette (fraction de la boîte) : bord ext. + centre vertical. */
  lx: number;
  ly: number;
}

// Ordonnées par ordre d'APPARITION (haut → bas) pour un stagger de tracé agréable.
// Les numéros restent fixes par pièce (01 Abat-jour … 06 Support d'assemblage).
const ANNOS: AnnoDef[] = [
  { part: "shade", num: "01", label: "Abat-jour", side: "left", lx: 0.045, ly: 0.27 },
  { part: "bulb", num: "05", label: "Ampoule", side: "right", lx: 0.955, ly: 0.31 },
  { part: "connector", num: "06", label: "Support d'assemblage", side: "left", lx: 0.045, ly: 0.5 },
  { part: "socket", num: "04", label: "Douille", side: "right", lx: 0.955, ly: 0.52 },
  { part: "base", num: "02", label: "Pied", side: "left", lx: 0.06, ly: 0.74 },
  { part: "cable", num: "03", label: "Câble", side: "right", lx: 0.955, ly: 0.73 },
];

// Fenêtre de révélation : derniers ~18 % de la progression du scroll.
const START = 0.8;
const END = 0.985;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface ElRefs {
  label: HTMLDivElement | null;
  span: HTMLSpanElement | null;
  path: SVGPathElement | null;
  head: SVGPathElement | null;
}

/**
 * Couche d'annotations éditoriales « planche de croquis » superposée AU-DESSUS
 * du canvas 3D (jamais dans la scène). Chaque nom est relié à sa pièce par une
 * flèche fine dessinée à la main, ancrée sur la PROJECTION 2D réelle de la pièce
 * (via `anchorsRef`, alimenté frame à frame côté 3D). Le tracé des flèches et le
 * fondu des textes sont pilotés par le scroll (apparition sur les derniers ~18 %,
 * disparition en sens inverse). Rendu impératif (aucun re-render React) pour
 * préserver la fluidité. Respecte `prefers-reduced-motion`.
 */
export function ExplodedAnnotations({
  scrollYProgress,
  anchorsRef,
  reduce,
}: {
  scrollYProgress: MotionValue<number>;
  anchorsRef: MutableRefObject<AnchorMap | null>;
  reduce: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const elRefs = useRef<ElRefs[]>(ANNOS.map(() => ({ label: null, span: null, path: null, head: null })));
  // Point d'ancrage (bord intérieur de l'étiquette) mesuré, en px de la boîte.
  const ptsRef = useRef<{ x: number; y: number }[]>(ANNOS.map(() => ({ x: 0, y: 0 })));
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const measure = () => {
      const cRect = container.getBoundingClientRect();
      sizeRef.current = { w: cRect.width, h: cRect.height };
      svg.setAttribute("viewBox", `0 0 ${cRect.width} ${cRect.height}`);
      ANNOS.forEach((anno, i) => {
        const span = elRefs.current[i].span;
        if (!span) return;
        const r = span.getBoundingClientRect();
        const innerX =
          anno.side === "left" ? r.right - cRect.left : r.left - cRect.left;
        ptsRef.current[i] = { x: innerX, y: r.top - cRect.top + r.height / 2 };
      });
    };

    const draw = (p: number) => {
      const { w: W, h: H } = sizeRef.current;
      if (!W || !H) return;
      const a = anchorsRef.current;
      for (let i = 0; i < ANNOS.length; i++) {
        const anno = ANNOS[i];
        const els = elRefs.current[i];
        const pt = ptsRef.current[i];
        if (!els.label || !els.path || !els.head) continue;

        // Timing par élément (stagger d'apparition) — ou instantané si reduced-motion.
        let drawT: number;
        let labelT: number;
        let headT: number;
        if (reduce) {
          const on = p >= START ? 1 : 0;
          drawT = on;
          labelT = on;
          headT = on;
        } else {
          const spanLen = END - START;
          const s = START + spanLen * 0.32 * (i / (ANNOS.length - 1));
          const e = END;
          drawT = clamp((p - s) / Math.max(1e-4, e - s), 0, 1);
          labelT = clamp((p - s) / Math.max(1e-4, (e - s) * 0.55), 0, 1);
          headT = clamp((drawT - 0.8) / 0.2, 0, 1);
        }

        els.label.style.opacity = String(labelT);
        if (els.span)
          els.span.style.transform = `translateY(${(1 - labelT) * 6}px)`;

        const an = a?.[anno.part];
        if (!an || drawT <= 0) {
          els.path.style.opacity = "0";
          els.head.style.opacity = "0";
          continue;
        }
        els.path.style.opacity = "1";

        const tx = an.nx * W;
        const ty = an.ny * H;
        const gap = 7;
        const sx = pt.x + (anno.side === "left" ? gap : -gap);
        const sy = pt.y;
        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.hypot(dx, dy) || 1;
        const ux = dx / dist;
        const uy = dy / dist;
        const endGap = 11; // s'arrête un peu avant la pièce (la pointe la désigne)
        const ex = tx - ux * endGap;
        const ey = ty - uy * endGap;
        // Courbe douce (léger bombé perpendiculaire) → tracé organique.
        const mx = (sx + ex) / 2;
        const my = (sy + ey) / 2;
        const bend = Math.min(22, dist * 0.11) * (anno.side === "left" ? 1 : -1);
        const cx = mx - uy * bend;
        const cy = my + ux * bend;
        els.path.setAttribute("d", `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`);
        const len = els.path.getTotalLength();
        els.path.style.strokeDasharray = String(len);
        els.path.style.strokeDashoffset = String(len * (1 - drawT));

        // Pointe de flèche (deux barbes) — apparaît en fin de tracé.
        const ah = 9;
        const sp = 0.44;
        const cos = Math.cos(sp);
        const sin = Math.sin(sp);
        const b1x = ex - (ux * cos - uy * sin) * ah;
        const b1y = ey - (uy * cos + ux * sin) * ah;
        const b2x = ex - (ux * cos + uy * sin) * ah;
        const b2y = ey - (uy * cos - ux * sin) * ah;
        els.head.setAttribute("d", `M ${b1x} ${b1y} L ${ex} ${ey} L ${b2x} ${b2y}`);
        els.head.style.opacity = String(headT);
      }
    };

    measure();
    draw(scrollYProgress.get());

    // Boucle rAF tant que la couche est montée : suit le scroll ET le lissage des
    // pièces après l'arrêt du scroll (et les redimensionnements). Sortie anticipée
    // bon marché tant qu'on est loin de la fenêtre de révélation.
    let raf = 0;
    let hiddenApplied = false;
    const loop = () => {
      const p = scrollYProgress.get();
      if (p < START - 0.06) {
        if (!hiddenApplied) {
          for (const els of elRefs.current) {
            if (els.label) els.label.style.opacity = "0";
            if (els.path) els.path.style.opacity = "0";
            if (els.head) els.head.style.opacity = "0";
          }
          hiddenApplied = true;
        }
      } else {
        hiddenApplied = false;
        draw(p);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      measure();
      draw(scrollYProgress.get());
    });
    ro.observe(container);

    // Re-mesure quand la police manuscrite est chargée (largeur des étiquettes).
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        measure();
        draw(scrollYProgress.get());
      });
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [scrollYProgress, anchorsRef, reduce]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${sketchFont.className}`}
    >
      {/* Flèches dessinées à la main (SVG superposé, filtre de tremblé). */}
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full overflow-visible"
        fill="none"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="sketchWobble" x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018"
              numOctaves={2}
              seed={7}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={2.4}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <g
          filter="url(#sketchWobble)"
          stroke="#2b2b2b"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ANNOS.map((anno, i) => (
            <g key={anno.part}>
              <path
                ref={(el) => {
                  elRefs.current[i].path = el;
                }}
                style={{ opacity: 0 }}
              />
              <path
                ref={(el) => {
                  elRefs.current[i].head = el;
                }}
                strokeWidth={1.5}
                style={{ opacity: 0 }}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* Étiquettes manuscrites (HTML — hors de la scène 3D). */}
      {ANNOS.map((anno, i) => (
        <div
          key={anno.part}
          ref={(el) => {
            elRefs.current[i].label = el;
          }}
          className="absolute"
          style={{
            left: `${anno.lx * 100}%`,
            top: `${anno.ly * 100}%`,
            transform:
              anno.side === "left"
                ? "translate(0, -50%)"
                : "translate(-100%, -50%)",
            maxWidth: "42%",
            textAlign: anno.side === "left" ? "left" : "right",
            opacity: 0,
          }}
        >
          <span
            ref={(el) => {
              elRefs.current[i].span = el;
            }}
            className="inline-block leading-tight text-[#2b2b2b]"
            style={{ fontSize: "clamp(0.72rem, 3.2vw, 0.9rem)" }}
          >
            <span style={{ opacity: 0.55 }}>{anno.num} — </span>
            {anno.label}
          </span>
        </div>
      ))}
    </div>
  );
}

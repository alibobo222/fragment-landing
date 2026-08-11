"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { type MotionValue } from "framer-motion";
import type { AnchorMap } from "@/components/hero/ExplodedLamp3D";
import { finishFor, type LampPart } from "@/data/lampModel";
import type { ProductVariant } from "@/data/product";
import { EXPLODED_TIMELINE } from "@/components/chapters/explodedTimeline";
import { splitFinishLabel } from "@/lib/materialLabel";

type Side = "left" | "right";
interface AnnoDef {
  part: LampPart;
  num: string;
  label: string;
  side: Side;
  /** Décalage vertical volontaire, en fraction de la hauteur de scène, ajouté à
   *  la hauteur visée. Sert à éloigner une étiquette d'une zone encombrée que le
   *  calcul ne peut pas connaître : la répartition évite les collisions ENTRE
   *  étiquettes, pas les collisions avec la géométrie 3D. */
  biasY?: number;
  /** Décalage horizontal volontaire, en fraction de la largeur, appliqué à la
   *  colonne. Négatif = vers la gauche. Sert à écarter une étiquette d'une pièce
   *  qui vient s'étaler juste derrière elle. */
  biasX?: number;
  /** Place l'étiquette à MI-HAUTEUR de ses deux voisines de colonne, au lieu de
   *  la hauteur de sa propre pièce. Utile quand la pièce est au milieu d'un
   *  empilement : la nomenclature se lit alors comme une échelle régulière. */
  centerBetween?: boolean;
}

// Nomenclature — deux colonnes qui correspondent aux deux groupes réellement
// séparés par la vue éclatée :
//
//   colonne GAUCHE  01→03 : les volumes structurels (abat-jour, support, pied)
//   colonne DROITE  04→06 : le groupe électrique (ampoule, douille, câble),
//                           celui qui sort latéralement dans ExplodedLamp3D.
//
// L'ordre du tableau est l'ordre de LECTURE et de TRACÉ, et il coïncide avec
// l'ordre vertical des pièces dans chaque colonne — donc deux flèches d'une même
// colonne ne peuvent jamais se croiser.
//
// ⚠️ AUCUNE hauteur n'est écrite ici. Elles l'étaient auparavant (une fraction
// figée par étiquette), ce qui produisait le défaut principal de la planche :
// les trois étiquettes de droite étaient réparties sur toute la hauteur alors
// que leurs pièces sont regroupées au centre, si bien que la flèche du haut
// plongeait, celle du bas remontait, et elles se croisaient au milieu. Les
// hauteurs sont désormais CALCULÉES à partir de la projection réelle de chaque
// pièce, puis espacées juste ce qu'il faut pour ne pas se chevaucher
// (voir `layoutColumn`).
const ANNOS: AnnoDef[] = [
  // Abat-jour et câble sont les deux pièces les plus ÉTALÉES de la planche :
  // l'une occupe toute la largeur en haut, l'autre s'allonge vers la droite en
  // bas. Leur bord arrive donc presque sous leur propre étiquette, et le trait
  // n'avait pas la place de se déployer — il ressemblait à un moignon.
  //
  // On les envoie donc chacun vers l'extrémité de la planche, dans des sens
  // OPPOSÉS : l'abat-jour remonte vers le haut de la fenêtre, le câble descend
  // vers le bas. Le trait retrouve une longue diagonale, et les deux colonnes
  // s'aèrent au passage. Les bornes de `layoutColumn` empêchent de sortir de la
  // fenêtre : un biais généreux se traduit simplement par « aussi haut / aussi
  // bas que possible ».
  { part: "shade", num: "01", label: "Abat-jour", side: "left", biasY: -0.14 },
  // « Assemblage » plutôt que « Support d'assemblage » : c'est le terme employé
  // par `partLabels` et par la fiche technique, et c'était de loin l'étiquette
  // la plus large — elle débordait vers le centre, en plein sur la géométrie.
  // Centré entre l'abat-jour et le pied plutôt que calé sur sa propre pièce :
  // la colonne de gauche se lit comme une échelle à trois barreaux réguliers.
  { part: "connector", num: "02", label: "Assemblage", side: "left", centerBetween: true },
  { part: "base", num: "03", label: "Pied", side: "left" },
  { part: "bulb", num: "04", label: "Ampoule", side: "right", biasY: -0.1 },
  { part: "socket", num: "05", label: "Douille", side: "right" },
  // Décalé vers la gauche : le câble s'étale vers la droite du cadre et venait
  // passer derrière son propre texte.
  { part: "cable", num: "06", label: "Câble textile", side: "right", biasY: 0.18, biasX: -0.12 },
];

/** Bord extérieur de chaque colonne, en fraction de largeur. */
const COLUMN_X: Record<Side, number> = { left: 0.03, right: 0.97 };

/**
 * Largeur maximale d'une étiquette, en fraction de la colonne.
 *
 * C'est le principal levier contre le chevauchement texte / 3D : une étiquette
 * large déborde vers le centre, donc sur la géométrie. Étroite, elle reste dans
 * sa gouttière et se contente de passer à la ligne — ce qui est la norme sur une
 * planche technique.
 */
const LABEL_MAX_WIDTH = "24%";

/** Écart vertical minimal entre deux étiquettes voisines (px). */
const LABEL_GAP = 12;

/** Respiration entre le texte et le départ du trait (px). */
const TEXT_GAP = 9;

/** Recul de la pointe devant la pièce : elle DÉSIGNE, elle ne touche pas (px). */
const TIP_GAP = 10;

/** Longueur des barbes de la pointe (px). */
const HEAD_LEN = 8;

/**
 * Pénalité appliquée à un point cible situé DERRIÈRE le texte, c'est-à-dire dans
 * la bande horizontale qu'occupe l'étiquette. Un tel point ne peut être désigné
 * proprement depuis aucun des deux bords : le trait partirait forcément sur le
 * texte. Assez grande pour n'être jamais choisie s'il existe une alternative.
 */
const WRONG_SIDE_PENALTY = 1e5;

/**
 * Poids du recentrage vertical dans le choix du point cible. Sans lui, la flèche
 * se pose sur le sommet le plus proche, qui peut être une pointe excentrée de la
 * pièce ; avec, elle préfère un point proche ET représentatif.
 */
const CENTER_BIAS = 0.3;

/**
 * Longueur en dessous de laquelle un trait devient illisible (px) : trop court,
 * il ressemble à un accident plutôt qu'à une désignation, et sa pointe se perd
 * dans la matière.
 *
 * Le choix du point cible privilégie la PROXIMITÉ (pour ne pas traverser la
 * pièce), ce qui sur une pièce très étalée revient à se poser juste sous
 * l'étiquette. Cette pénalité rétablit l'équilibre : à qualité égale, un point
 * situé au-delà de ce seuil est préféré. C'est un réglage GLOBAL — aucune flèche
 * n'est corrigée à la main.
 */
const MIN_LEADER_LEN = 48;

/** Poids de la pénalité de trait trop court. */
const SHORT_LEADER_PENALTY = 1.6;

// Fenêtre de révélation — ACTE 2 de la chronologie (voir `explodedTimeline.ts`).
const START = EXPLODED_TIMELINE.annoStart;
const END = EXPLODED_TIMELINE.annoEnd;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface ElRefs {
  label: HTMLDivElement | null;
  span: HTMLSpanElement | null;
  path: SVGPathElement | null;
  head: SVGPathElement | null;
  dot: SVGCircleElement | null;
}

/**
 * Répartit une colonne d'étiquettes autour de leurs hauteurs SOUHAITÉES (la
 * projection de leur pièce), en garantissant un écart minimal et sans jamais
 * changer leur ordre — c'est cet invariant qui empêche les flèches de se croiser.
 *
 * Deux passes : la première pousse vers le bas pour respecter l'écart, la
 * seconde remonte pour rester dans la fenêtre. Une étiquette dont la pièce est
 * isolée garde exactement la hauteur de sa pièce ; seules celles qui se
 * marchaient dessus sont déplacées, du minimum nécessaire.
 */
function layoutColumn(
  desired: number[],
  heights: number[],
  minY: number,
  maxY: number,
  centerBetween: boolean[]
): number[] {
  const n = desired.length;
  const y = desired.slice();
  for (let k = 0; k < n; k++) {
    const floor =
      k === 0
        ? minY + heights[0] / 2
        : y[k - 1] + heights[k - 1] / 2 + LABEL_GAP + heights[k] / 2;
    y[k] = Math.max(y[k], floor);
  }
  for (let k = n - 1; k >= 0; k--) {
    const ceiling =
      k === n - 1
        ? maxY - heights[n - 1] / 2
        : y[k + 1] - heights[k + 1] / 2 - LABEL_GAP - heights[k] / 2;
    y[k] = Math.min(y[k], ceiling);
  }
  // Passe finale : les étiquettes marquées se posent à mi-chemin de leurs
  // voisines déjà résolues. Un milieu ne peut pas violer l'écart minimal dès lors
  // que ses voisines le respectent entre elles, donc l'ordre reste garanti — et
  // avec lui l'absence de croisement de flèches.
  for (let k = 1; k < n - 1; k++) {
    if (centerBetween[k]) y[k] = (y[k - 1] + y[k + 1]) / 2;
  }
  return y;
}

/**
 * Couche d'annotations éditoriales superposée AU-DESSUS du canvas 3D (jamais
 * dans la scène). Chaque nom est relié à sa pièce par une flèche fine, nette,
 * ancrée sur la PROJECTION 2D réelle de la pièce (via `anchorsRef`, alimenté
 * frame à frame côté 3D). Typographie identique au reste du site.
 *
 * Rendu impératif (aucun re-render React) pour préserver la fluidité.
 * Respecte `prefers-reduced-motion`.
 */
export function ExplodedAnnotations({
  scrollYProgress,
  anchorsRef,
  reduce,
  safeTop,
  stageBottom,
  variant,
}: {
  scrollYProgress: MotionValue<number>;
  anchorsRef: MutableRefObject<AnchorMap | null>;
  reduce: boolean;
  /** Marge haute (px) de la fenêtre de scène — les ancres 3D y sont ramenées. */
  safeTop: number;
  /** Marge basse (px) de la fenêtre de scène (cartouche de planche). */
  stageBottom: number;
  /** Configuration active : chaque pièce annonce SA matière (l'ampoule n'en a
   *  pas — elle n'appartient à aucune finition du catalogue). */
  variant: ProductVariant;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const elRefs = useRef<ElRefs[]>(
    ANNOS.map(() => ({ label: null, span: null, path: null, head: null, dot: null }))
  );
  // Encombrement mesuré de chaque étiquette (indépendant de sa position).
  const boxRef = useRef(ANNOS.map(() => ({ w: 0, h: 0 })));
  const sizeRef = useRef({ w: 0, h: 0 });
  const safeTopRef = useRef(safeTop);
  safeTopRef.current = safeTop;
  const stageBottomRef = useRef(stageBottom);
  stageBottomRef.current = stageBottom;

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const measure = () => {
      const cRect = container.getBoundingClientRect();
      sizeRef.current = { w: cRect.width, h: cRect.height };
      svg.setAttribute("viewBox", `0 0 ${cRect.width} ${cRect.height}`);
      ANNOS.forEach((_, i) => {
        const span = elRefs.current[i].span;
        if (!span) return;
        const r = span.getBoundingClientRect();
        boxRef.current[i] = { w: r.width, h: r.height };
      });
    };

    const draw = (p: number) => {
      const { w: W, h: H } = sizeRef.current;
      if (!W || !H) return;
      const anchors = anchorsRef.current;
      const top = safeTopRef.current;
      const stageH = Math.max(1, H - top - stageBottomRef.current);

      // --- 1. Hauteur souhaitée de chaque étiquette = hauteur de SA pièce ---
      // Les ancres arrivent normalisées 0→1 dans le canvas, qui n'occupe pas
      // toute la boîte : on les replace dans le repère de la boîte.
      const targetY: number[] = [];
      const targetX: number[] = [];
      for (let i = 0; i < ANNOS.length; i++) {
        const an = anchors?.[ANNOS[i].part];
        targetX[i] = an ? an.nx * W : W / 2;
        const bias = (ANNOS[i].biasY ?? 0) * stageH;
        targetY[i] = (an ? top + an.ny * stageH : top + stageH / 2) + bias;
      }

      // --- 2. Répartition par colonne, sans chevauchement ni croisement ---
      // Bornes : sous la marge haute, au-dessus du cartouche de planche.
      const minY = top + 8;
      const maxY = H - stageBottomRef.current - 52;
      const resolvedY: number[] = new Array(ANNOS.length);
      for (const side of ["left", "right"] as Side[]) {
        const idx = ANNOS.map((a, i) => (a.side === side ? i : -1)).filter(
          (i) => i >= 0
        );
        const ys = layoutColumn(
          idx.map((i) => targetY[i]),
          idx.map((i) => boxRef.current[i].h),
          minY,
          maxY,
          idx.map((i) => ANNOS[i].centerBetween === true)
        );
        idx.forEach((i, k) => {
          resolvedY[i] = ys[k];
        });
      }

      for (let i = 0; i < ANNOS.length; i++) {
        const anno = ANNOS[i];
        const els = elRefs.current[i];
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

        // Position calculée (pas de hauteur figée en CSS).
        els.label.style.top = `${resolvedY[i]}px`;
        els.label.style.opacity = String(labelT);
        if (els.span)
          els.span.style.transform = `translateY(${(1 - labelT) * 6}px)`;

        const an = anchors?.[anno.part];
        if (!an || drawT <= 0) {
          els.path.style.opacity = "0";
          els.head.style.opacity = "0";
          if (els.dot) els.dot.style.opacity = "0";
          continue;
        }
        els.path.style.opacity = "1";

        // --- Départ du trait : bord INTÉRIEUR de l'étiquette + respiration ---
        // Déduit de la largeur mesurée, jamais relu dans le DOM : la boucle doit
        // rester sans reflow.
        const colX = (COLUMN_X[anno.side] + (anno.biasX ?? 0)) * W;
        els.label.style.left = `${colX}px`;
        const wBox = boxRef.current[i].w;
        // Emprise horizontale RÉELLE du texte, quelle que soit la colonne.
        const boxLeft = anno.side === "left" ? colX : colX - wBox;
        const boxRight = boxLeft + wBox;
        const boxMid = (boxLeft + boxRight) / 2;
        const sy = resolvedY[i];

        // --- Point visé : le meilleur point de SURFACE, pas le centre de boîte ---
        // Trois critères, dans l'ordre d'importance :
        //   1. être du bon côté du départ — sinon le trait repart vers le texte
        //      et le traverse (c'est ce qui arrivait au câble, qui s'étale sous
        //      son étiquette) ;
        //   2. être proche du départ — la flèche est alors courte et sans
        //      ambiguïté, et surtout elle ne traverse pas la pièce pour aller
        //      se planter de l'autre côté ;
        //   3. rester représentatif de la pièce plutôt qu'une pointe excentrée.
        let tx = targetX[i];
        let ty = targetY[i];
        let bestScore = Infinity;
        for (let k = 0; k < an.count; k++) {
          const px = an.pts[k * 2] * W;
          const py = top + an.pts[k * 2 + 1] * stageH;
          // Distance mesurée depuis le MILIEU du texte : le point de départ
          // n'est pas encore connu, puisqu'il dépend justement de la cible.
          const reach = Math.hypot(px - boxMid, py - sy);
          const behindText = px > boxLeft - TEXT_GAP && px < boxRight + TEXT_GAP;
          const score =
            reach +
            CENTER_BIAS * Math.abs(py - targetY[i]) +
            SHORT_LEADER_PENALTY * Math.max(0, MIN_LEADER_LEN - reach) +
            (behindText ? WRONG_SIDE_PENALTY : 0);
          if (score < bestScore) {
            bestScore = score;
            tx = px;
            ty = py;
          }
        }

        // Départ = le bord du texte qui FAIT FACE à la cible, plus la marge de
        // respiration. C'est ce qui manquait : le trait sortait toujours du côté
        // intérieur de sa colonne, si bien qu'une pièce située de l'autre côté —
        // le câble, qui s'étale vers la droite alors que son étiquette est à
        // droite — obligeait le trait à revenir sur le texte pour l'atteindre.
        // Le bord de sortie est désormais choisi, pas imposé par la colonne.
        const sx = tx <= boxLeft ? boxLeft - TEXT_GAP : boxRight + TEXT_GAP;

        // --- Tracé : courbe TRÈS légère (quasi rectiligne), nette, pas gestuelle ---
        const dist = Math.hypot(tx - sx, ty - sy) || 1;
        const ux = (tx - sx) / dist;
        const uy = (ty - sy) / dist;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        // ⚠️ Le sens de la courbure suit le SENS DE PARCOURS, pas la colonne.
        // Il dépendait de `anno.side`, ce qui supposait qu'une étiquette de
        // gauche part toujours vers la droite. Depuis que le bord de sortie est
        // choisi selon la cible, cette hypothèse est fausse : un trait qui part
        // vers la gauche recevait alors une courbure inversée, et comme la
        // pointe est orientée sur la tangente finale, elle se retrouvait
        // retournée — le cas de la pièce d'assemblage, passée à gauche.
        const bend = Math.min(10, dist * 0.05) * (tx >= sx ? 1 : -1);
        const cx = mx - uy * bend;
        const cy = my + ux * bend;

        // Recul de la pointe le long de la TANGENTE RÉELLE de la courbe en son
        // extrémité — pour une quadratique, la direction (point de contrôle →
        // extrémité). L'ancienne version reculait le long de la corde droite
        // départ→cible, ce qui décalait la pointe et faussait son orientation
        // dès que le trait était courbé.
        let tex = tx - cx;
        let tey = ty - cy;
        const tlen = Math.hypot(tex, tey) || 1;
        tex /= tlen;
        tey /= tlen;
        // Le recul ne doit jamais dépasser la longueur du trait, sinon la
        // pointe repasse derrière son propre départ et se retourne.
        const tipGap = Math.min(TIP_GAP, Math.max(0, dist - 14));
        const ex = tx - tex * tipGap;
        const ey = ty - tey * tipGap;

        els.path.setAttribute("d", `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`);
        const len = els.path.getTotalLength();
        els.path.style.strokeDasharray = String(len);
        els.path.style.strokeDashoffset = String(len * (1 - drawT));

        // Point d'attache côté étiquette — ancre le trait au texte.
        if (els.dot) {
          els.dot.setAttribute("cx", String(sx));
          els.dot.setAttribute("cy", String(sy));
          els.dot.style.opacity = String(labelT);
        }

        // --- Pointe : orientée sur le DERNIER SEGMENT réellement tracé ---
        // Direction = (point de contrôle → extrémité du trait), donc toujours
        // dirigée vers la pièce et jamais vers le texte, quelle que soit la
        // courbure. Repli sur la corde si la courbe est dégénérée.
        let hx = ex - cx;
        let hy = ey - cy;
        const hlen = Math.hypot(hx, hy);
        if (hlen < 1e-3) {
          hx = ux;
          hy = uy;
        } else {
          hx /= hlen;
          hy /= hlen;
        }
        const sp = 0.44;
        const cos = Math.cos(sp);
        const sin = Math.sin(sp);
        const b1x = ex - (hx * cos - hy * sin) * HEAD_LEN;
        const b1y = ey - (hy * cos + hx * sin) * HEAD_LEN;
        const b2x = ex - (hx * cos + hy * sin) * HEAD_LEN;
        const b2y = ey - (hy * cos - hx * sin) * HEAD_LEN;
        els.head.setAttribute("d", `M ${b1x} ${b1y} L ${ex} ${ey} L ${b2x} ${b2y}`);
        els.head.style.opacity = String(headT);
      }
    };

    measure();
    draw(scrollYProgress.get());

    // Boucle rAF tant que la couche est montée : suit le scroll ET le lissage des
    // pièces après l'arrêt du scroll. Sortie anticipée bon marché tant qu'on est
    // loin de la fenêtre de révélation. Coupée quand l'onglet passe en
    // arrière-plan (voir onVisibility) : rien à dessiner tant que rien ne se voit.
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
            if (els.dot) els.dot.style.opacity = "0";
          }
          hiddenApplied = true;
        }
      } else {
        hiddenApplied = false;
        draw(p);
      }
      raf = requestAnimationFrame(loop);
    };
    const startLoop = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    if (!document.hidden) startLoop();

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const ro = new ResizeObserver(() => {
      measure();
      draw(scrollYProgress.get());
    });
    ro.observe(container);

    return () => {
      stopLoop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scrollYProgress, anchorsRef, reduce]);

  // Les libellés de matière changent de longueur avec la configuration :
  // il faut re-mesurer l'encombrement des étiquettes.
  useEffect(() => {
    ANNOS.forEach((_, i) => {
      const span = elRefs.current[i].span;
      if (!span) return;
      const r = span.getBoundingClientRect();
      boxRef.current[i] = { w: r.width, h: r.height };
    });
  }, [variant.id, safeTop, stageBottom]);

  const materialOf = (part: LampPart): string | null =>
    part === "bulb" ? null : finishFor(part, variant).label;

  return (
    <>
      {/* Équivalent textuel de la planche : la couche visuelle est purement
          graphique (canvas + SVG), donc invisible aux technologies d'assistance.
          Cette liste porte la même information, dans le même ordre. */}
      <ol className="sr-only">
        {ANNOS.map((anno) => {
          const mat = materialOf(anno.part);
          return (
            <li key={anno.part}>
              {anno.num} — {anno.label}
              {mat ? ` : ${mat}` : ""}
            </li>
          );
        })}
      </ol>

      <div
        ref={containerRef}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full overflow-visible"
          fill="none"
          preserveAspectRatio="none"
        >
          <g
            className="text-ink"
            stroke="currentColor"
            strokeWidth={1.2}
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
                <circle
                  ref={(el) => {
                    elRefs.current[i].dot = el;
                  }}
                  r={1.7}
                  fill="currentColor"
                  stroke="none"
                  style={{ opacity: 0 }}
                />
              </g>
            ))}
          </g>
        </svg>

        {/* Étiquettes — posées à même le blanc, sans plaque ni détourage.
            Leur hauteur est pilotée en JS (voir draw) ; le CSS ne fixe que la
            colonne et le centrage vertical sur le point calculé. */}
        {ANNOS.map((anno, i) => {
          const mat = materialOf(anno.part);
          // « Câble textile » + « Câble textile bleu » se réduit à une seule
          // ligne : « Câble textile — bleu ». Les matières sans rapport avec le
          // nom de la pièce (« Abat-jour » / « Wasterial® - Brique ») gardent
          // leur ligne propre.
          const parts = mat ? splitFinishLabel(anno.label, mat) : null;
          return (
            <div
              key={anno.part}
              ref={(el) => {
                elRefs.current[i].label = el;
              }}
              className="absolute"
              style={{
                left: `${COLUMN_X[anno.side] * 100}%`,
                top: 0,
                transform:
                  anno.side === "left"
                    ? "translate(0, -50%)"
                    : "translate(-100%, -50%)",
                maxWidth: LABEL_MAX_WIDTH,
                textAlign: anno.side === "left" ? "left" : "right",
                opacity: 0,
              }}
            >
              <span
                ref={(el) => {
                  elRefs.current[i].span = el;
                }}
                className="inline-block text-[0.68rem] font-medium leading-snug text-ink"
              >
                <span className="u-index text-[0.6rem] font-normal text-ink-muted">
                  {anno.num}
                </span>{" "}
                {anno.label}
                {parts?.suffix && (
                  <span className="font-normal text-ink-muted">
                    {" — "}
                    {parts.suffix}
                  </span>
                )}
                {parts?.full && (
                  <span className="u-index mt-0.5 block text-[0.55rem] font-normal leading-tight text-ink-muted">
                    {parts.full}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

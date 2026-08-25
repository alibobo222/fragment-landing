"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { materialMobileImage, materials, type MaterialSample } from "@/data/materials";

/**
 * Bandeau défilant des échantillons Wasterial® — section 02 « Matières »,
 * juste sous l'image des pots (voir MaterialsIntro.tsx).
 *
 * VITESSE CONSTANTE, PAS DURÉE CONSTANTE : la durée de l'animation CSS est
 * calculée à partir de la largeur réelle du ruban (mesurée, `ResizeObserver`)
 * divisée par cette vitesse — ajouter des échantillons demain ne change
 * jamais le rythme.
 *
 * BOUCLE SANS COUTURE : le ruban contient deux copies de la liste bout à
 * bout, translatées de -50% de leur largeur totale (donc exactement une
 * copie) via `@keyframes materials-marquee` (app/globals.css) — à la fin du
 * cycle, l'image est identique au début. `transform: translate3d` seul,
 * jamais `left`/`margin`/`scrollLeft` animés.
 */
const SPEED_PX_PER_S = 40; // 35–45 px/s demandé.

function SampleItem({ sample, lazy }: { sample: MaterialSample; lazy?: boolean }) {
  return (
    <li className="w-28 shrink-0 snap-start sm:w-36">
      {/* Pas de libellé visible sous l'échantillon (demandé) — le nom reste
          un vrai texte pour autant : porté par `alt`, lu au clavier/lecteur
          d'écran quand l'échantillon reçoit le focus ou est parcouru. */}
      {/* <img> brut et non `next/image` : la liste est dupliquée pour la
          boucle du ruban (jusqu'à ×2 le nombre d'échantillons), et `images:
          {unoptimized:true}` (export statique) ne fait de toute façon aucune
          optimisation serveur ici — juste deux tirages WebP déjà à la bonne
          taille (srcSet), sans le surcoût du composant. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={sample.image}
        srcSet={`${materialMobileImage(sample.image)} 220w, ${sample.image} 280w`}
        sizes="(min-width: 640px) 9rem, 7rem"
        width={280}
        height={280}
        alt={sample.alt}
        // La copie visible en premier peut être à l'écran dès l'arrivée sur
        // la section → chargement immédiat. La copie dupliquée pour la
        // boucle reste hors-écran par construction : paresseuse.
        loading={lazy ? "lazy" : undefined}
        decoding="async"
        className="block aspect-square w-full object-cover"
      />
    </li>
  );
}

/** Repli `prefers-reduced-motion` : aucun défilement automatique — bande à
 *  défilement manuel, scroll-snap, UNE SEULE liste (rien à dupliquer ni à
 *  masquer aux lecteurs d'écran, il n'y a pas de boucle à cacher). */
function ManualStrip() {
  return (
    <div
      role="region"
      aria-label="Échantillons de la gamme Wasterial®"
      // PAS de u-bleed ici : ce bandeau est déjà rendu à l'intérieur de
      // <figure className="u-bleed"> (MaterialsIntro.tsx), qui a déjà annulé
      // la gouttière de .u-container une fois. Un second u-bleed cumulerait
      // deux marges négatives et ferait déborder le bandeau de 1,4rem
      // (22,4px) de chaque côté au-delà du bord réel de la page — largeur
      // pleine héritée du parent, pas recalculée ici.
      className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex snap-x snap-mandatory">
        {materials.map((m) => (
          <SampleItem key={m.id} sample={m} />
        ))}
      </ul>
    </div>
  );
}

export function MaterialsMarquee() {
  const reduce = useReducedMotion();
  const wrapRef = useRef<HTMLDivElement>(null);
  // Mesure la largeur d'UNE SEULE copie du ruban (la première, réelle) —
  // les deux copies ont toujours la même largeur, pas besoin de mesurer la
  // seconde (dupliquée, aria-hidden, jamais mesurée).
  const listRef = useRef<HTMLUListElement>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [interacting, setInteracting] = useState(false);

  // Coupe l'animation quand la section n'est pas visible — même patron que
  // le montage/démontage des canvas WebGL (voir components/lamp/LampStage.tsx).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || reduce) return;
    const obs = new IntersectionObserver(([e]) => setInView(e.isIntersecting), {
      rootMargin: "200px 0px 200px 0px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [reduce]);

  // Durée = largeur d'une copie du ruban ÷ vitesse constante. Mesurée avant
  // peinture (useLayoutEffect) pour éviter un premier cycle à une mauvaise
  // vitesse ; réévaluée à chaque redimensionnement (ResizeObserver) — texte
  // qui reflow, rotation d'écran, ajout d'échantillons demain.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || reduce) return;
    const measure = () => {
      const w = el.scrollWidth;
      if (w > 0) setDuration(w / SPEED_PX_PER_S);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [reduce]);

  if (reduce) return <ManualStrip />;

  const paused = duration === null || !inView || interacting;

  return (
    <div
      ref={wrapRef}
      role="region"
      aria-label="Échantillons de la gamme Wasterial®"
      tabIndex={0}
      // Coupe franche sur les deux bords (pas de dégradé de fondu) — le
      // ruban sort du conteneur de texte et touche les deux bords de l'écran
      // (app-shell), comme l'image des pots juste au-dessus. PAS de u-bleed
      // ici (voir le commentaire de ManualStrip, même raison) : ce cadre
      // hérite déjà la pleine largeur de <figure className="u-bleed">, il
      // n'a qu'à la remplir et la rogner (overflow-hidden), pas la recréer.
      className="relative overflow-hidden focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink"
      // Pause au survol, au focus clavier ET au toucher (:hover/:focus-within
      // ne suffisent pas seuls : le tactile ne déclenche ni l'un ni l'autre,
      // d'où ces gestionnaires plutôt qu'un pur CSS).
      onPointerEnter={() => setInteracting(true)}
      onPointerLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={() => setInteracting(false)}
      onTouchStart={() => setInteracting(true)}
      onTouchEnd={() => setInteracting(false)}
      onTouchCancel={() => setInteracting(false)}
    >
      <div
        className="flex w-max"
        style={{
          animationName: "materials-marquee",
          animationDuration: `${duration ?? 30}s`,
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        <ul ref={listRef} className="flex shrink-0">
          {materials.map((m) => (
            <SampleItem key={m.id} sample={m} />
          ))}
        </ul>
        {/* Copie pour la boucle sans couture — jamais mesurée, jamais
            annoncée par un lecteur d'écran. */}
        <ul aria-hidden className="flex shrink-0">
          {materials.map((m) => (
            <SampleItem key={m.id} sample={m} lazy />
          ))}
        </ul>
      </div>
    </div>
  );
}

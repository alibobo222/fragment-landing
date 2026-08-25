"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * En-tête de section unifié, **épinglé au scroll** (sticky) par défaut : le titre
 * du chapitre reste en haut pendant tout le défilement de sa section, puis se
 * libère naturellement à l'arrivée du chapitre suivant.
 *
 * Dispositif de « nomenclature » éditoriale :
 *   [index mono] ──────────── [étiquette mono]
 *   Grand titre monolithique
 *
 * ⚠️ À placer comme **enfant direct de `<section>`** (pas dans un sous-conteneur
 * qui se termine avant la fin de la section), sinon l'épinglage se libère trop
 * tôt. Fond blanc opaque : le contenu défile proprement dessous.
 *
 * `sticky={false}` libère les ~110 px qu'occupe le panneau en haut d'écran, au
 * profit d'un autre élément épinglé dans la même section. C'est le cas du
 * configurateur, dont la scène 3D doit rester visible pendant la sélection :
 * deux blocs épinglés se superposeraient, et c'est la lampe qui doit gagner.
 *
 * ENTRÉE AU SCROLL — nomenclature (index/filet/kicker) puis titre, décalage
 * très court entre les deux (90 ms), amplitude minime (opacité depuis 0.4,
 * translation 6-8 px, jamais de mise à l'échelle sur le texte) : un point de
 * repère qui se sent sans se remarquer. Le filet se trace latéralement
 * (scaleX) en même temps que la nomenclature apparaît, mais met plus longtemps
 * à finir — la ponctuation arrive juste après le texte, pas avec lui. UN SEUL
 * IntersectionObserver par instance : `whileInView` porte uniquement sur le
 * conteneur (`u-container`), les enfants héritent son état via `variants` —
 * pas un observeur par élément animé.
 *
 * `once: false` (demandé explicitement) : l'effet REJOUE à chaque passage
 * dans la bande de déclenchement (marge -10%, comme `Reveal`), dans les deux
 * sens — redescendre puis remonter devant un titre le relance à chaque fois,
 * ce n'est pas un one-shot. Revers assumé de ce choix : un titre non épinglé
 * qui défile normalement se « réarme » (repasse à l'état masqué) aussi en
 * SORTANT par le haut de la bande, y compris en scroll descendant classique —
 * dans la dernière dizaine de % de hauteur de viewport avant de quitter
 * l'écran pour de bon, pas après. C'est le prix d'un effet qui doit se
 * rejouer : un `once: true` ne peut pas, par construction, redevenir visible
 * une seconde fois.
 *
 * Épinglage (sticky) et cette entrée : un titre ÉPINGLÉ, une fois collé en
 * haut d'écran, reste géométriquement à la même position tant qu'il est
 * épinglé — il continue donc d'intersecter la bande de déclenchement sans
 * interruption, et NE rejoue PAS en boucle pendant qu'il reste collé (vérifié
 * — voir le rapport de tâche). Il ne se réarme qu'une fois la section
 * entièrement défilée (le titre se libère et sort par le haut), et rejoue
 * normalement si on revient dessus.
 *
 * prefers-reduced-motion : repli complet, AUCUN wrapper `motion` — rendu
 * statique direct, état final, sans transition (règle du projet, plus
 * strict que le simple fondu conservé par `Reveal` pour ce composant en
 * particulier).
 */

const EASE = [0.22, 1, 0.36, 1] as const; // --ease-out-soft (globals.css) — la seule courbe du projet, jamais réinventée ici.

export function SectionHeading({
  id,
  index,
  kicker,
  title,
  className = "",
  sticky = true,
}: {
  id?: string;
  index: string;
  kicker: string;
  title: React.ReactNode;
  className?: string;
  /** Épingler le titre pendant la traversée de la section (défaut : `true`). */
  sticky?: boolean;
}) {
  const reduce = useReducedMotion();
  const wrapClassName = `${sticky ? "sticky top-14 z-20 " : ""}bg-white pt-6 pb-5 ${className}`;

  if (reduce) {
    return (
      <div className={wrapClassName}>
        <div className="u-container">
          <div className="flex items-center gap-4">
            <span className="u-index text-xs text-ink-muted">{index}</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
            <span className="u-eyebrow">{kicker}</span>
          </div>
          <h2 id={id} className="u-title mt-5">
            {title}
          </h2>
        </div>
      </div>
    );
  }

  // Décalage court entre les deux enfants directs (nomenclature, puis titre) —
  // porté par le conteneur, pas par des délais en dur sur chaque enfant.
  // Amplitude calibrée sur le DNA du site (contraste ink/paper maximal, pas
  // de dégradé de gris dans le texte courant — voir globals.css) plutôt que
  // sur un fondu doux générique : opacité basse (0.15, jamais 0) et
  // translation en haut de la fourchette validée (12/10px), décalage un peu
  // plus marqué (130ms) pour que les deux temps se distinguent nettement.
  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.13 } },
  };
  const row: Variants = {
    hidden: { opacity: 0.15, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };
  // Le filet se trace de gauche à droite (transform-origin: left) — un
  // scaleX sur un trait de 1px de haut, pas une mise à l'échelle du texte.
  const line: Variants = {
    hidden: { scaleX: 0 },
    visible: { scaleX: 1, transition: { duration: 0.6, ease: EASE } },
  };
  const titleVariants: Variants = {
    hidden: { opacity: 0.15, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };

  return (
    <div className={wrapClassName}>
      <motion.div
        className="u-container"
        variants={container}
        initial="hidden"
        whileInView="visible"
        // once: false (demandé, revient sur le choix initial) — l'effet
        // rejoue à CHAQUE passage dans le viewport, pas seulement au premier :
        // repasser devant en remontant (ou en redescendant) relance le même
        // repère visuel, dans les deux sens.
        viewport={{ once: false, margin: "-10% 0px" }}
      >
        <motion.div variants={row} className="flex items-center gap-4">
          <span className="u-index text-xs text-ink-muted">{index}</span>
          <motion.span
            aria-hidden
            variants={line}
            style={{ transformOrigin: "left" }}
            className="h-px flex-1 bg-line"
          />
          <span className="u-eyebrow">{kicker}</span>
        </motion.div>
        <motion.h2 id={id} variants={titleVariants} className="u-title mt-5">
          {title}
        </motion.h2>
      </motion.div>
    </div>
  );
}

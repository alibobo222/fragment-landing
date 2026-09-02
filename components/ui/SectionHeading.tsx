"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * OUVERTURE DE CHAPITRE — le bloc par lequel commence chacune des cinq
 * sections. C'est lui, avec le changement de sol, qui porte la structure du
 * site : à l'arrêt, sans une seule animation, on voit qu'on entre dans un
 * chapitre, lequel, et comment il s'appelle.
 *
 *   01         le numéro, dans la DOMINANTE de la configuration choisie —
 *              `u-accent-fg` suit `--accent`, que SelectionProvider pose sur
 *              :root d'après `variant.accent`. Les cinq numéros changent donc
 *              ensemble quand on change de configuration, avec la transition de
 *              0,6 s déjà portée par la classe. Il a d'abord été une texture
 *              très pâle, calibrée pour 96 px ; à 34 px la même valeur ne se
 *              voyait plus. Petit, il doit porter par la couleur.
 *   LE PROJET  le libellé, 11 px, aligné sur la ligne de base du numéro, en
 *              pleine opacité : c'est lui qu'on lit.
 *   Le titre   en dessous.
 *
 * Le fil sous l'en-tête et le chapitre courant du sommaire restent, eux, au
 * bleu du câble : ils répondent à « où suis-je dans la page », une question qui
 * ne dépend pas de la configuration regardée. Le numéro, lui, prend la couleur
 * de l'objet — c'est la page qui se teinte de ce qu'on a choisi.
 *
 * L'ÉPINGLAGE A DISPARU. Ce bloc était `sticky top-14` avec un fond blanc
 * opaque, ce qui obligeait tout autre élément épinglé dans une section à
 * mesurer sa hauteur pour passer dessous. Les cinq points d'appel passaient
 * déjà `sticky={false}` : le mode épinglé n'était plus utilisé nulle part.
 *
 * prefers-reduced-motion : rendu statique direct, état final, aucun wrapper
 * `motion`. La structure ne dépend d'aucun mouvement.
 */

const EASE = [0.22, 1, 0.36, 1] as const; // --ease-out-soft, la seule courbe du projet.

/**
 * UNE PHRASE PAR LIGNE dans les titres de chapitre.
 *
 * `text-wrap: balance` équilibre la longueur des lignes mais ignore la
 * ponctuation : « La forme est constante. La matière change tout. » se rendait
 * en « La forme est / constante. La / matière change tout. » — une seconde
 * phrase ouverte par un « La » resté seul en fin de ligne, alors qu'il n'y
 * avait plus la place que pour lui.
 *
 * Chaque phrase devient donc son propre bloc : le retour à la ligne tombe à la
 * ponctuation, et `balance` équilibre ensuite À L'INTÉRIEUR de chacune. Un
 * titre d'une seule phrase n'est pas touché.
 *
 * Seules les chaînes sont découpées — un titre passé en JSX est rendu tel quel,
 * on ne devine pas la structure de ce qu'on n'a pas écrit.
 */
function parPhrase(titre: React.ReactNode): React.ReactNode {
  if (typeof titre !== "string") return titre;
  const phrases = titre.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (phrases.length < 2) return titre;
  return phrases.map((phrase) => (
    <span key={phrase} className="block">
      {phrase}
    </span>
  ));
}

export function SectionHeading({
  id,
  index,
  kicker,
  title,
  className = "",
}: {
  id?: string;
  index: string;
  kicker: string;
  title: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  const contenu = (
    <>
      {/* items-baseline : le libellé repose sur la ligne de base du numéro, pas
          sur son centre optique. leading-[0.85] colle la boîte du numéro à son
          dessin — l'interlignage par défaut ouvrirait une trentaine de pixels
          de vide sous lui. */}
      <div className="flex items-baseline gap-4">
        {/* POLICE D'AFFICHAGE, PAS MONO — et ce n'est pas un choix esthétique.
            Le zéro d'IBM Plex Mono est pointé par construction : vérifié, ni
            "zero" 0 ni "zero" 1 ne l'enlèvent, la fonctionnalité OpenType
            bascule entre deux dessins qui portent tous deux la marque. Seule
            une autre police donne un zéro net.

            cv01 est neutralisé : `body` applique "ss01" et "cv01", et cv01
            encadre les chiffres d'Overused Grotesk — vérifié, « 01 » sortait
            dans deux rectangles. ss01 reste, c'est la lettre du site.

            Il est LU par les lecteurs d'écran : il l'a un temps été masqué,
            quand il était une texture à 1,1:1 qu'on ne pouvait pas annoncer
            comme du texte. À présent qu'il porte la dominante et se lit
            franchement, le masquer priverait d'un numéro que la page affiche. */}
        <span
          className="u-accent-fg block font-display text-[clamp(28px,9vw,38px)] font-semibold leading-[0.85]"
          style={{ fontFeatureSettings: '"ss01"' }}
        >
          {index}
        </span>
        {/* Filet de séparation. `self-center` et non la ligne de base : un trait
            vertical n'en a pas, l'aligner dessus le collerait au bas du bloc.
            Il prend la couleur des filets du site, pas celle de l'accent — le
            numéro porte déjà la couleur, un second élément coloré ferait deux
            signaux pour une seule information. */}
        <span aria-hidden className="h-6 w-px shrink-0 self-center bg-line" />
        {/* 16 px et non 11 : c'est CE mot qui nomme le chapitre, il ne pouvait
            pas rester le plus petit élément du bloc. Avec le numéro descendu et
            le titre monté, les trois corps tiennent dans un rapport de 2,4 au
            lieu de 4,3 — un seul bloc, pas trois tailles étrangères. */}
        <span className="u-mono text-[1rem] font-medium uppercase tracking-[0.12em]">
          {kicker}
        </span>
      </div>
      <h2 id={id} className="u-title mt-4 text-[2rem]!">
        {parPhrase(title)}
      </h2>
    </>
  );

  // Le vide est AU-DESSUS de l'ouverture : il détache le chapitre de la fin
  // du précédent. Il valait 28svh — 239 px sur un iPhone, une demi-page pour
  // trois lignes de texte, un désert à franchir entre deux chapitres. Une
  // valeur fixe suffit, et courte : ce creux doit se sentir, pas se traverser.
  const boite = `pt-8 pb-5 ${className}`;

  if (reduce) {
    return (
      <div className={boite}>
        <div className="u-container">{contenu}</div>
      </div>
    );
  }

  return (
    <div className={boite}>
      <motion.div
        className="u-container"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-10% 0px" }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        {contenu}
      </motion.div>
    </div>
  );
}

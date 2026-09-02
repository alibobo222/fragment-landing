"use client";

import { useEffect, useState } from "react";

/**
 * LES CINQ CHAPITRES — source unique.
 *
 * Le repère de l'en-tête, le sommaire du menu et l'ordre de lecture en
 * dérivent tous les trois. Ajouter un chapitre ici et lui donner son sol dans
 * `globals.css` suffit : rien d'autre à synchroniser.
 *
 * `id` doit correspondre à l'attribut `id` de la `<section>` correspondante —
 * c'est par lui que la position courante est mesurée.
 */
export const CHAPITRES = [
  { num: "01", id: "projet", label: "Le projet" },
  { num: "02", id: "matieres", label: "Les matières" },
  { num: "03", id: "configurateur", label: "Le configurateur" },
  { num: "04", id: "details", label: "Fiche technique" },
  { num: "05", id: "contact", label: "Prendre contact" },
] as const;

/** Hauteur de l'en-tête fixe : 3.5rem + le pixel de son filet. */
const LIGNE_DE_LECTURE = 57;

export type EtatChapitre = {
  /** 0 dans le hero, puis 1 à 5. */
  index: number;
};

/**
 * Chapitre courant, mesuré à la position du document.
 *
 * Le chapitre courant est le DERNIER dont le haut a franchi la ligne de
 * lecture, juste sous l'en-tête. Pas d'IntersectionObserver : avec des
 * sections de hauteurs très inégales, plusieurs seraient visibles à la fois et
 * il faudrait arbitrer — la ligne de lecture tranche toute seule, et c'est
 * exactement ce que l'œil fait.
 *
 * Un seul écouteur de défilement, passif, dégroupé par requestAnimationFrame,
 * et l'état n'est réécrit que s'il change : le rendu ne repart pas à chaque
 * pixel parcouru.
 */
export function useChapitreCourant(): EtatChapitre {
  const [etat, setEtat] = useState<EtatChapitre>({ index: 0 });

  useEffect(() => {
    let frame = 0;

    const mesurer = () => {
      frame = 0;
      let index = 0;
      CHAPITRES.forEach((chapitre, i) => {
        const el = document.getElementById(chapitre.id);
        if (el && el.getBoundingClientRect().top <= LIGNE_DE_LECTURE) index = i + 1;
      });
      setEtat((prec) => (prec.index === index ? prec : { index }));
    };

    const planifier = () => {
      if (!frame) frame = requestAnimationFrame(mesurer);
    };

    mesurer();
    window.addEventListener("scroll", planifier, { passive: true });
    window.addEventListener("resize", planifier);
    return () => {
      window.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return etat;
}

"use client";

import { useEffect } from "react";
import { LAMP_MODEL_URL } from "@/data/lampModel";

/**
 * Préchargement discret du modèle 3D — aucun rendu, aucun indicateur.
 *
 * CE QU'IL CORRIGE. Le GLB pèse 5,86 Mo et n'était demandé qu'à l'approche du
 * configurateur. En 4G lente, la lampe mettait 20 s à apparaître : vingt
 * secondes de configurateur vide. Ce n'est pas un cas marginal — on arrive ici
 * par QR code, debout devant l'objet, sur un téléphone en données mobiles.
 * Mesuré, après 12 s de lecture du haut de page : 20 007 ms → 4 373 ms, −78 %.
 *
 * CE QU'IL NE CORRIGE PAS, et pourquoi c'est structurel. Le défilement bloque
 * sur trois tâches longues (~1 900 ms cumulés) au montage des scènes. Elles sont
 * INCHANGÉES par ce préchargement, mesure à l'appui : c'est de la compilation de
 * shaders et de l'upload GPU, pas du téléchargement. Or les deux exigent un
 * contexte WebGL vivant. Les anticiper voudrait dire en ouvrir un second à
 * l'avance — ce que le projet interdit, et à raison. C'est le prix d'une page qui
 * fait tourner de la 3D, pas un réglage qu'on aurait manqué.
 *
 * `useGLTF.preload` plutôt qu'un `fetch` : le GLB est servi en
 * `max-age=0, must-revalidate`, si bien qu'un fetch imposerait quand même une
 * revalidation et laisserait l'analyse du fichier à faire. Le cache de drei, lui,
 * retient le résultat déjà analysé.
 *
 * UN SEUL CONTEXTE WebGL : `preload` télécharge et analyse, il ne crée ni canvas
 * ni renderer. Vérifié par comptage des appels à getContext — 2 avant le
 * défilement et 4 au total, identiques avec et sans ce composant.
 *
 * Déclenché après `load` puis en temps mort : le hero est le LCP de la page, et
 * rien ne doit lui disputer la bande passante. Le travail se fait pendant que le
 * visiteur lit le haut de la page, c'est-à-dire pendant qu'il ne se passe rien.
 */
export function PrechargementLampe() {
  useEffect(() => {
    let annule = false;

    const precharger = () => {
      if (annule) return;
      // Import dynamique : drei n'est pas dans le bundle initial, et ne doit pas
      // y entrer pour autant. Un échec ici est sans conséquence — la scène
      // chargera le modèle elle-même, comme avant.
      import("@react-three/drei")
        .then((m) => {
          if (!annule) m.useGLTF.preload(LAMP_MODEL_URL);
        })
        .catch(() => {});
    };

    const planifier = () => {
      if (annule) return;
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
        .requestIdleCallback;
      // `timeout` garantit que le préchargement finit par partir même si le
      // navigateur ne trouve jamais de temps mort.
      if (ric) ric(precharger, { timeout: 3000 });
      else setTimeout(precharger, 1200);
    };

    if (document.readyState === "complete") planifier();
    else window.addEventListener("load", planifier, { once: true });

    return () => {
      annule = true;
    };
  }, []);

  return null;
}

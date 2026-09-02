"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { siteConfig } from "@/config/site";

/**
 * Chapitre 1 — Hero visuel STATIQUE (fidèle à la maquette).
 *
 * Grande photographie verticale de la lampe, plein cadre, nom de la
 * configuration en bas + amorce de défilement. Entrée en fondu-zoom lente,
 * léger parallax au scroll (profondeur). Aucune 3D ici — elle arrive au
 * chapitre « Explorer ».
 */
export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  // Léger parallax : l'image glisse et s'assombrit doucement en sortant.
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const captionY = useTransform(scrollYProgress, [0, 0.6], [0, -24]);
  const captionO = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      id="top"
      ref={ref}
      aria-labelledby="hero-title"
      className="relative h-[calc(100svh-3.5rem)] w-full overflow-hidden bg-white"
    >
      <motion.div
        className="absolute inset-0"
        style={reduce ? undefined : { y, scale, willChange: "transform" }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: reduce ? 1 : 1 }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src="/images/hero/noir-mineral.jpg"
          alt="La lampe Noir Minéral : abat-jour incliné révélant un intérieur en pierre veinée, ampoule allumée, pied cylindrique sombre et câble textile bleu."
          fill
          priority
          sizes="480px"
          className="object-cover object-center"
        />
      </motion.div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center pb-8"
        style={reduce ? undefined : { y: captionY, opacity: captionO }}
      >
        <motion.h1
          id="hero-title"
          className="u-mono text-center text-[0.82rem] font-medium uppercase tracking-[0.2em]"
          style={{ color: "#ffffff", textShadow: "0 1px 14px rgba(0,0,0,0.4)" }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {siteConfig.collectionName}
        </motion.h1>
        <Amorce />
      </motion.div>
    </section>
  );
}

const CLE_AMORCE = "amorce-defilement-vue";

/**
 * AMORCE DE DÉFILEMENT — la barre, puis un trait de 1 px qui descend sur
 * 24 px, marque un temps, s'efface, et recommence toutes les 2,4 s. Aucun
 * texte : il dit qu'il y a quelque chose en dessous, il ne l'explique pas.
 *
 * Il ne revient JAMAIS une fois compris : dès 40 px de défilement — le geste
 * a eu lieu — ou au bout de 8 secondes, il s'éteint pour toute la session. Un
 * repère qui continue d'insister après avoir été compris devient un tic.
 *
 * prefers-reduced-motion : le trait n'apparaît pas du tout. La barre seule
 * demeure, et c'est l'alternance des sols qui dit qu'il y a une suite.
 */
function Amorce() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reduce) return;
    try {
      if (sessionStorage.getItem(CLE_AMORCE) === "1") return;
    } catch {
      // Navigation privée ou stockage refusé : l'amorce joue, sans mémoire.
    }
    setVisible(true);

    const eteindre = () => {
      setVisible(false);
      try {
        sessionStorage.setItem(CLE_AMORCE, "1");
      } catch {
        // Sans stockage, l'amorce rejouera au prochain montage. Sans gravité.
      }
    };

    const minuteur = window.setTimeout(eteindre, 8000);
    const auDefilement = () => {
      if (window.scrollY > 40) eteindre();
    };
    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => {
      window.clearTimeout(minuteur);
      window.removeEventListener("scroll", auDefilement);
    };
  }, [reduce]);

  return (
    <>
      <motion.span
        aria-hidden
        className="mt-4 h-1 w-9 rounded-full bg-white/70"
        initial={{ opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.8, delay: 1, ease: [0.22, 1, 0.36, 1] }}
      />
      {visible && (
        // scaleY sur une boîte de 24 px déjà réservée, plutôt qu'une hauteur
        // animée : le trait descend sans provoquer un seul recalcul de mise
        // en page à chaque image.
        <motion.span
          aria-hidden
          className="mt-2 block h-6 w-px origin-top bg-white/70"
          animate={{ scaleY: [0, 1, 1, 1], opacity: [1, 1, 1, 0] }}
          transition={{
            duration: 2.4,
            times: [0, 0.35, 0.72, 1],
            repeat: Infinity,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      )}
    </>
  );
}

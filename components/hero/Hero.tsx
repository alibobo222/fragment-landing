"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { siteConfig } from "@/config/site";

/**
 * Chapitre 1 — Hero visuel STATIQUE (fidèle à la maquette).
 *
 * Grande photographie verticale de la lampe, plein cadre, nom de la
 * configuration en bas + indicateur de défilement. Entrée en fondu-zoom lente,
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
        <motion.span
          aria-hidden
          className="mt-4 h-1 w-9 rounded-full bg-white/70"
          initial={{ opacity: 0, scaleX: 0.4 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.8, delay: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </motion.div>
    </section>
  );
}

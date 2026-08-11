"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Léger parallax lié au scroll : l'élément glisse doucement sur l'axe Y à mesure
 * qu'il traverse le viewport. Transform GPU uniquement (60 fps). Désactivé sous
 * prefers-reduced-motion.
 */
export function Parallax({
  children,
  amount = 40,
  className,
}: {
  children: React.ReactNode;
  amount?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [amount, -amount]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y, willChange: "transform" }}>
        {children}
      </motion.div>
    </div>
  );
}

/**
 * Image qui se révèle au scroll : léger zoom arrière + montée d'opacité, dans un
 * cadre à débordement masqué. Lazy par défaut (next/image). Premium et sobre.
 */
export function RevealImage({
  src,
  alt,
  ratio = "aspect-[4/5]",
  sizes = "430px",
  className = "",
  imgClassName = "object-cover",
  priority = false,
  y = 0,
  zoom = 1.12,
}: {
  src: string;
  alt: string;
  ratio?: string;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  /** Translation verticale d'entrée (px). 0 = désactivée. */
  y?: number;
  /** Zoom d'entrée (1 = aucun). */
  zoom?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={`relative overflow-hidden ${ratio} ${className}`}>
      <motion.div
        className="absolute inset-0"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y, scale: zoom }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: "-8% 0px" }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        style={{ willChange: "transform, opacity" }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={imgClassName}
        />
      </motion.div>
    </div>
  );
}

/**
 * Micro-interaction partagée par tous les boutons « verre » du site : léger
 * soulèvement au survol, légère compression naturelle au clic — courte,
 * fluide (ressort), cohérente sur l'ensemble des CTA.
 */
export const buttonMotion = {
  whileHover: { y: -1, scale: 1.012 },
  whileTap: { scale: 0.965, y: 0 },
  transition: { type: "spring" as const, stiffness: 420, damping: 30 },
};

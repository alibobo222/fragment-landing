"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Révélation au scroll, raffinée : opacité + légère montée + micro-flou levé.
 * Lente et précise (premium). Respecte prefers-reduced-motion (rendu statique).
 */
export function Reveal({
  children,
  delay = 0,
  y = 20,
  blur = 3,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  blur?: number;
  className?: string;
  as?: "div" | "li" | "section" | "figure";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];

  const variants: Variants = {
    hidden: {
      opacity: 0,
      y: reduce ? 0 : y,
      filter: reduce ? "blur(0px)" : `blur(${blur}px)`,
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10% 0px" }}
    >
      {children}
    </MotionTag>
  );
}

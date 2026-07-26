"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { siteConfig } from "@/config/site";
import { tapProps } from "@/components/ui/motion";

const MENU = [
  { href: "#top", label: "Découvrir" },
  { href: "#projet", label: "Le projet" },
  { href: "#matieres", label: "Matières" },
  { href: "#configurateur", label: "Explorer" },
  { href: "#contact", label: "Contact" },
];

/**
 * En-tête compact, fond blanc, fine séparation. Logo FRAGMENT à gauche, menu
 * (hamburger) à droite ouvrant un panneau plein écran animé — cadré sur la
 * colonne mobile.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white">
      <div className="u-container flex h-16 items-center justify-between">
        <a
          href="#top"
          onClick={() => setOpen(false)}
          className="inline-flex items-center"
          aria-label={`${siteConfig.brandName}, retour en haut`}
        >
          <Image
            src="/images/brand/fragment-wordmark.png"
            alt={siteConfig.brandName}
            width={777}
            height={180}
            priority
            className="h-[1.4rem] w-auto"
          />
        </a>

        <motion.button
          type="button"
          {...tapProps}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="menu-principal"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          className="inline-flex h-10 w-10 items-center justify-center text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <BurgerIcon open={open} />
        </motion.button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* Voile sur le surround (desktop) — ferme au clic. */}
            <motion.div
              className="fixed inset-0 z-40 bg-ink/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setOpen(false)}
              aria-hidden
            />
            {/* Panneau, cadré sur la colonne mobile. */}
            <motion.div
              id="menu-principal"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation principale"
              className="fixed inset-y-0 left-1/2 top-16 z-50 w-full max-w-[30rem] -translate-x-1/2 overflow-y-auto bg-white"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.nav
                className="u-container flex flex-col py-6"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
              >
                {MENU.map((item, i) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    variants={{
                      hidden: { opacity: 0, y: reduce ? 0 : 14 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                    }}
                    className="group flex items-baseline gap-4 border-b border-line py-5 font-display text-[2.4rem] font-extrabold uppercase leading-none tracking-[-0.03em] text-ink transition-colors hover:text-anthracite"
                  >
                    <span className="u-index w-7 text-xs text-ink-muted">
                      0{i + 1}
                    </span>
                    {item.label}
                  </motion.a>
                ))}
                <a
                  href={`mailto:${siteConfig.contactEmail}`}
                  onClick={() => setOpen(false)}
                  className="mt-8 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  {siteConfig.contactEmail}
                </a>
              </motion.nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <line
        x1="3"
        y1={open ? "12" : "7"}
        x2="21"
        y2={open ? "12" : "7"}
        stroke="currentColor"
        strokeWidth="1.8"
        style={{ transform: open ? "rotate(45deg)" : "none", transformOrigin: "center", transition: "all 0.25s ease" }}
      />
      <line
        x1="3"
        y1={open ? "12" : "17"}
        x2="21"
        y2={open ? "12" : "17"}
        stroke="currentColor"
        strokeWidth="1.8"
        style={{ transform: open ? "rotate(-45deg)" : "none", transformOrigin: "center", transition: "all 0.25s ease" }}
      />
    </svg>
  );
}

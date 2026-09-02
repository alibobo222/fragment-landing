"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion, useScroll } from "framer-motion";
import { siteConfig } from "@/config/site";
import { buttonMotion } from "@/components/ui/motion";
import { CHAPITRES, useChapitreCourant } from "@/lib/chapitres";

/**
 * En-tête fixe. Il porte deux des repères de lecture du site :
 *
 *   LE FIL — une ligne de 2 px du bleu du câble, collée sous l'en-tête, dont
 *   la longueur EST la progression dans le document. Pilotée par `scaleX` sur
 *   une valeur de mouvement, sans transition : elle suit le doigt, elle ne
 *   rattrape pas son retard après coup. Ce n'est pas une barre de progression
 *   générique, c'est le câble de la lampe qui traverse la page.
 *
 *   LE SOMMAIRE — le panneau de menu liste les cinq chapitres et marque le
 *   courant en bleu. C'est la structure disponible à la demande, pour qui veut
 *   savoir combien il en reste.
 *
 * POSITION FIXE, PAS STICKY : sur Safari iOS la bande disparaissait dès qu'on
 * quittait le sommet malgré `sticky top-0`, sans qu'aucun ancêtre ne porte de
 * transform, filter, will-change ni overflow. Le centrage passe par
 * `inset-x-0 + mx-auto`, JAMAIS par `-translate-x-1/2` : un transform ferait
 * de l'en-tête le bloc conteneur du voile et du panneau, qui sont `fixed` et
 * ses descendants.
 */

// Le sommaire = le hero, puis les cinq chapitres. « Découvrir » n'a pas de
// numéro : ce n'est pas un chapitre, c'est le seuil.
const SOMMAIRE = [
  { num: "", href: "#top", label: "Découvrir" },
  ...CHAPITRES.map((c) => ({ num: c.num, href: "#" + c.id, label: c.label })),
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const { index } = useChapitreCourant();

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
    <>
      <header className="fixed inset-x-0 top-0 z-40 mx-auto w-full max-w-[30rem] border-b border-line bg-white">
        <div className="u-container flex h-14 items-center justify-between">
          {/* La bande ne porte QUE le logotype et l'accès au sommaire. Elle a
              un temps affiché le numéro du chapitre courant à droite du
              logotype : dans 56 px de haut, à côté d'un logotype, il ajoutait
              une seconde information sans en clarifier aucune — l'ouverture de
              chapitre et le sommaire disent déjà où l'on est, en plus grand et
              plus complètement. */}
          <a
            href="#top"
            onClick={() => setOpen(false)}
            className="inline-flex items-center"
            aria-label={siteConfig.brandName + ", retour en haut"}
          >
            <Image
              src="/images/brand/fragment-wordmark.png"
              alt={siteConfig.brandName}
              width={777}
              height={180}
              priority
              className="h-[1.7rem] w-auto"
            />
          </a>

          <motion.button
            type="button"
            {...buttonMotion}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-principal"
            aria-label={open ? "Fermer le sommaire" : "Ouvrir le sommaire"}
            className="btn-glass btn-glass-icon inline-flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <BurgerIcon open={open} />
          </motion.button>
        </div>

        {/* LE FIL. `top-full` : juste sous le filet de l'en-tête, sur toute la
            largeur de la colonne. Aucune transition — `scaleX` est lié
            directement à la valeur de progression, il n'y a rien à animer.
            prefers-reduced-motion : le fil reste, à pleine longueur, immobile.
            Il cesse alors d'informer sur la progression ; la structure, elle,
            est portée par les sols et les ouvertures de chapitre, pas par lui. */}
        <motion.div
          aria-hidden
          className="absolute inset-x-0 top-full h-0.5 origin-left"
          style={{
            backgroundColor: "var(--color-fil)",
            scaleX: reduce ? 1 : scrollYProgress,
          }}
        />

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
                aria-label="Sommaire"
                className="fixed inset-y-0 left-1/2 top-14 z-50 w-full max-w-[30rem] -translate-x-1/2 overflow-y-auto bg-white"
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
                  {SOMMAIRE.map((item, i) => {
                    // i === 0 est « Découvrir » : courant tant qu'on n'a pas
                    // atteint le premier chapitre.
                    const courant = i === index;
                    return (
                      <motion.a
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={courant ? "true" : undefined}
                        variants={{
                          hidden: { opacity: 0, y: reduce ? 0 : 14 },
                          visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
                        }}
                        // Même typographie que les titres de section (u-title,
                        // voir components/ui/SectionHeading.tsx) : taille, graisse,
                        // interlignage et suivi de lettres identiques — une seule
                        // source pour les deux, jamais deux réglages qui divergent.
                        // font-display reste explicite : u-title n'impose la police
                        // que via le sélecteur h1/h2/h3, pas sur un <a>.
                        className="group flex items-baseline gap-4 border-b border-line py-4 font-display u-title text-ink transition-colors hover:text-anthracite"
                        style={courant ? { color: "var(--color-fil)" } : undefined}
                      >
                        <span
                          className="u-index w-7 shrink-0 text-xs"
                          style={{ color: courant ? "var(--color-fil)" : "var(--color-ink-muted)" }}
                        >
                          {item.num}
                        </span>
                        {item.label}
                      </motion.a>
                    );
                  })}
                  <a
                    href={"mailto:" + siteConfig.contactEmail}
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

      {/* CALE — l'en-tête est hors flux, ce vide tient sa place dans la
          colonne. 3.5rem (h-14) + 1px pour le filet inférieur : la mise en
          page reste au pixel près celle du sticky qu'il remplace. */}
      <div aria-hidden className="h-[calc(3.5rem+1px)]" />
    </>
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

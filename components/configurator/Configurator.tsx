"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { variants, partLabels } from "@/data/product";
import { useSelection } from "@/components/SelectionProvider";
import { track, getSource } from "@/lib/analytics";
import { siteConfig } from "@/config/site";
import { scrollToId } from "@/lib/scroll";
import { Button } from "@/components/ui/Button";

export function Configurator() {
  const { selectedId, variant, select } = useSelection();
  const startedRef = useRef(false);
  const reduce = useReducedMotion();

  const onChoose = (id: string) => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("configurator_started", { entry: id });
    }
    select(id, { from: "configurator" });
  };

  return (
    <section
      id="configurateur"
      aria-labelledby="configurateur-title"
      className="scroll-mt-6 bg-paper-deep/60 py-20 sm:py-28"
    >
      <div className="u-container">
        <div className="max-w-xl">
          <p className="u-eyebrow">Le configurateur</p>
          <h2 id="configurateur-title" className="mt-5 text-5xl sm:text-6xl">
            Choisissez ce qui la compose.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Sept associations de matières, éprouvées à l&apos;atelier. Chaque
            combinaison change le poids, le grain et la manière dont la lumière
            se pose.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
          {/* Aperçu de la variante sélectionnée */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="relative aspect-[780/689] w-full overflow-hidden rounded-sm bg-paper-pure ring-1 ring-line">
              {variants.map((v) => (
                <Image
                  key={v.id}
                  src={v.image}
                  alt={v.alt}
                  fill
                  sizes="(max-width: 1024px) 92vw, 42vw"
                  className={`object-contain p-4 ${
                    reduce ? "" : "transition-opacity duration-500 ease-out"
                  } ${v.id === selectedId ? "opacity-100" : "opacity-0"}`}
                  aria-hidden={v.id !== selectedId}
                />
              ))}
            </div>

            {/* Décomposition matière de la sélection */}
            <AnimatePresence mode="wait">
              <motion.dl
                key={variant.id}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4"
              >
                <MaterialRow label={partLabels.shade} value={variant.shade.label} color={variant.shade.color} />
                <MaterialRow label={partLabels.assembly} value={variant.assembly.label} color={variant.assembly.color} />
                <MaterialRow label={partLabels.base} value={variant.base.label} color={variant.base.color} />
                <MaterialRow label="Câble" value={variant.cable.label} color={variant.cable.color} />
              </motion.dl>
            </AnimatePresence>
          </div>

          {/* Choix des variantes (groupe radio accessible) */}
          <div
            role="radiogroup"
            aria-label="Combinaisons de matières"
            className="grid gap-3 sm:grid-cols-2"
          >
            {variants.map((v) => {
              const active = v.id === selectedId;
              return (
                <label
                  key={v.id}
                  className={`group relative flex cursor-pointer gap-4 rounded-none border p-4 transition-colors ${
                    active
                      ? "u-accent-border bg-paper-pure"
                      : "border-line/60 bg-paper-pure/40 hover:border-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="variant"
                    value={v.id}
                    checked={active}
                    onChange={() => onChoose(v.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-none border text-[0.6rem] ${
                      active ? "u-accent-bg border-transparent text-white" : "border-line text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-none bg-paper ring-1 ring-line">
                    <Image
                      src={v.image}
                      alt=""
                      fill
                      sizes="4rem"
                      className="object-contain p-1"
                    />
                  </span>
                  <span className="min-w-0 pr-6">
                    <span className="block font-display text-lg leading-tight text-ink">
                      {v.name}
                    </span>
                    <span className="mt-0.5 block text-xs uppercase tracking-wide text-ink-muted">
                      {v.materialsSummary}
                    </span>
                    <span className="mt-1.5 block text-sm leading-snug text-ink-soft">
                      {v.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              track("order_cta_click", {
                mode: siteConfig.purchaseMode,
                variant: selectedId,
                from: "configurator",
                source: getSource() ?? "direct",
              });
              scrollToId("commande");
            }}
          >
            Valider cette configuration
          </Button>
          <span className="text-sm text-ink-muted">
            Sélection : {variant.name}
          </span>
        </div>
      </div>
    </section>
  );
}

function MaterialRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-line pt-3">
      <span
        aria-hidden
        className="mt-0.5 h-4 w-4 shrink-0 rounded-none border border-ink/15"
        style={{ backgroundColor: color }}
      />
      <span>
        <span className="block text-xs uppercase tracking-wider text-ink-muted">
          {label}
        </span>
        <span className="block text-sm text-ink">{value}</span>
      </span>
    </div>
  );
}

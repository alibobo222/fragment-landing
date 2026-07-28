"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { variants, partLabels } from "@/data/product";
import { useSelection } from "@/components/SelectionProvider";
import { track } from "@/lib/analytics";
import { scrollToId } from "@/lib/scroll";
import { materialTexture } from "@/lib/materialSwatch";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LampStage } from "@/components/lamp/LampStage";

/**
 * Chapitre 3 — Explorer matières & configurations. L'atelier 3D (scène
 * interactive, sticky) réagit en douceur à la configuration choisie dans le
 * catalogue. Aucune notion d'achat : on invite à échanger autour de la pièce.
 */
export function Configurator() {
  const { selectedId, variant, select } = useSelection();
  const startedRef = useRef(false);

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
      className="scroll-mt-16 border-t border-line bg-white pt-4 pb-20"
    >
      <SectionHeading
        index="03"
        kicker="Le configurateur"
        id="configurateur-title"
        title="Composez votre pièce."
      />
      <div className="u-container">
        <Reveal delay={0.05}>
          <p className="mt-1 max-w-[50ch] text-sm leading-relaxed text-ink-soft">
            Sept associations de matières. Choisissez une combinaison : la lampe
            se met à jour en douceur. Faites-la tourner, allumez-la, changez la
            température de lumière.
          </p>
        </Reveal>

        {/* Atelier 3D. */}
        <div className="mt-8">
          <LampStage
            camera={[0.12, 0.14, 0.5]}
            fov={30}
            imageSizes="480px"
            className="aspect-square w-full overflow-hidden bg-white"
          />
        </div>

        {/* Décomposition matière de la configuration active. */}
        <div className="mt-6 flex items-baseline gap-3 border-t border-ink pt-4">
          <span className="u-index text-xs text-ink-muted">
            {variant.index} / 07
          </span>
          <p className="font-display text-xl leading-tight text-ink">{variant.name}</p>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-6">
          <MaterialRow label={partLabels.shade} finish={variant.shade} />
          <MaterialRow label={partLabels.base} finish={variant.base} />
          <MaterialRow label="Structure" finish={variant.assembly} />
          <MaterialRow label="Câble" finish={variant.cable} />
        </dl>

        {/* Catalogue des configurations (groupe radio accessible). */}
        <div
          role="radiogroup"
          aria-label="Configurations disponibles"
          className="mt-10 flex flex-col divide-y divide-line border-y border-line"
        >
          {variants.map((v) => {
            const active = v.id === selectedId;
            return (
              <motion.label
                key={v.id}
                whileTap={{ scale: 0.995 }}
                className={`group relative flex cursor-pointer items-center gap-4 py-4 transition-colors ${
                  active ? "bg-[#f6f5f1]" : "hover:bg-[#faf9f6]"
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
                  className={`h-14 w-[3px] shrink-0 transition-colors ${
                    active ? "u-accent-bg" : "bg-transparent"
                  }`}
                />
                <span className="relative h-14 w-14 shrink-0 overflow-hidden bg-white ring-1 ring-line">
                  <Image src={v.image} alt="" fill sizes="3.5rem" className="object-contain p-1" />
                </span>
                <span className="min-w-0 flex-1 pr-6">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="u-index text-[0.7rem] text-ink-muted">{v.index}</span>
                    <span className="font-display text-base leading-tight text-ink">{v.name}</span>
                  </span>
                  <span className="mt-2 flex items-center gap-1.5" aria-hidden>
                    {[v.shade, v.base, v.assembly, v.cable].map((f, i) => (
                      <span
                        key={i}
                        title={f.label}
                        className="h-3 w-3 ring-1 ring-ink/10"
                        style={{ backgroundColor: f.color }}
                      />
                    ))}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={`absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 transition-opacity ${
                    active ? "u-accent-bg opacity-100" : "opacity-0"
                  }`}
                />
              </motion.label>
            );
          })}
        </div>

        {/* Invitation à échanger (pas d'achat). */}
        <button
          type="button"
          onClick={() => {
            track("configurator_contact_click", { variant: selectedId });
            scrollToId("contact");
          }}
          className="group mt-10 inline-flex items-center gap-3 text-base font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="border-b border-ink pb-0.5">Échanger autour de cette pièce</span>
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
        </button>
      </div>
    </section>
  );
}

function MaterialRow({
  label,
  finish,
}: {
  label: string;
  finish: { label: string; color: string };
}) {
  const texture = materialTexture(finish.label);
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden ring-1 ring-ink/15"
        style={texture ? undefined : { backgroundColor: finish.color }}
      >
        {texture && <Image src={texture} alt="" fill sizes="1.75rem" className="object-cover" />}
      </span>
      <span className="min-w-0">
        <span className="u-eyebrow block">{label}</span>
        <span className="mt-1 block text-sm leading-snug text-ink">{finish.label}</span>
      </span>
    </div>
  );
}

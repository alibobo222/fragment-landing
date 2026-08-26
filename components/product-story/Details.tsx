import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { productSpecs } from "@/data/specs";

/**
 * Fiche technique — datasheet mono (nomenclature). Uniquement les données
 * réellement disponibles ; les champs non renseignés (`value: null` dans
 * `data/specs.ts`) sont filtrés à l'affichage, pas inventés. Le paragraphe
 * qui suit explique déjà qu'ils se précisent au cas par cas. Aucune donnée
 * commerciale.
 */
export function Details() {
  const specs = productSpecs.filter((spec) => spec.value !== null);
  return (
    <section id="details" aria-labelledby="details-title" className="scroll-mt-16 bg-white pt-4 pb-20">
      {/* Non épinglé (demandé) : le titre défile normalement avec le reste
          du chapitre. La révélation au scroll (même Reveal que le corps de
          section, juste en-dessous) crée le point de repère qui remplaçait
          l'épinglage — un temps d'arrêt à l'arrivée, pas un titre qui suit. */}
      <Reveal>
        <SectionHeading
          sticky={false}
          index="04"
          kicker="Fiche technique"
          id="details-title"
          title="Ce qu'il faut savoir."
        />
      </Reveal>
      <div className="u-container">
        <Reveal delay={0.05}>
          <dl className="mt-1 border-t border-ink">
            {specs.map((spec) => (
              <div
                key={spec.key}
                className="flex items-baseline justify-between gap-5 border-b border-line py-3.5"
              >
                <dt className="u-mono shrink-0 text-[0.72rem] uppercase tracking-[0.12em] text-ink-muted">
                  {spec.label}
                </dt>
                <dd className="u-mono text-right text-[0.82rem] text-ink">{spec.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-ink-muted">
            Certaines caractéristiques (dimensions, source lumineuse,
            alimentation) sont précisées au cas par cas selon la configuration,
            lors de votre prise de contact.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

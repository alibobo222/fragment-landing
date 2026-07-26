import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { productSpecs } from "@/data/product";

/**
 * Fiche technique — datasheet mono (nomenclature). Uniquement les données
 * réellement disponibles ; les champs non renseignés → « à venir » (aucune
 * valeur inventée). Aucune donnée commerciale.
 */
export function Details() {
  return (
    <section id="details" aria-labelledby="details-title" className="scroll-mt-16 pt-20 pb-20">
      <div className="u-container">
        <SectionHeading
          index="04"
          kicker="Fiche technique"
          id="details-title"
          title="Les faits, rien de plus."
        />

        <Reveal delay={0.05}>
          <dl className="mt-9 border-t border-ink">
            {productSpecs.map((spec) => (
              <div
                key={spec.key}
                className="flex items-baseline justify-between gap-5 border-b border-line py-3.5"
              >
                <dt className="u-mono shrink-0 text-[0.72rem] uppercase tracking-[0.12em] text-ink-muted">
                  {spec.label}
                </dt>
                <dd
                  className={`u-mono text-right text-[0.82rem] ${
                    spec.value ? "text-ink" : "text-ink-muted/60"
                  }`}
                >
                  {spec.value ?? "— à venir"}
                </dd>
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

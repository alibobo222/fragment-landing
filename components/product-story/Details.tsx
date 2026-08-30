import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { productSpecs } from "@/data/specs";
import { composer } from "@/lib/typographie";

/**
 * Fiche technique — datasheet mono (nomenclature). Uniquement les données
 * réellement disponibles ; les champs non renseignés (`value: null` dans
 * `data/specs.ts`) sont filtrés à l'affichage, pas inventés. Le paragraphe
 * qui suit explique déjà qu'ils se précisent au cas par cas. Aucune donnée
 * commerciale.
 */
export function Details() {
  // Un champ sans valeur reste masqué — on n'affiche pas une ligne vide. Sauf
  // s'il est marqué `pending` : la donnée est demandée à l'atelier, et le dire
  // vaut mieux que de laisser croire qu'elle n'existe pas.
  const specs = productSpecs.filter((spec) => spec.value !== null || spec.pending);
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
                {/* Composé au rendu : data/specs.ts reste écrit en
                    caractères ordinaires, lisible et modifiable. */}
                <dt className="u-mono shrink-0 text-[0.72rem] uppercase tracking-[0.12em] text-ink-muted">
                  {composer(spec.label)}
                </dt>
                <dd
                  className={`u-mono text-right text-[0.82rem] ${
                    spec.value === null ? "text-ink-muted" : "text-ink"
                  }`}
                >
                  {spec.value === null ? "En attente de l’atelier" : composer(spec.value)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-[36ch] text-sm leading-relaxed text-ink-muted">
            Certaines caractéristiques (poids, source lumineuse,
            alimentation) sont précisées au cas par cas selon la configuration,
            lors de votre prise de contact.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

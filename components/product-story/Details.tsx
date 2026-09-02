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
    <section id="details" aria-labelledby="details-title" className="sol-pierre scroll-mt-16 pb-12">
      {/* Non épinglé (demandé) : le titre défile normalement avec le reste
          du chapitre. La révélation au scroll (même Reveal que le corps de
          section, juste en-dessous) crée le point de repère qui remplaçait
          l'épinglage — un temps d'arrêt à l'arrivée, pas un titre qui suit. */}
      <Reveal>
        <SectionHeading
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
          {/* Information secondaire : elle commente la fiche, elle ne la
              complète pas. Corps réduit et italique la mettent au rang de
              note, et le rapprochement la rattache au tableau qu'elle
              commente — l'espace plus large qui la suit revient au bouton,
              qui est une action, pas une suite de lecture. */}
          <p className="mt-3 max-w-[36ch] text-xs italic leading-relaxed text-ink-muted">
            Certaines caractéristiques (poids, source lumineuse,
            alimentation) sont précisées au cas par cas selon la configuration,
            lors de votre prise de contact.
          </p>

          {/* Variante CLAIRE des boutons du site — `btn-glass-secondary`, la
              même famille que le CTA du configurateur, même géométrie. Son
              filet du système est très pâle (rgba(8,8,10,0.1)) : sur fond
              blanc un bouton blanc n'existe que par son filet, donc il est
              renforcé ICI seulement — avec `!`, car la classe pose `border`
              et l'emporte sur l'utilitaire — sans toucher la classe partagée que
              deux autres endroits utilisent.

              `download` plutôt qu'une simple ouverture : le fichier est un
              document à emporter, pas une page à consulter. Le PDF est
              produit au build depuis data/specs.ts — il ne peut pas diverger
              de la fiche affichée juste au-dessus. */}
          <a
            href="/documents/fiche-technique.pdf"
            download
            className="btn-glass btn-glass-secondary mt-6 inline-flex items-center gap-2.5 border-ink/55! px-6 py-3 text-[0.95rem] font-medium text-ink hover:border-ink/80!"
          >
            Télécharger la fiche technique
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12" />
              <path d="m7 11 5 5 5-5" />
              <path d="M5 20h14" />
            </svg>
          </a>
        </Reveal>
      </div>
    </section>
  );
}

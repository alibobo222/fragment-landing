import { Reveal } from "@/components/ui/Reveal";

/**
 * En-tête de section unifié — dispositif de « nomenclature » éditoriale :
 *   [index mono] ──────────── [étiquette mono]
 *   Grand titre monolithique
 *
 * Donne à chaque chapitre la même structure architecturale (cohérence forte,
 * lecture de catalogue / publication).
 */
export function SectionHeading({
  id,
  index,
  kicker,
  title,
  className = "",
}: {
  id?: string;
  index: string;
  kicker: string;
  title: React.ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <div className="flex items-center gap-4">
        <span className="u-index text-xs text-ink-muted">{index}</span>
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="u-eyebrow">{kicker}</span>
      </div>
      <h2 id={id} className="u-title mt-6">
        {title}
      </h2>
    </Reveal>
  );
}

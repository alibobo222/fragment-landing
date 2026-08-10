/**
 * En-tête de section unifié, **épinglé au scroll** (sticky) par défaut : le titre
 * du chapitre reste en haut pendant tout le défilement de sa section, puis se
 * libère naturellement à l'arrivée du chapitre suivant.
 *
 * Dispositif de « nomenclature » éditoriale :
 *   [index mono] ──────────── [étiquette mono]
 *   Grand titre monolithique
 *
 * ⚠️ À placer comme **enfant direct de `<section>`** (pas dans un sous-conteneur
 * qui se termine avant la fin de la section), sinon l'épinglage se libère trop
 * tôt. Fond blanc opaque : le contenu défile proprement dessous.
 *
 * `sticky={false}` libère les ~110 px qu'occupe le panneau en haut d'écran, au
 * profit d'un autre élément épinglé dans la même section. C'est le cas du
 * configurateur, dont la scène 3D doit rester visible pendant la sélection :
 * deux blocs épinglés se superposeraient, et c'est la lampe qui doit gagner.
 */
export function SectionHeading({
  id,
  index,
  kicker,
  title,
  className = "",
  sticky = true,
}: {
  id?: string;
  index: string;
  kicker: string;
  title: React.ReactNode;
  className?: string;
  /** Épingler le titre pendant la traversée de la section (défaut : `true`). */
  sticky?: boolean;
}) {
  return (
    <div
      className={`${sticky ? "sticky top-14 z-20 " : ""}bg-white pt-6 pb-5 ${className}`}
    >
      <div className="u-container">
        <div className="flex items-center gap-4">
          <span className="u-index text-xs text-ink-muted">{index}</span>
          <span aria-hidden className="h-px flex-1 bg-line" />
          <span className="u-eyebrow">{kicker}</span>
        </div>
        <h2 id={id} className="u-title mt-5">
          {title}
        </h2>
      </div>
    </div>
  );
}

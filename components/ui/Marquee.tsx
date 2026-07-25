/**
 * Bande de texte défilante (marquee) — accent « pop / moderne ».
 * Deux pistes identiques pour une boucle continue. L'animation est coupée
 * sous prefers-reduced-motion (la bande devient scrollable).
 */
export function Marquee({
  items,
  className = "",
}: {
  items: string[];
  className?: string;
}) {
  const Track = ({ hidden = false }: { hidden?: boolean }) => (
    <div className="u-marquee__track" aria-hidden={hidden || undefined}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-10">
          <span>{item}</span>
          <span className="u-accent-fg-dark" aria-hidden>
            ✦
          </span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={`u-marquee ${className}`}>
      <Track />
      <Track hidden />
    </div>
  );
}

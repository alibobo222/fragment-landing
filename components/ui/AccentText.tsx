/**
 * Mot d'accent d'un titre. Sa couleur reprend l'accent global `--accent`,
 * c.-à-d. la couleur dominante du modèle affiché dans le hero — et change donc
 * au rythme des sept compositions (et au survol/sélection d'une variante).
 * La transition douce est portée par la classe utilitaire `.u-accent-fg`.
 */
export function AccentText({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={`u-accent-fg ${className}`}>{children}</span>;
}

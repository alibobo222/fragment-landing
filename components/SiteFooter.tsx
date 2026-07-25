import { siteConfig } from "@/config/site";

const eyebrow =
  "text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-paper/45";

export function SiteFooter() {
  const year = 2026; // TODO: automatiser si besoin (évite un composant client pour une date).

  return (
    <footer className="bg-ink text-paper">
      {/* Grand wordmark d'impact */}
      <div className="u-container pt-16">
        <p className="font-display text-[clamp(3rem,13vw,10rem)] font-extrabold uppercase leading-[0.85] tracking-[-0.04em]">
          {siteConfig.brandName}
          <span className="u-accent-fg-dark">.</span>
        </p>
      </div>

      <div className="u-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="max-w-xs text-sm text-paper/70">{siteConfig.baseline}</p>
        </div>

        <nav aria-label="Pied de page">
          <p className={eyebrow}>Explorer</p>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li>
              <a href="#matieres" className="transition-colors hover:text-[var(--accent-on-dark)]">
                Les matières
              </a>
            </li>
            <li>
              <a href="#details" className="transition-colors hover:text-[var(--accent-on-dark)]">
                L&apos;objet
              </a>
            </li>
            <li>
              <a
                href="#configurateur"
                className="transition-colors hover:text-[var(--accent-on-dark)]"
              >
                Configurer ma lampe
              </a>
            </li>
          </ul>
        </nav>

        <div>
          <p className={eyebrow}>Contact</p>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li>
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="transition-colors hover:text-[var(--accent-on-dark)]"
              >
                {siteConfig.contactEmail}
              </a>
            </li>
            {siteConfig.instagramUrl && (
              <li>
                <a
                  href={siteConfig.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[var(--accent-on-dark)]"
                >
                  Instagram
                </a>
              </li>
            )}
          </ul>
        </div>

        <div>
          <p className={eyebrow}>Informations</p>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            {siteConfig.legalNoticeUrl ? (
              <li>
                <a
                  href={siteConfig.legalNoticeUrl}
                  className="transition-colors hover:text-[var(--accent-on-dark)]"
                >
                  Mentions légales
                </a>
              </li>
            ) : (
              <li className="italic text-paper/40">Mentions légales à venir</li>
            )}
            {siteConfig.privacyUrl ? (
              <li>
                <a
                  href={siteConfig.privacyUrl}
                  className="transition-colors hover:text-[var(--accent-on-dark)]"
                >
                  Confidentialité
                </a>
              </li>
            ) : (
              <li className="italic text-paper/40">Confidentialité à venir</li>
            )}
          </ul>
        </div>
      </div>

      <div className="u-container flex flex-col items-start justify-between gap-2 border-t border-paper/15 py-5 text-xs text-paper/50 sm:flex-row sm:items-center">
        <p>
          © {year} {siteConfig.brandName}. Pièce d&apos;atelier.
        </p>
        <a href="#configurateur" className="transition-colors hover:text-[var(--accent-on-dark)]">
          Revenir au configurateur ↑
        </a>
      </div>
    </footer>
  );
}

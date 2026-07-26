import Image from "next/image";
import { siteConfig } from "@/config/site";

const eyebrow = "text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-paper/45";
const link = "transition-colors hover:text-[var(--accent-on-dark)]";

export function SiteFooter() {
  const year = 2026;

  return (
    <footer className="bg-ink text-paper">
      {/* Logotype d'impact (FRAGMENT, en blanc). */}
      <div className="u-container pt-14">
        <Image
          src="/images/brand/fragment-wordmark.png"
          alt={siteConfig.brandName}
          width={777}
          height={180}
          className="h-auto w-full brightness-0 invert"
        />
        <p className="mt-4 font-display text-sm uppercase tracking-[0.3em] text-paper/50">
          {siteConfig.collectionName}
        </p>
        <p className="mt-4 max-w-xs text-sm text-paper/70">{siteConfig.baseline}</p>
      </div>

      <div className="u-container flex flex-col gap-10 py-12">
        <nav aria-label="Pied de page">
          <p className={eyebrow}>Explorer</p>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li><a href="#projet" className={link}>Le projet</a></li>
            <li><a href="#matieres" className={link}>Les matières</a></li>
            <li><a href="#configurateur" className={link}>Explorer les configurations</a></li>
            <li><a href="#contact" className={link}>Prendre contact</a></li>
          </ul>
        </nav>

        <div>
          <p className={eyebrow}>Contact</p>
          <ul className="mt-3 space-y-2 text-sm text-paper/70">
            <li>
              <a href={`mailto:${siteConfig.contactEmail}`} className={link}>
                {siteConfig.contactEmail}
              </a>
            </li>
            {siteConfig.instagramUrl && (
              <li>
                <a href={siteConfig.instagramUrl} target="_blank" rel="noopener noreferrer" className={link}>
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
              <li><a href={siteConfig.legalNoticeUrl} className={link}>Mentions légales</a></li>
            ) : (
              <li className="italic text-paper/40">Mentions légales à venir</li>
            )}
            {siteConfig.privacyUrl ? (
              <li><a href={siteConfig.privacyUrl} className={link}>Confidentialité</a></li>
            ) : (
              <li className="italic text-paper/40">Confidentialité à venir</li>
            )}
          </ul>
        </div>
      </div>

      <div className="u-container flex flex-col gap-2 border-t border-paper/15 py-5 text-xs text-paper/50">
        <p>© {year} {siteConfig.brandName}. Projet de design — pièce d&apos;atelier.</p>
        <a href="#top" className={link}>Retour en haut ↑</a>
      </div>
    </footer>
  );
}

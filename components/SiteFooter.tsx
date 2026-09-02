import Image from "next/image";
import { siteConfig } from "@/config/site";

const eyebrow = "text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-paper/45";
const link = "transition-colors hover:text-[var(--accent-on-dark)]";
const listeFr = new Intl.ListFormat("fr", { style: "long", type: "conjunction" });

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
        {/* Le cadre du projet, pas l'accroche : `baseline` reste réservée au
            <title> de la page, qu'un paragraphe rendrait illisible. */}
        <p className="mt-6 max-w-sm text-sm italic leading-relaxed text-paper/70">
          {siteConfig.projectStatement}
        </p>
      </div>

      <div className="u-container flex flex-col gap-10 py-12">

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

      <div className="u-container flex flex-col gap-2 border-t border-paper/15 py-6 text-xs text-paper/50">
        {/* COLOPHON — les auteurs, tout en bas, avant la mention de droits.
            Un cran plus clair que le reste de cette bande : les noms des
            personnes n'ont pas à être plus effacés que la ligne légale.
            Intl.ListFormat pose le « et » du français à la place du dernier
            séparateur — une concaténation à la main se serait trompée le jour
            où la liste change de longueur. */}
        <p className="text-paper/70">
          Un projet de {listeFr.format(siteConfig.authors)}.
        </p>
        <p>© {year} {siteConfig.brandName}. Projet de design — pièce d’atelier.</p>
        <a href="#top" className={link}>Retour en haut ↑</a>
      </div>
    </footer>
  );
}

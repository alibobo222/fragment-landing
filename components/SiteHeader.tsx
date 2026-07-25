import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="relative z-30">
      <div className="u-container flex items-center justify-between py-6">
        <a
          href="#top"
          className="group flex items-center gap-2 font-display text-lg font-extrabold uppercase tracking-[-0.02em] text-ink"
          aria-label={`${siteConfig.brandName}, retour en haut`}
        >
          {siteConfig.brandName}
          <span className="u-accent-bg inline-block h-2 w-2 transition-transform duration-200 group-hover:scale-150" />
        </a>

        <nav aria-label="Navigation principale">
          <ul className="flex items-center gap-6 text-sm font-medium text-ink-soft">
            <li className="hidden sm:block">
              <a href="#matieres" className="transition-colors hover:text-ink">
                Matières
              </a>
            </li>
            <li className="hidden sm:block">
              <a href="#details" className="transition-colors hover:text-ink">
                L&apos;objet
              </a>
            </li>
            <li>
              <a
                href="#configurateur"
                className="rounded-none bg-ink px-4 py-2 font-semibold text-paper transition-colors hover:bg-anthracite"
              >
                Je la veux
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

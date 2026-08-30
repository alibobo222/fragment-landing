import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Enveloppe des pages légales — mentions et confidentialité.
 *
 * Même grammaire que le reste du site : fond blanc, Overused Grotesk, aucune
 * carte, aucune ombre, uniquement les tokens de globals.css. La colonne est
 * volontairement étroite : ces textes se lisent en continu, pas en diagonale,
 * et une ligne trop longue s'y perd.
 *
 * `aria-labelledby` pointe le titre, comme les sections de la page d'accueil.
 */
export function PageLegale({
  id,
  titre,
  chapeau,
  children,
}: {
  /** Identifiant du titre, cible de l'aria-labelledby. */
  id: string;
  titre: string;
  /** Ligne d'introduction facultative (date de mise à jour, résumé). */
  chapeau?: string;
  children: ReactNode;
}) {
  return (
    <main className="bg-white">
      <section aria-labelledby={id} className="u-container py-16 md:py-24">
        <div className="max-w-[62ch]">
          <Link
            href="/"
            className="u-eyebrow inline-block text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Retour à l&apos;accueil
          </Link>

          <h1 id={id} className="u-title mt-6 text-ink">
            {titre}
          </h1>

          {chapeau && <p className="mt-3 text-sm text-ink-muted">{chapeau}</p>}

          <div className="mt-10 space-y-6 text-sm leading-relaxed text-ink-soft">
            {children}
          </div>

          <hr className="u-hairline mt-14" />
          <Link
            href="/"
            className="u-eyebrow mt-6 inline-block text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </section>
    </main>
  );
}

/** Titre de rubrique — même niveau visuel partout dans ces pages. */
export function TitreRubrique({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-base font-medium text-ink">{children}</h2>;
}

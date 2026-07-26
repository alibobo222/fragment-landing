"use client";

import { useSelection } from "@/components/SelectionProvider";
import { siteConfig } from "@/config/site";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ContactForm } from "@/components/contact/ContactForm";

/**
 * Contacter — dernier écran du parcours. Aucune logique d'achat : une invitation
 * sobre à échanger autour du projet. La configuration en cours est rappelée
 * comme simple contexte (sans prix).
 */
export function ContactSection() {
  const { variant } = useSelection();

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="scroll-mt-16 border-t border-ink bg-white pt-4 pb-20"
    >
      <SectionHeading
        index="05"
        kicker="Prendre contact"
        id="contact-title"
        title="Échangeons autour du projet."
      />
      <div className="u-container">
        <Reveal delay={0.05}>
          <p className="mt-1 max-w-[50ch] text-sm leading-relaxed text-ink-soft">
            FRAGMENT est un projet de design. Écrivez-nous pour découvrir la
            lampe, discuter d&apos;une configuration ou d&apos;une pièce
            d&apos;atelier sur mesure.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-9 flex items-baseline gap-3 border-y border-line py-3">
            <span className="u-eyebrow shrink-0">Réf.</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{variant.name}</span>
              <span className="u-caption block">{variant.materialsSummary}</span>
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-9">
            <ContactForm />
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 border-t border-line pt-6">
            <p className="u-eyebrow">Ou directement</p>
            <a
              href={`mailto:${siteConfig.contactEmail}`}
              className="mt-2 inline-block font-medium text-ink underline-offset-4 hover:underline"
            >
              {siteConfig.contactEmail}
            </a>
            {siteConfig.instagramUrl && (
              <a
                href={siteConfig.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-5 inline-block text-ink underline-offset-4 hover:underline"
              >
                Instagram
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

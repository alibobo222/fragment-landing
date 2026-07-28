import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealImage } from "@/components/ui/motion";

/**
 * Chapitre 3 — Ouverture « matières » : un visuel fort d'échantillons introduit
 * l'exploration. Textes existants, sans invention d'origine ni de certification.
 */
export function MaterialsIntro() {
  return (
    <section id="matieres" aria-labelledby="matieres-title" className="scroll-mt-16 bg-white pt-4 pb-20">
      <SectionHeading
        index="02"
        kicker="Les matières"
        id="matieres-title"
        title="La même forme. Un objet à chaque fois différent."
      />
      <div className="u-container">
        <Reveal delay={0.05}>
          <p className="mt-1 max-w-[50ch] text-sm leading-relaxed text-ink-soft">
            Le dessin ne change pas ; la matière, oui. Elle décide du poids
            perçu, de la température de la lumière et de la façon dont la pièce
            prend place dans un intérieur.
          </p>
        </Reveal>
      </div>

      <div className="u-container mt-8">
        <figure className="u-bleed">
          <div className="relative">
            <RevealImage
              src="/images/materiaux-echantillons.png"
              alt="Échantillons de matières : composites recyclés vert olive, béton clair, verre bleuté, coquilles sombres et brique."
              ratio="aspect-[770/536]"
              sizes="480px"
              unoptimized
            />
            {/* Crédit matière (partenaire), fond blanc du logo neutralisé. */}
            <Image
              src="/images/brand/etnisi.jpg"
              alt="ETNISI — [re]Starting Material"
              width={300}
              height={300}
              className="absolute bottom-3 right-3 z-10 h-11 w-11 mix-blend-multiply"
            />
          </div>
          <figcaption className="u-caption mt-3 px-[1.4rem]">
            — Échantillons · finitions issues de la gamme Wasterial® (matières
            recyclées). Chaque pièce garde ses variations naturelles.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

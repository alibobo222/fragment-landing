import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealImage } from "@/components/ui/motion";
import { MaterialsMarquee } from "@/components/chapters/MaterialsMarquee";

/**
 * Chapitre 3 — Ouverture « matières » : un visuel fort d'échantillons introduit
 * l'exploration. Textes existants, sans invention d'origine ni de certification.
 */
export function MaterialsIntro() {
  return (
    <section id="matieres" aria-labelledby="matieres-title" className="scroll-mt-16 bg-white pt-4 pb-10">
      {/* Titre NON épinglé : ce chapitre tient en trois phrases et une image.
          Un titre qui reste collé en haut d'écran a du sens quand la section est
          longue et qu'on risque d'oublier où l'on est — pas ici, où il ne fait
          que consommer 110 px de hauteur en permanence. */}
      <SectionHeading
        sticky={false}
        index="02"
        kicker="Les matières"
        id="matieres-title"
        title="La forme est constante. La matière change tout."
      />
      <div className="u-container">
        <Reveal delay={0.05}>
          <p className="mt-1 max-w-[50ch] text-sm leading-relaxed text-ink-soft">
            La lampe est fabriquée principalement à partir de Wasterial®
            d&apos;Etnisi, des matériaux composés de matières usagées et
            revalorisées : béton, pierre, brique, verre, sable…
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-ink-soft">
            Chaque matériau conserve quelque chose de son origine et lui
            donne sa propre couleur, son grain et sa texture. La forme reste
            la même, mais les combinaisons de couleurs et de textures lui
            donnent des expressions différentes. Des pièces d&apos;assemblage
            supplémentaires permettent ensuite de personnaliser et
            d&apos;enrichir chaque composition.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="mt-3 max-w-[50ch] text-sm leading-relaxed text-ink">
            Une même forme. Des possibilités multiples.
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
          {/* Bandeau défilant — collé à l'image des pots, AVANT sa légende
              (demandé) : reste un enfant de `<figure>`, mais `figcaption`
              demeure son dernier enfant, donc toujours reconnu comme la
              légende de la figure (règle HTML : premier OU dernier enfant).
              Aucune marge : le bandeau touche le bas de l'image. */}
          <MaterialsMarquee />
          <figcaption className="u-caption mt-3 px-[1.4rem]">
            — Échantillons · finitions issues de la gamme Wasterial® (matières
            recyclées). Chaque pièce garde ses variations naturelles.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

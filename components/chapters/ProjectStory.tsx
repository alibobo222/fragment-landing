import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { RevealImage } from "@/components/ui/motion";
import { ExplodedLampSection } from "@/components/chapters/ExplodedLampSection";

/**
 * Chapitre « Le projet » — la démarche de conception, racontée à travers ses
 * principes fondateurs, chacun accompagné de sa photographie. Séquence
 * éditoriale (esprit catalogue de design) : ouverture sur « Concevoir à partir
 * de l'existant », puis géométrie, fabrication, matières. Fond blanc, révélations
 * discrètes, pas de cartes.
 *
 * ⚠️ Rythme : le conteneur `flex flex-col gap-6` impose le MÊME espacement entre
 * chaque image et chaque bloc de texte (cohérence demandée).
 */

const SIZES = "(max-width: 480px) 100vw, 480px";

/** Bloc de texte d'un principe : étiquette mono + titre + court paragraphe. */
function Text({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="u-container">
      <Reveal>
        <p className="u-eyebrow">{eyebrow}</p>
        <h3 className="mt-2 text-lg leading-tight">{title}</h3>
        <p className="mt-2.5 max-w-[50ch] text-sm leading-relaxed text-ink-soft">
          {children}
        </p>
      </Reveal>
    </div>
  );
}

export function ProjectStory() {
  return (
    <section id="projet" aria-labelledby="projet-title" className="scroll-mt-16 bg-white pt-4 pb-20">
      {/* Non épinglé (demandé) : le titre défile normalement avec le reste
          du chapitre au lieu de rester fixé en haut d'écran pendant le scroll. */}
      <SectionHeading
        sticky={false}
        index="01"
        kicker="Le projet"
        id="projet-title"
        title="Concevoir à partir de l'existant."
      />

      {/* Espacement constant entre chaque élément (image ⇄ texte) : 24px (gap-6). */}
      <div className="mt-1 flex flex-col gap-6">
        {/* Ouverture — réemploi */}
        <div className="u-container">
          <Reveal>
            <p className="max-w-[50ch] text-sm leading-relaxed text-ink-soft">
              Plutôt que de partir d&apos;une matière neuve, la lampe s&apos;appuie
              sur ce qui existe déjà — une grille perforée standard, une chute, une
              pièce promise à une seconde vie. La contrainte du réemploi
              n&apos;est pas subie : elle oriente le dessin et donne à chaque
              exemplaire son caractère.
            </p>
          </Reveal>
        </div>

        {/* Vue générale — pièce ENTIÈRE (ratio portrait de la source, aucun rognage). */}
        <figure className="u-container">
          <RevealImage
            src="/images/chapter2/general.webp"
            alt="Vue générale de la lampe : cylindre incliné, plan de la grille et pied, jonctions apparentes."
            ratio="aspect-[3/4]"
            sizes={SIZES}
            imgClassName="object-contain"
            y={18}
            zoom={1.03}
          />
        </figure>

        {/* Géométrie */}
        <Text eyebrow="Un langage brutaliste" title="Jouer avec la géométrie">
          Le dessin part de volumes simples — un cylindre, un plan incliné, une
          découpe — assemblés sans détour. Rien n&apos;est ajouté pour décorer :
          ce sont les intersections, les proportions et les masses qui font
          l&apos;objet. Une grammaire brutaliste, réduite à l&apos;essentiel.
        </Text>

        {/* Croquis d'étude → objet */}
        <figure className="u-container">
          <RevealImage
            src="/images/chapter2/croquis.webp"
            alt="Lampe de profil devant son croquis d'étude au crayon : du dessin à l'objet."
            ratio="aspect-[933/821]"
            sizes={SIZES}
            imgClassName="object-cover object-center"
            y={18}
            zoom={1.03}
          />
        </figure>

        {/* Fabrication */}
        <Text eyebrow="Logique constructiviste" title="Simple à fabriquer, à assembler">
          Chaque pièce est pensée pour être facile à produire et à monter. Peu de
          composants, des jonctions lisibles, une logique de construction
          évidente. La forme naît autant des contraintes de l&apos;atelier que de
          l&apos;intention : fabriquer devient une manière de dessiner.
        </Text>

        {/* Vue éclatée 3D — pilotée par le scroll (remplace l'illustration). */}
        <ExplodedLampSection />

        {/* Matières */}
        <Text eyebrow="Dialogue de matières" title="Combiner matières et textures">
          L&apos;identité se joue dans le contact des matières : le mat contre le
          poli, le minéral contre le métal, la surface brute contre l&apos;âme
          veinée. Chaque association déplace légèrement le caractère de la lampe,
          sans jamais rompre la cohérence de la forme.
        </Text>

        {/* Détail nacre / grille */}
        <figure className="u-container">
          <RevealImage
            src="/images/chapter2/nacre.jpg"
            alt="Détail : intérieur en pierre veinée contre grille métallique perforée — contraste de textures."
            ratio="aspect-[4/3]"
            sizes={SIZES}
            imgClassName="object-cover object-center"
            y={18}
            zoom={1.03}
          />
        </figure>
      </div>
    </section>
  );
}

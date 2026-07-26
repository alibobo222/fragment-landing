import { Reveal } from "@/components/ui/Reveal";
import { RevealImage } from "@/components/ui/motion";

/**
 * Chapitre 2 — Présentation éditoriale de la lampe (esprit catalogue de mobilier
 * contemporain / publication de design). Composition d'après la maquette :
 *   1. grande photographie d'ouverture (vue générale)
 *   2. deux détails rapprochés côte à côte
 *   3. grande vue éclatée en clôture
 *
 * Le titre du chapitre reste « sticky » en haut pendant le défilement des images
 * et se retire naturellement à l'arrivée du chapitre suivant. Grille alignée,
 * gouttières régulières, fond blanc pur, animations discrètes (fade + montée +
 * parallaxe très légère), lazy-loading.
 */
export function ProjectStory() {
  return (
    <section
      id="projet"
      aria-labelledby="projet-title"
      className="scroll-mt-16 bg-white pb-24 pt-4"
    >
      {/* Titre fixé pendant l'exploration du chapitre. */}
      <div className="sticky top-16 z-20 bg-white pb-5 pt-6">
        <div className="u-container">
          <div className="flex items-center gap-4">
            <span className="u-index text-xs text-ink-muted">01</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
            <span className="u-eyebrow">Le projet</span>
          </div>
          <h2 id="projet-title" className="u-title mt-5">
            Une masse posée en déséquilibre.
          </h2>
        </div>
      </div>

      {/* Courte accroche — accompagne les images sans les concurrencer. */}
      <div className="u-container mt-4">
        <Reveal>
          <p className="max-w-[34ch] text-lg leading-relaxed text-ink-soft">
            Un cylindre coupé, incliné sur son socle. Rien n&apos;est caché :
            l&apos;assemblage fait partie du dessin.
          </p>
        </Reveal>
      </div>

      {/* 1 — Grande vue générale. */}
      <figure className="u-container mt-12">
        <RevealImage
          src="/images/chapter2/general.webp"
          alt="Vue générale de la lampe : abat-jour noir incliné, douille en inox, grille pliée et câble textile bleu."
          ratio="aspect-[4/3]"
          sizes="(max-width: 480px) 92vw, 450px"
          imgClassName="object-cover object-center"
          unoptimized
          y={24}
          zoom={1.05}
        />
      </figure>

      {/* 2 — Deux détails rapprochés, côte à côte (grille alignée). */}
      <div className="u-container mt-6 grid grid-cols-2 gap-3">
        <figure>
          <RevealImage
            src="/images/chapter2/profil.webp"
            alt="Profil de la lampe soulignant l'inclinaison de l'abat-jour sur le pied."
            ratio="aspect-[4/5]"
            sizes="(max-width: 480px) 44vw, 220px"
            imgClassName="object-cover object-center"
            unoptimized
            y={20}
            zoom={1.05}
          />
          <figcaption className="u-caption mt-2.5">— Profil</figcaption>
        </figure>
        <figure>
          <RevealImage
            src="/images/chapter2/nacre.jpg"
            alt="Détail rapproché : intérieur nacré marbré et grille métallique perforée."
            ratio="aspect-[4/5]"
            sizes="(max-width: 480px) 44vw, 220px"
            imgClassName="object-cover object-center"
            unoptimized
            y={20}
            zoom={1.05}
          />
          <figcaption className="u-caption mt-2.5">— Nacre &amp; grille</figcaption>
        </figure>
      </div>

      {/* 3 — Grande vue éclatée (technique), pleine largeur et agrandie. */}
      <figure className="u-container mt-14">
        <RevealImage
          className="u-bleed"
          src="/images/chapter2/eclate.webp"
          alt="Vue éclatée de la lampe : abat-jour à l'intérieur en bois, grille métallique pliée, ampoule et douille, pied minéral, câble bleu."
          ratio="aspect-square"
          sizes="(max-width: 480px) 100vw, 480px"
          imgClassName="object-cover"
          unoptimized
          y={24}
          zoom={1.03}
        />
        <figcaption className="u-caption mt-3">— Vue éclatée · trois volumes, une douille, un câble.</figcaption>
      </figure>
    </section>
  );
}

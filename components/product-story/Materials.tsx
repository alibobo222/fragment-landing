import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { variants } from "@/data/product";

/** Trois matières mises en avant pour illustrer l'effet du choix. */
const highlights = [
  {
    variantId: "porcelaine-acier-noir",
    title: "La porcelaine",
    text: "Une surface minérale, mate, qui absorbe la lumière et l'adoucit. Le grain reste franc, presque crayeux.",
  },
  {
    variantId: "coquille-laiton",
    title: "Le laiton",
    text: "Un métal chaud qui vieillit. Il capte les reflets et pose une ligne dorée dans la masse sombre.",
  },
  {
    variantId: "verre-bleu-acier-anodise",
    title: "Le verre",
    text: "Recyclé, poli, translucide par endroits. La couleur se lit dans l'épaisseur, jamais en surface.",
  },
];

export function Materials() {
  return (
    <section id="matieres" className="scroll-mt-16 py-24 sm:py-32">
      <div className="u-container">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="u-eyebrow">La matière</p>
              <h2 className="mt-5 max-w-2xl text-5xl sm:text-6xl">
                La même forme. Un objet à chaque fois différent.
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={0.1}>
              <p className="max-w-md text-lg leading-relaxed text-ink-soft">
                Le dessin ne change pas ; la matière, oui. Elle décide du poids
                perçu, de la température de la lumière et de la façon dont la
                pièce prend place dans un intérieur.
              </p>
            </Reveal>
          </div>
        </div>

        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {highlights.map((h, i) => {
            const v = variants.find((x) => x.id === h.variantId)!;
            return (
              <Reveal as="li" key={h.variantId} delay={0.05 * i}>
                <figure className="overflow-hidden rounded-sm bg-paper-pure ring-1 ring-line">
                  <div className="relative aspect-[4/3] w-full">
                    <Image
                      src={v.image}
                      alt={v.alt}
                      fill
                      sizes="(max-width: 768px) 92vw, 30vw"
                      className="object-contain p-4"
                    />
                  </div>
                </figure>
                <h3 className="mt-4 text-2xl">{h.title}</h3>
                <p className="mt-2 text-ink-soft">{h.text}</p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

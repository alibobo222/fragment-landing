import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";
import { productSpecs } from "@/data/product";
import { partLabels, partOrder } from "@/data/product";

export function Details() {
  return (
    <section id="details" className="scroll-mt-16 py-24 sm:py-32">
      <div className="u-container grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <figure className="overflow-hidden rounded-sm bg-paper-pure ring-1 ring-line">
            <div className="relative aspect-[528/534] w-full">
              <Image
                src="/images/prototype/eclate.webp"
                alt="Vue éclatée de la lampe Noir Minéral : abat-jour, grille métallique pliée, douille, pied et câble bleu séparés."
                fill
                sizes="(max-width: 1024px) 92vw, 46vw"
                className="object-contain p-4"
              />
            </div>
            <figcaption className="border-t border-line px-4 py-3 text-sm text-ink-muted">
              Trois volumes, une douille, un câble. Un assemblage lisible.
            </figcaption>
          </figure>
        </Reveal>

        <Reveal delay={0.1}>
          <p className="u-eyebrow">La construction</p>
          <h2 className="mt-5 text-5xl sm:text-6xl">Rien de superflu.</h2>

          <ul className="mt-8 flex flex-wrap gap-2">
            {partOrder.map((p) => (
              <li
                key={p}
                className="rounded-none border border-line px-3 py-1 text-sm uppercase tracking-wide text-ink-soft"
              >
                {partLabels[p]}
              </li>
            ))}
            <li className="rounded-none border border-line px-3 py-1 text-sm uppercase tracking-wide text-ink-soft">
              Câble textile
            </li>
          </ul>

          <dl className="mt-8 border-t border-line">
            {productSpecs.map((spec) => (
              <div
                key={spec.key}
                className="flex items-baseline justify-between gap-6 border-b border-line py-3.5"
              >
                <dt className="text-sm uppercase tracking-wider text-ink-muted">
                  {spec.label}
                </dt>
                <dd
                  className={`text-right ${
                    spec.value ? "text-ink" : "text-ink-muted/70 italic"
                  }`}
                >
                  {spec.value ?? "Information à venir"}
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-sm leading-relaxed text-ink-muted">
            Certaines caractéristiques (dimensions, source lumineuse,
            alimentation, délai) sont confirmées au cas par cas selon la
            configuration. Nous les précisons lors de votre demande.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

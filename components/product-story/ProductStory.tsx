import Image from "next/image";
import { Reveal } from "@/components/ui/Reveal";

export function ProductStory() {
  return (
    <section id="objet" className="u-container scroll-mt-24 py-24 sm:py-32">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-5">
          <Reveal>
            <p className="u-eyebrow">L&apos;objet</p>
            <h2 className="mt-5 text-5xl sm:text-6xl">
              Une masse posée{" "}
              <br />
              en déséquilibre.
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
              Un cylindre coupé, incliné sur son socle. L&apos;abat-jour bascule
              et retient la lumière ; l&apos;ouverture révèle l&apos;âme claire du
              volume. Rien n&apos;est caché : l&apos;assemblage fait partie du
              dessin.
            </p>
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-6">
              <div>
                <dt className="u-eyebrow">Silhouette</dt>
                <dd className="mt-1 text-ink">Inclinée, brutaliste</dd>
              </div>
              <div>
                <dt className="u-eyebrow">Diffusion</dt>
                <dd className="mt-1 text-ink">Directionnelle, chaude</dd>
              </div>
              <div>
                <dt className="u-eyebrow">Structure</dt>
                <dd className="mt-1 text-ink">Trois volumes assemblés</dd>
              </div>
              <div>
                <dt className="u-eyebrow">Geste</dt>
                <dd className="mt-1 text-ink">Assemblage manuel</dd>
              </div>
            </dl>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <Reveal className="col-span-2" delay={0.05}>
              <figure className="overflow-hidden rounded-sm bg-paper-pure ring-1 ring-line">
                <Image
                  src="/images/prototype/trois-quarts.webp"
                  alt="Vue de trois-quarts de la lampe Noir Minéral, abat-jour incliné et ampoule allumée révélant l'intérieur en bois."
                  width={1100}
                  height={2147}
                  sizes="(max-width: 1024px) 92vw, 46vw"
                  className="h-auto w-full object-cover"
                  style={{ aspectRatio: "16 / 13", objectPosition: "center 30%" }}
                />
              </figure>
            </Reveal>
            <Reveal delay={0.1}>
              <figure className="h-full overflow-hidden rounded-sm bg-paper-pure ring-1 ring-line">
                <Image
                  src="/images/prototype/profil.webp"
                  alt="Profil de la lampe soulignant l'inclinaison de l'abat-jour sur le pied."
                  width={1100}
                  height={1035}
                  sizes="(max-width: 1024px) 45vw, 23vw"
                  className="h-full w-full object-cover"
                />
              </figure>
            </Reveal>
            <Reveal delay={0.15}>
              <figure className="h-full overflow-hidden rounded-sm bg-paper-pure ring-1 ring-line">
                <Image
                  src="/images/prototype/assemblage.webp"
                  alt="Détail de la pièce d'assemblage métallique perforée et de la douille."
                  width={1100}
                  height={1100}
                  sizes="(max-width: 1024px) 45vw, 23vw"
                  className="h-full w-full object-cover"
                />
              </figure>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

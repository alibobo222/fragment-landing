import { Reveal } from "@/components/ui/Reveal";

const steps = [
  {
    n: "01",
    title: "Choisir la finition",
    text: "Vous composez la pièce dans le configurateur : abat-jour, métal, câble.",
  },
  {
    n: "02",
    title: "Valider la configuration",
    text: "Vous nous transmettez votre choix. Nous confirmons ensemble les détails et la disponibilité.",
  },
  {
    n: "03",
    title: "Fabrication & remise",
    text: "La pièce est assemblée à l'atelier, puis préparée pour vous être remise.",
  },
];

export function Reassurance() {
  return (
    <section aria-labelledby="parcours-title" className="u-container py-24 sm:py-32">
      <Reveal>
        <p className="u-eyebrow">Le déroulé</p>
        <h2 id="parcours-title" className="mt-5 max-w-xl text-5xl sm:text-6xl">
          Trois étapes, sans détour.
        </h2>
      </Reveal>

      <ol className="mt-16 grid gap-8 md:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.n} delay={0.05 * i} className="border-t border-ink pt-6">
            <span className="block font-display text-5xl font-extrabold leading-none text-ink">{s.n}</span>
            <h3 className="mt-4 text-2xl">{s.title}</h3>
            <p className="mt-2 text-ink-soft">{s.text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  variants,
  type PartFinish,
  type ProductVariant,
} from "@/data/product";
import { useSelection } from "@/components/SelectionProvider";
import { track } from "@/lib/analytics";
import { scrollToId } from "@/lib/scroll";
import { materialTexture } from "@/lib/materialSwatch";
import { splitFinishLabel, capitalise } from "@/lib/materialLabel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LampStage } from "@/components/lamp/LampStage";
import { buttonMotion } from "@/components/ui/motion";
import { ProductThumb } from "@/components/ui/ProductThumb";

/**
 * Chapitre 3 — Explorer matières & configurations.
 *
 * ⚠️ DISPOSITION — UN SEUL sélecteur, juste sous la scène 3D, et la fiche de la
 * configuration active immédiatement en dessous.
 *
 * Historique de la décision : le catalogue vertical d'origine commençait ~590 px
 * sous le bas de la scène sur un téléphone, donc au moment du choix la lampe
 * était hors champ et le fondu-enchaîné de `LampStage` se jouait dans le vide.
 * Une première correction a ajouté une rangée horizontale épinglée sous la
 * scène — mais elle faisait alors DOUBLON avec le catalogue vertical (le même
 * choix, offert deux fois, à deux endroits). Le catalogue vertical a donc été
 * supprimé et ses informations remontées ici.
 *
 * Ce cartel a ensuite été RÉDUIT à l'essentiel : le nom de la configuration et
 * un nuancier (un carré, une couleur, son intitulé). La phrase sensorielle et
 * la nomenclature matière sur deux colonnes ont disparu — elles doublaient le
 * carré et la scène 3D, et la hauteur qu'elles occupaient revient à la lampe,
 * qui devient le point focal de la section.
 */
export function Configurator() {
  const { selectedId, variant, select } = useSelection();
  const reduce = useReducedMotion();
  const startedRef = useRef(false);

  const onChoose = (id: string) => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("configurator_started", { entry: id });
    }
    select(id, { from: "configurator" });
  };

  return (
    <section
      id="configurateur"
      aria-labelledby="configurateur-title"
      // pt-1 et non pt-4 : trois marges s'additionnaient à cette jonction —
      // le bas du chapitre précédent, le haut de celui-ci, et le pt-6 du titre
      // de section. Près de 120 px de vide pour une simple respiration entre
      // deux chapitres. Réduites ensemble, elles en laissent environ 65.
      className="scroll-mt-16 bg-white pt-1 pb-12"
    >
      {/* Titre NON épinglé : la place en haut d'écran revient à la scène 3D. */}
      <SectionHeading
        sticky={false}
        index="03"
        kicker="Le configurateur"
        id="configurateur-title"
        title="Composez votre pièce."
      />
      {/* ---------- Cartel : le nom, puis le nuancier ----------
          Le nom de la configuration tient lieu de titre courant : il change
          avec la sélection et légende la scène qui le suit.

          ⚠️ CE BLOC NE PORTE PLUS DE TEXTE DESCRIPTIF, et c'est délibéré.
          Il contenait une phrase sensorielle (« un noir brut et mat… ») et une
          nomenclature matière sur deux colonnes, chaque ligne répétant en toutes
          lettres ce que la pastille montrait déjà. Trois registres — nom, récit,
          nomenclature — se disputaient la lecture AVANT l'objet, et repoussaient
          la lampe de près de 200 px vers le bas.
          Ne reste que le nuancier : un carré, une couleur, son intitulé. La
          matière se voit dans la texture du carré et dans la scène 3D ; l'écrire
          en plus était une redite. */}
      <div className="u-container">
        <motion.div
          key={variant.id}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* ⚠️ PAS de repère mono ici. « 01 / 07 » reprenait exactement le
              dispositif du titre de chapitre — index mono, filet, étiquette —
              placé quelques pixels plus bas : deux en-têtes de même facture se
              disputaient la lecture. Et l'information était déjà donnée deux
              fois, puisque le sélecteur affiche son numéro sous chaque vignette.
              Reste le nom seul, dans un corps nettement inférieur au titre de
              chapitre : il se lit alors comme la LÉGENDE de la scène, pas comme
              un second titre. */}
          <p className="-mt-3 font-display text-[1.35rem] leading-tight text-ink">
            {variant.name}
          </p>
          {/* Nuancier — la liste des couleurs et matières de la composition,
              rien d'autre. Pas de nom de pièce : l'objet est juste en dessous,
              on voit où va chaque matière. Empilés plutôt que rangés sur deux
              colonnes, les carrés forment une bande étroite et régulière qui
              n'entre jamais en concurrence avec la scène : la largeur libérée
              revient à la lampe. */}
          <ul className="mt-4 space-y-2.5">
            {colorKey(variant).map((entry) => (
              <ColorSwatch key={entry.finish.label} entry={entry} />
            ))}
          </ul>
        </motion.div>
      </div>

      {/* ---------- Scène et sélecteur ----------
          ⚠️ CE BLOC N'EST PLUS ÉPINGLÉ, et c'est volontaire.
          L'épinglage servait à garder la lampe visible pendant qu'on parcourait
          un long catalogue placé EN DESSOUS. Ce catalogue a disparu, puis le nom,
          la description et la composition matière sont remontés au-dessus de la
          scène : il ne reste plus rien à faire défiler sous elle, sinon le bouton
          de contact — qui passait donc dessous et disparaissait.
          Un bloc épinglé sans contenu à survoler ne rend aucun service et masque
          ce qui le suit. Le retirer règle le défaut sans rien compenser. */}
      <div className="mt-1 bg-white pb-4">
        {/* ⚠️ HAUTEUR FIXE, LARGEUR LIBRE — et c'est tout le point.
            La boîte était `aspect-square max-w-[40svh] overflow-hidden` : un carré
            d'environ 296 px dans une colonne qui en fait 480. Le câble, qui
            s'étale latéralement, était donc coupé par le CSS — pas par la 3D.
            `u-bleed` annule la gouttière pour occuper toute la largeur utile.

            La focale d'une caméra perspective étant VERTICALE, la HAUTEUR de la
            boîte fixe à elle seule la taille apparente de la lampe : on est passé
            de 40svh à 54svh, soit un objet ~35 % plus grand, sans toucher ni à la
            caméra ni au modèle. La place vient du cartel, allégé de sa phrase
            descriptive et de sa nomenclature matière.
            ⚠️ NE PAS monter plus haut sans vérifier le rendu : au-delà d'environ
            56svh le champ latéral se resserre au point de rogner l'abat-jour, la
            largeur visible valant hauteur × (largeur/hauteur de boîte). */}
        <div className="u-container">
          <LampStage
            camera={[0.12, 0.14, 0.5]}
            fov={30}
            imageSizes="480px"
            className="u-bleed h-[54svh] bg-white"
          />
        </div>
        <VariantPicker selectedId={selectedId} onChoose={onChoose} />
      </div>

      {/* ---------- Invitation à échanger (pas d'achat) ---------- */}
      <div className="u-container">
        <motion.button
          type="button"
          {...buttonMotion}
          onClick={() => {
            track("configurator_contact_click", { variant: selectedId });
            scrollToId("contact");
          }}
          className="btn-glass btn-glass-secondary group mt-6 inline-flex items-center gap-2.5 px-6 py-3 text-[0.95rem] font-medium"
        >
          <span>Échanger autour de cette pièce</span>
          <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1.5">→</span>
        </motion.button>
      </div>
    </section>
  );
}

/**
 * Sélecteur unique — rangée horizontale à défilement « snap », collée sous la
 * scène 3D dans le bloc épinglé. C'est LE geste de sélection : il tient sur une
 * ligne, se parcourt au pouce, et garantit que la lampe est visible au moment
 * du choix. Groupe radio natif : navigation clavier par les flèches, focus
 * visible sur la vignette (l'input lui-même est masqué).
 */
function VariantPicker({
  selectedId,
  onChoose,
}: {
  selectedId: string;
  onChoose: (id: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLLabelElement>(null);
  const fadeLeftRef = useRef<HTMLDivElement>(null);
  const fadeRightRef = useRef<HTMLDivElement>(null);

  // DÉBORDEMENT — la rangée contient sept vignettes pour une colonne qui en
  // affiche quatre ou cinq, et sa barre de défilement est masquée : rien ne
  // signalait qu'il y avait une suite. Un dégradé apparaît donc du côté où du
  // contenu reste hors champ, et disparaît en bout de course. L'indice est
  // HONNÊTE — il ne s'affiche jamais s'il n'y a rien de plus à voir — et il
  // évite d'ajouter des flèches ou une barre, qui alourdiraient l'interface.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => {
      const max = row.scrollWidth - row.clientWidth;
      const x = row.scrollLeft;
      if (fadeLeftRef.current)
        fadeLeftRef.current.style.opacity = String(Math.min(1, x / 24));
      if (fadeRightRef.current)
        fadeRightRef.current.style.opacity = String(
          Math.min(1, Math.max(0, max - x) / 24)
        );
    };
    update();
    row.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  // Recentre la vignette active quand la sélection vient d'ailleurs (clavier,
  // restauration de session). Défilement HORIZONTAL uniquement : on pilote
  // `scrollLeft` de la rangée, jamais `scrollIntoView`, qui ferait aussi défiler
  // la page verticalement et volerait le contrôle à l'utilisateur.
  useEffect(() => {
    const row = rowRef.current;
    const el = activeRef.current;
    if (!row || !el) return;
    const target = el.offsetLeft - (row.clientWidth - el.clientWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [selectedId]);

  return (
    <div className="relative">
      {/* Dégradés de débordement, gauche et droite. */}
      <div
        ref={fadeLeftRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white to-transparent"
        style={{ opacity: 0 }}
      />
      <div
        ref={fadeRightRef}
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white to-transparent"
        style={{ opacity: 0 }}
      />
      <div
      ref={rowRef}
      role="radiogroup"
      aria-label="Configurations disponibles"
      className="mt-[7.5rem] flex snap-x snap-mandatory gap-1 overflow-x-auto px-[0.9rem] pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {variants.map((v) => {
        const active = v.id === selectedId;
        return (
          <label
            key={v.id}
            ref={active ? activeRef : undefined}
            className={`group relative shrink-0 cursor-pointer snap-center px-2 pt-2 pb-1 transition-colors duration-200 ${
              active ? "bg-ink/[0.035]" : "hover:bg-ink/[0.02]"
            }`}
          >
            <input
              type="radio"
              name="variant"
              value={v.id}
              checked={active}
              onChange={() => onChoose(v.id)}
              className="peer sr-only"
            />
            {/* AUCUN cadre. Les packshots sont détourés sur blanc : posés à
                même le fond de l'interface, ils se lisent comme des objets et
                non comme des cartes. L'état actif ne tient plus qu'à DEUX
                signaux — pleine opacité et barre d'accent — au lieu des quatre
                d'avant (opacité, cadre noir, accent, numéro), qui se répétaient
                sans rien ajouter. */}
            <span
              className={`relative block h-16 w-16 transition-opacity duration-300 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${
                active ? "opacity-100" : "opacity-55 group-hover:opacity-90"
              }`}
            >
              <ProductThumb variant={v} sizes="4rem" />
            </span>
            {/* Barre d'accent : couleur dominante de la configuration
                (var CSS `--accent`, diffusée par le SelectionProvider). */}
            <span
              aria-hidden
              className={`mt-2 block h-[2px] w-full transition-colors ${
                active ? "u-accent-bg" : "bg-transparent"
              }`}
            />
            {/* Repère de nomenclature — situe la configuration dans la série. */}
            <span
              aria-hidden
              className="u-index mt-1.5 block text-center text-[0.62rem] text-ink-muted"
            >
              {v.index}
            </span>
            {/* Nom accessible du bouton radio (l'image est décorative). */}
            <span className="sr-only">
              Configuration {v.index} — {v.name}. {v.materialsSummary}.
            </span>
          </label>
        );
      })}
      </div>
    </div>
  );
}

/**
 * Intitulé de pièce à retirer du libellé de finition. `data/product.ts` décrit
 * le câble par un libellé autonome — « Câble textile bleu » — parce qu'il sert
 * aussi seul ailleurs. Dans un nuancier, seule la couleur nous intéresse :
 * « Bleu ». Les autres pièces nomment déjà une matière (« Acier brut »,
 * « Porcelaine »), il n'y a rien à retirer.
 */
const CABLE_PART = "Câble textile";

interface ColorEntry {
  finish: PartFinish;
  /** Libellé affiché — matière ou couleur, jamais un nom de pièce. */
  label: string;
}

/**
 * Les couleurs et matières de la composition, dans l'ordre de lecture de
 * l'objet : abat-jour, son intérieur s'il diffère, structure, pied, câble.
 *
 * DÉDOUBLONNÉ, et c'est nécessaire depuis que les intitulés de pièce ont
 * disparu. Plusieurs configurations emploient la même matière pour l'abat-jour
 * et le pied ; sans nom de pièce pour les distinguer, deux lignes rigoureusement
 * identiques se seraient suivies et auraient passé pour un défaut. Un nuancier
 * liste des matières, pas des pièces : chacune n'y figure qu'une fois.
 */
function colorKey(variant: ProductVariant): ColorEntry[] {
  const parts: { finish?: PartFinish; part?: string }[] = [
    { finish: variant.shade },
    { finish: variant.shadeInner },
    { finish: variant.assembly },
    { finish: variant.base },
    { finish: variant.cable, part: CABLE_PART },
  ];
  const seen = new Set<string>();
  const entries: ColorEntry[] = [];
  for (const { finish, part } of parts) {
    if (!finish || seen.has(finish.label)) continue;
    seen.add(finish.label);
    const split = part ? splitFinishLabel(part, finish.label) : null;
    entries.push({
      finish,
      label: split?.suffix ? capitalise(split.suffix) : finish.label,
    });
  }
  return entries;
}

/**
 * Un carré, sa couleur ou sa matière — rien d'autre.
 *
 * Le carré montre, l'intitulé nomme : texture réelle quand elle existe dans
 * /public/textures, aplat de la couleur du produit sinon. Le libellé vient de
 * `data/product.ts`, seule source de vérité des matières, débarrassé du seul
 * nom de pièce qui s'y glissait (voir `CABLE_PART`).
 */
function ColorSwatch({ entry }: { entry: ColorEntry }) {
  const texture = materialTexture(entry.finish.label);
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        // Seul cerne conservé de toute la section, parce qu'il a une utilité :
        // sans lui, un carré clair (porcelaine, béton clair) n'aurait aucune
        // limite sur le fond blanc.
        className="relative block h-[1.4rem] w-[1.4rem] shrink-0 overflow-hidden ring-1 ring-ink/10"
        style={texture ? undefined : { backgroundColor: entry.finish.color }}
      >
        {texture && <Image src={texture} alt="" fill sizes="1.4rem" className="object-cover" />}
      </span>
      <span className="text-sm leading-snug text-ink">{entry.label}</span>
    </li>
  );
}

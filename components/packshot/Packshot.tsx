"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { variants } from "@/data/product";
import * as DA from "@/config/packshot";
import type { PartVariants } from "@/components/hero/Lamp3D";

// Le MÊME composant 3D que le configurateur : matières, textures, tôle perforée
// et éclairage de studio sont ceux du produit, pas une reconstitution.
const Lamp3D = dynamic(
  () => import("@/components/hero/Lamp3D").then((m) => m.Lamp3D),
  { ssr: false }
);

/**
 * Vignette de configuration — packshot 3D.
 *
 * Ne contient AUCUN réglage propre : caméra, focale, angle, échelle, marges,
 * fond et état lumineux viennent tous de `config/packshot.ts`. Le seul paramètre
 * est l'index de la configuration, qui ne change que les matières.
 *
 * La rotation automatique et les contrôles souris sont désactivés : une vignette
 * doit être reproductible à l'identique, or une scène qui tourne ne l'est pas.
 */
export function Packshot({ index }: { index: number }) {
  const [ready, setReady] = useState(false);
  const i = Math.max(0, Math.min(variants.length - 1, index));
  const parts: PartVariants = { shade: i, connector: i, base: i, cable: i };

  // Marqueur lu par le script de génération : il attend cet attribut avant de
  // capturer, plutôt qu'une temporisation arbitraire.
  useEffect(() => {
    if (ready) document.documentElement.dataset.packshotReady = "1";
  }, [ready]);

  // Note sur onMaterialsSettled (et pas seulement onCreated, plus bas) : le
  // canvas WebGL créé ne suffit pas — la config 02 (Renature) déclenche un
  // chargement d'image ASYNCHRONE pour l'intérieur de l'abat-jour (voir
  // lib/lampTextures.ts, applyInteriorVeneer). Sans attendre sa résolution,
  // la capture peut avoir lieu avant OU après que la texture soit posée :
  // deux vignettes possibles pour la même configuration, découvert en
  // comparant deux générations successives octet pour octet.

  return (
    <div
      style={{
        width: DA.SIZE,
        height: DA.SIZE,
        background: DA.BACKGROUND,
        overflow: "hidden",
      }}
    >
      <Lamp3D
        partVariants={parts}
        spin={false}
        controls={false}
        lampOn={DA.LAMP_ON}
        kelvin={DA.KELVIN}
        camera={DA.CAMERA}
        fov={DA.FOV}
        onMaterialsSettled={() => setReady(true)}
      />
    </div>
  );
}

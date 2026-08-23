"use client";

import { useCallback, useEffect, useState } from "react";
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
  // Précharge Renature AVANT de monter la scène 3D — voir le commentaire
  // détaillé plus bas. Vaut `true` d'office pour les configurations qui n'en
  // ont pas besoin (rien à attendre) ; le seul rôle de cet état est de
  // retarder le montage de <Lamp3D> le temps du chargement, sur TOUTES les
  // configurations, sans dupliquer ici la logique de sélection du placage
  // (isConfig01 / id === "porcelaine-acier-noir") qui vit dans Lamp3D.tsx.
  const [renaturePreloaded, setRenaturePreloaded] = useState(false);
  const i = Math.max(0, Math.min(variants.length - 1, index));
  const parts: PartVariants = { shade: i, connector: i, base: i, cable: i };

  // Marqueur lu par le script de génération : il attend cet attribut avant de
  // capturer, plutôt qu'une temporisation arbitraire.
  useEffect(() => {
    if (ready) document.documentElement.dataset.packshotReady = "1";
  }, [ready]);

  /**
   * PRÉCHARGEMENT RENATURE — corrige la cause, pas le symptôme.
   *
   * `applyInteriorVeneer("renature")` (lib/lampTextures.ts) pose la
   * porcelaine nue puis remplace la texture une fois l'image chargée — un
   * aller-retour normalement invisible, MASQUÉ dès que `renatureTex` est déjà
   * en cache (l'appel devient alors synchrone, voir ce fichier). Le problème
   * n'était donc pas seulement le premier chargement : React (StrictMode
   * double-invoque les effets en dev, y compris pendant `npm run packshots`,
   * qui shoote contre le serveur de DEV) pouvait réappliquer cet aller-retour
   * PENDANT que le premier était encore en vol, avec un timing qui variait
   * d'une exécution à l'autre — vignette non déterministe, découverte en
   * comparant deux générations successives octet pour octet.
   *
   * En déclenchant le chargement ICI, avant même de monter <Lamp3D>, la
   * scène ne voit JAMAIS `applyInteriorVeneer` pendant que Renature est en
   * vol : `renatureTex` est déjà posé au tout premier appel, qui l'applique
   * alors directement (branche synchrone). Plus d'aller-retour à figer au
   * mauvais moment, sur AUCUNE configuration.
   *
   * Déclenché pour toutes les configurations, pas seulement config 02 : le
   * chargement est mémoïsé (loadRenatureTexture), donc sans coût pour les
   * autres — et ça évite de dupliquer ici la logique de sélection du
   * placage.
   */
  useEffect(() => {
    let cancelled = false;
    import("@/lib/lampTextures").then((m) =>
      m.loadRenatureTexture().then(() => {
        if (!cancelled) setRenaturePreloaded(true);
      })
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Note sur onMaterialsSettled (et pas seulement onCreated, plus bas) : le
  // canvas WebGL créé ne suffit pas — voir le commentaire de préchargement
  // ci-dessus pour le mécanisme complet. Ce callback reste un filet de
  // sécurité pour toute future matière chargée en asynchrone qui ne serait
  // pas préchargée de la même façon.
  //
  // useCallback est nécessaire : ce callback est une dépendance de l'effet
  // qui appelle applyInteriorVeneer (LampModel, Lamp3D.tsx) ; une fonction
  // fléchée inline changerait d'identité à chaque rendu et redéclencherait
  // cet effet sans raison.
  const onMaterialsSettled = useCallback(() => setReady(true), []);

  if (!renaturePreloaded) return null;

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
        onMaterialsSettled={onMaterialsSettled}
      />
    </div>
  );
}

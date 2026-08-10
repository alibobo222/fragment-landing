"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProductVariant } from "@/data/product";

/** Chemin de la vignette générée par `npm run packshots`. */
export function packshotSrc(id: string): string {
  return `/images/variants/packshot/${id}.webp`;
}

/**
 * Vignette d'une configuration.
 *
 * Affiche en priorité le PACKSHOT généré depuis la scène 3D — même caméra, même
 * cadrage, même éclairage pour les sept, donc comparables au pixel près. Tant
 * que ces images n'ont pas été générées, elle retombe silencieusement sur
 * l'ancienne image éditoriale : le site reste fonctionnel entre les deux états,
 * et bascule tout seul dès que les fichiers existent.
 *
 * Pas de `object-contain` ici : les packshots portent déjà leurs marges, fixées
 * une fois pour toutes par la DA. Les faire « tenir » à nouveau dans la boîte
 * rendrait l'échelle dépendante du contenu de chaque fichier — c'est exactement
 * ce qui donnait aux anciennes vignettes des tailles apparentes différentes.
 */
export function ProductThumb({
  variant,
  sizes,
  className = "",
}: {
  variant: ProductVariant;
  sizes: string;
  className?: string;
}) {
  const [fallback, setFallback] = useState(false);
  const src = fallback ? variant.image : packshotSrc(variant.id);
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes={sizes}
      onError={() => setFallback(true)}
      className={`${fallback ? "object-contain p-1" : "object-cover"} ${className}`}
    />
  );
}

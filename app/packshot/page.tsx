"use client";

import { useEffect, useState } from "react";
import { Packshot } from "@/components/packshot/Packshot";
import { variants } from "@/data/product";

/**
 * Route de GÉNÉRATION des vignettes — outil interne, pas une page du site.
 *
 * Elle n'existe que pour être photographiée par `npm run packshots`. Elle est
 * neutralisée sauf si `NEXT_PUBLIC_PACKSHOT=1`, si bien que l'export statique de
 * production ne publie qu'une page vide — aucune route API, aucun runtime, la
 * contrainte d'export 100 % statique est respectée.
 *
 * Deux usages :
 *   /packshot?v=<id>  → une seule configuration, plein cadre (capture)
 *   /packshot         → les sept côte à côte (contrôle visuel de la DA)
 */
/** L'indicateur de developpement de Next se dessine PAR-DESSUS la page : sans
 *  cela il finit photographie dans le coin des vignettes. */
function HideDevOverlay() {
  return (
    <style>{`nextjs-portal, [data-nextjs-toast] { display: none !important; }
      html, body { margin: 0; padding: 0; background: #fff; }`}</style>
  );
}

export default function PackshotPage() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("v"));
  }, []);

  if (process.env.NEXT_PUBLIC_PACKSHOT !== "1") return null;

  if (id) {
    const i = variants.findIndex((v) => v.id === id);
    return (
      <>
        <HideDevOverlay />
        <Packshot index={i < 0 ? 0 : i} />
      </>
    );
  }

  // Planche de contrôle : les sept vignettes alignées. En passant de l'une à
  // l'autre du regard, la lampe doit rester rigoureusement immobile — seules ses
  // matières changent.
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, background: "#e8e6e1", padding: 8 }}>
      {variants.map((v, i) => (
        <div key={v.id} style={{ transform: "scale(0.5)", transformOrigin: "top left", width: 256, height: 256 }}>
          <Packshot index={i} />
        </div>
      ))}
    </div>
  );
}

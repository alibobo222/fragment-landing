import { describe, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computePackshotManifest } from "../scripts/packshot-manifest.mjs";

/**
 * FRAÎCHEUR DES VIGNETTES DE CONFIGURATION.
 *
 * public/images/variants/packshot/*.webp est un rendu FIGÉ du moteur 3D,
 * généré une fois par `npm run packshots` (scripts/render-packshots.mjs) — pas
 * un composant vivant : la règle « un seul contexte WebGL à la fois » de
 * CLAUDE.md interdit sept scènes 3D simultanées dans le sélecteur.
 *
 * Ce test ne régénère RIEN — aucun Playwright, aucun serveur, aucun GPU, donc
 * aucune raison de ne pas tourner dans `npm run test` et la CI. Il recalcule
 * juste l'empreinte des entrées qui déterminent ce rendu (voir
 * scripts/packshot-manifest.mjs pour la liste et pourquoi) et la compare à
 * celle enregistrée dans tests/packshot-manifest.json au dernier
 * `npm run packshots`. La détection est automatique ; la régénération reste
 * manuelle et locale — c'est le partage voulu, pas un oubli.
 *
 * Douze jours de dérive silencieuse ont précédé ce test (GLB régénéré, matières
 * passées à un type explicite, Renature et corten ajoutés) sans que rien ne le
 * signale : les vignettes montraient une lampe qui n'existait plus, juste
 * au-dessus d'une scène 3D qui montrait la vraie.
 */
describe("fraîcheur des vignettes packshot", () => {
  it("l'empreinte des entrées de rendu correspond au manifeste enregistré", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const manifestPath = join(root, "tests", "packshot-manifest.json");

    if (!existsSync(manifestPath)) {
      throw new Error(
        `Aucun manifeste trouvé (${manifestPath}).\n` +
          `Génère les vignettes et le manifeste : NEXT_PUBLIC_PACKSHOT=1 npm run dev ` +
          `(un terminal), puis npm run packshots (un autre).`
      );
    }

    const saved = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
      hash: string;
      files: { path: string; sha256: string | null }[];
    };
    const current = computePackshotManifest();

    if (current.missing.length > 0) {
      throw new Error(
        `Fichiers référencés par le rendu packshot introuvables sur disque :\n` +
          current.missing.map((f: string) => `  - ${f}`).join("\n") +
          `\n\nUn fichier supprimé ou jamais déposé n'est plus une divergence silencieuse ` +
          `— corrige la référence ou dépose le fichier, puis régénère : npm run packshots.`
      );
    }

    if (current.hash !== saved.hash) {
      const before = new Map(saved.files.map((f) => [f.path, f.sha256]));
      const after = new Map(current.files.map((f) => [f.path, f.sha256]));
      const changed: string[] = [];
      for (const [path, hash] of after) {
        if (before.get(path) !== hash) changed.push(path);
      }
      for (const path of before.keys()) {
        if (!after.has(path)) changed.push(`${path} (retiré du rendu)`);
      }
      throw new Error(
        `Les vignettes de configuration (public/images/variants/packshot/) sont ` +
          `PÉRIMÉES : au moins une entrée de leur rendu a changé depuis la dernière ` +
          `génération.\n\n` +
          `Fichier(s) concerné(s) :\n` +
          changed.map((f) => `  - ${f}`).join("\n") +
          `\n\n` +
          `Régénère-les puis relance ce test :\n` +
          `  1. NEXT_PUBLIC_PACKSHOT=1 npm run dev   (un terminal)\n` +
          `  2. npm run packshots                     (un autre)`
      );
    }
  });
});

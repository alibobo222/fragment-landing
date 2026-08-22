import { describe, it, expect } from "vitest";
import { variants, type MaterialKind } from "@/data/product";
import { materialProfile } from "@/lib/lampTextures";
import { shadeTransmission } from "@/data/lampModel";

/**
 * Verrouille la résolution des matières : matérialise en dur ce que
 * `data/product.ts` doit produire, pour que renommer ou modifier un champ
 * `material` sans le vouloir casse un test avec un message clair — plutôt que
 * de retomber silencieusement sur `matte` comme au temps des regex.
 */
const PARTS = ["shade", "assembly", "base", "cable"] as const;

const EXPECTED: Record<string, Record<(typeof PARTS)[number], MaterialKind>> = {
  "prototype-noir-cable-bleu": {
    shade: "blackConcrete",
    assembly: "metal",
    base: "blackConcrete",
    cable: "fabric",
  },
  "porcelaine-acier-noir": {
    shade: "porcelain",
    assembly: "metal",
    base: "travertine",
    cable: "fabric",
  },
  "brique-aluminium": {
    shade: "blackConcrete",
    assembly: "corten",
    base: "brick",
    cable: "fabric",
  },
  "verre-bouteille-inox": {
    shade: "shell",
    assembly: "metal",
    base: "glassBottle",
    cable: "fabric",
  },
  "coquille-laiton": {
    shade: "shell",
    assembly: "metal",
    base: "blackConcrete",
    cable: "fabric",
  },
  "verre-bleu-acier-anodise": {
    shade: "blueGlass",
    assembly: "metal",
    base: "blueGlass",
    cable: "fabric",
  },
  "porcelaine-epoxy-mat": {
    shade: "porcelain",
    assembly: "epoxy",
    base: "concrete",
    cable: "fabric",
  },
};

/** Transmission attendue de l'abat-jour de chaque variante (voir PROFILES). */
const EXPECTED_SHADE_TRANSMISSION: Record<string, number> = {
  "prototype-noir-cable-bleu": 0.08,
  "porcelaine-acier-noir": 0.45,
  "brique-aluminium": 0.08,
  "verre-bouteille-inox": 0.25,
  "coquille-laiton": 0.25,
  "verre-bleu-acier-anodise": 0.08,
  "porcelaine-epoxy-mat": 0.45,
};

/** Les 15 MaterialKind du catalogue — recopiés de data/product.ts. Un kind
 *  ajouté là-bas sans profil dans PROFILES doit être ajouté ici aussi. */
const ALL_KINDS: MaterialKind[] = [
  "porcelain",
  "concrete",
  "brick",
  "shell",
  "glassBottle",
  "glassBlue",
  "blueGlass",
  "blueTerrazzo",
  "epoxy",
  "metal",
  "fabric",
  "blackConcrete",
  "matte",
  "travertine",
  "corten",
];

describe("résolution des matières", () => {
  it("expose exactement les 7 variantes attendues par la table d'attendus", () => {
    expect(variants.map((v) => v.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const variant of variants) {
    const expected = EXPECTED[variant.id];

    it(`${variant.id} — résout le MaterialKind attendu pour chaque pièce`, () => {
      expect(expected, `variante absente de la table d'attendus : ${variant.id}`).toBeDefined();
      for (const part of PARTS) {
        expect(
          variant[part].material,
          `${variant.id}.${part} : attendu "${expected[part]}", trouvé "${variant[part].material}"`
        ).toBe(expected[part]);
      }
    });

    it(`${variant.id} — aucune pièce ne retombe sur "matte" par accident`, () => {
      for (const part of PARTS) {
        if (expected[part] === "matte") continue;
        expect(
          variant[part].material,
          `${variant.id}.${part} est tombé sur "matte" — vérifier le champ material dans data/product.ts`
        ).not.toBe("matte");
      }
    });

    it(`${variant.id} — transmission de l'abat-jour conforme à sa matière`, () => {
      expect(shadeTransmission(variant.shade.material)).toBe(
        EXPECTED_SHADE_TRANSMISSION[variant.id]
      );
    });
  }

  it("chaque MaterialKind référencé par une variante a un profil complet", () => {
    const used = new Set<MaterialKind>();
    for (const variant of variants) {
      for (const part of PARTS) used.add(variant[part].material);
      if (variant.shadeInner) used.add(variant.shadeInner.material);
    }
    for (const kind of used) {
      const profile = materialProfile(kind);
      expect(profile.roughness, `PROFILES["${kind}"] incomplet (roughness)`).toEqual(
        expect.any(Number)
      );
      expect(profile.transmission, `PROFILES["${kind}"] incomplet (transmission)`).toEqual(
        expect.any(Number)
      );
    }
  });

  it("les 15 MaterialKind du catalogue ont chacun un profil complet dans PROFILES", () => {
    for (const kind of ALL_KINDS) {
      const profile = materialProfile(kind);
      expect(profile.roughness, `PROFILES["${kind}"] absent ou incomplet`).toEqual(
        expect.any(Number)
      );
      expect(profile.metalness).toEqual(expect.any(Number));
      expect(profile.clearcoat).toEqual(expect.any(Number));
      expect(profile.transmission).toEqual(expect.any(Number));
    }
  });
});

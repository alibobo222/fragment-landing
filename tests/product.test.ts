import { describe, it, expect } from "vitest";
import { variants, getVariant, defaultVariantId } from "@/data/product";
import { orderCtaLabel } from "@/config/site";

describe("données produit", () => {
  it("expose exactement sept combinaisons", () => {
    expect(variants).toHaveLength(7);
  });

  it("garantit des identifiants uniques", () => {
    const ids = new Set(variants.map((v) => v.id));
    expect(ids.size).toBe(7);
  });

  it("numérote les configurations de 01 à 07 dans l'ordre", () => {
    expect(variants.map((v) => v.index)).toEqual([
      "01", "02", "03", "04", "05", "06", "07",
    ]);
  });

  it("place le prototype en première position (défaut)", () => {
    expect(variants[0].id).toBe("prototype-noir-cable-bleu");
    expect(defaultVariantId).toBe("prototype-noir-cable-bleu");
  });

  it("fournit un visuel et un texte alternatif pour chaque variante", () => {
    for (const v of variants) {
      expect(v.image).toMatch(/^\/images\/(variants|prototype)\/.+\.webp$/);
      expect(v.alt.length).toBeGreaterThan(10);
    }
  });

  it("getVariant renvoie la variante demandée", () => {
    expect(getVariant("coquille-laiton").id).toBe("coquille-laiton");
  });

  it("getVariant retombe sur la variante par défaut si l'id est inconnu", () => {
    expect(getVariant("inexistant").id).toBe(defaultVariantId);
    expect(getVariant(null).id).toBe(defaultVariantId);
  });
});

describe("CTA selon le mode commercial", () => {
  it("checkout → Commander", () => {
    expect(orderCtaLabel("checkout")).toBe("Commander cette lampe");
  });
  it("preorder → Réserver", () => {
    expect(orderCtaLabel("preorder")).toBe("Réserver cette configuration");
  });
  it("inquiry → Demander", () => {
    expect(orderCtaLabel("inquiry")).toBe("Demander cette configuration");
  });
});

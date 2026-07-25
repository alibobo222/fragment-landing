import { describe, it, expect } from "vitest";
import { validateLead, isValid } from "@/lib/validation";

const base = {
  firstName: "Alice",
  email: "alice@example.com",
  variantId: "porcelaine-acier-noir",
  consent: true,
};

describe("validateLead", () => {
  it("accepte une demande complète et valide", () => {
    const errors = validateLead(base);
    expect(isValid(errors)).toBe(true);
  });

  it("refuse un prénom trop court", () => {
    const errors = validateLead({ ...base, firstName: "A" });
    expect(errors.firstName).toBeDefined();
  });

  it("refuse un e-mail invalide", () => {
    const errors = validateLead({ ...base, email: "pas-un-email" });
    expect(errors.email).toBeDefined();
  });

  it("exige un e-mail", () => {
    const errors = validateLead({ ...base, email: "" });
    expect(errors.email).toBeDefined();
  });

  it("exige le consentement", () => {
    const errors = validateLead({ ...base, consent: false });
    expect(errors.consent).toBeDefined();
  });

  it("exige une variante sélectionnée", () => {
    const errors = validateLead({ ...base, variantId: "" });
    expect(errors.variantId).toBeDefined();
  });

  it("rejette silencieusement le honeypot rempli", () => {
    const errors = validateLead({ ...base, company: "robot corp" });
    expect(errors.form).toBeDefined();
    expect(isValid(errors)).toBe(false);
  });

  it("refuse un message trop long", () => {
    const errors = validateLead({ ...base, message: "x".repeat(1001) });
    expect(errors.message).toBeDefined();
  });
});

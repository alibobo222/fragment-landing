import { describe, it, expect, vi, afterEach } from "vitest";
import { buildContactPayload, submitContact } from "@/lib/contact";
import { normalizeLead, LEAD_LIMITS, isHoneypotFilled } from "@/lib/validation";

const lead = {
  firstName: "Alice",
  email: "alice@example.com",
  message: "Bonjour",
  variantId: "porcelaine-acier-noir",
  consent: true,
};

/** Réponse HTTP minimale, pour ne pas dépendre d'un vrai `Response`. */
function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("buildContactPayload", () => {
  it("joint la configuration et retombe sur « direct » sans source", () => {
    const payload = buildContactPayload(lead, {
      configuration: "Porcelaine / acier noir",
      source: null,
    });
    expect(payload.configuration).toBe("Porcelaine / acier noir");
    expect(payload.source).toBe("direct");
    expect(payload.variantId).toBe(lead.variantId);
  });
});

describe("normalizeLead", () => {
  it("tronque les chaînes démesurées avant qu'elles n'atteignent la base", () => {
    const n = normalizeLead({ ...lead, message: "x".repeat(5000) });
    expect(n.message?.length).toBe(LEAD_LIMITS.message);
  });

  it("normalise l'e-mail et coupe les espaces", () => {
    const n = normalizeLead({ ...lead, email: "  Alice@Example.COM " });
    expect(n.email).toBe("alice@example.com");
  });

  it("n'accepte le consentement que sous une forme explicite", () => {
    expect(normalizeLead({ ...lead, consent: "on" }).consent).toBe(true);
    expect(normalizeLead({ ...lead, consent: "peut-être" }).consent).toBe(false);
  });

  it("survit à une entrée qui n'est pas un objet", () => {
    expect(() => normalizeLead(null)).not.toThrow();
    expect(normalizeLead("bonjour").firstName).toBe("");
  });

  it("repère le honeypot rempli", () => {
    expect(isHoneypotFilled(normalizeLead({ ...lead, company: "ACME" }))).toBe(true);
    expect(isHoneypotFilled(normalizeLead(lead))).toBe(false);
  });
});

describe("submitContact", () => {
  it("réussit et rapporte si la notification est partie", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, { ok: true, emailed: true })));
    const res = await submitContact("https://exemple.test/contact", {
      ...lead,
      configuration: "c",
      source: "direct",
    });
    expect(res).toEqual({ ok: true, emailed: true });
  });

  it("traduit une limitation de fréquence en message lisible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(429, { ok: false, error: "rate_limited" })));
    const res = await submitContact("https://exemple.test/contact", {
      ...lead,
      configuration: "c",
      source: "direct",
    });
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.message).toMatch(/quelques minutes/);
  });

  it("ne transforme pas un succès en erreur si le corps est illisible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("corps vide");
        },
      }) as unknown as Response)
    );
    const res = await submitContact("https://exemple.test/contact", {
      ...lead,
      configuration: "c",
      source: "direct",
    });
    expect(res.ok).toBe(true);
  });

  it("signale un serveur injoignable sans accuser le réseau du visiteur", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const res = await submitContact("https://exemple.test/contact", {
      ...lead,
      configuration: "c",
      source: "direct",
    });
    expect(res.ok).toBe(false);
    // Le message ne doit désigner ni le réseau du visiteur ni le nôtre : à cet
    // endroit on ignore lequel des deux a manqué.
    expect(res.ok === false && res.message).toBe("L'envoi n'a pas pu aboutir.");
    // `injoignable` déclenche la proposition du courriel de secours.
    expect(res.ok === false && res.injoignable).toBe(true);
  });
});

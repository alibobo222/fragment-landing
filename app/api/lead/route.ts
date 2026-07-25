import { NextResponse } from "next/server";
import { validateLead, isValid } from "@/lib/validation";
import { siteConfig } from "@/config/site";
import { getVariant } from "@/data/product";

export const runtime = "nodejs";

/**
 * Réception des demandes / réservations.
 * - Valide côté serveur (ne fait jamais confiance au client).
 * - Si `leadEndpoint` est configuré : transmet la demande à ce service.
 * - Sinon : répond en « mode démonstration » (aucune donnée n'est envoyée),
 *   ce que l'interface signale honnêtement au visiteur.
 */
export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ errors: { form: "Requête invalide." } }, { status: 400 });
  }

  const input = {
    firstName: String(payload.firstName ?? ""),
    email: String(payload.email ?? ""),
    message: String(payload.message ?? ""),
    consent: payload.consent === true,
    company: String(payload.company ?? ""),
    variantId: String(payload.variantId ?? ""),
  };

  const errors = validateLead(input);
  if (!isValid(errors)) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const variant = getVariant(input.variantId);
  const lead = {
    firstName: input.firstName.trim(),
    email: input.email.trim(),
    message: input.message.trim() || null,
    variantId: variant.id,
    variantName: variant.name,
    configuration: variant.materialsSummary,
    quantity: Number(payload.quantity ?? 1),
    source: String(payload.source ?? "direct"),
    mode: siteConfig.purchaseMode,
    receivedAt: new Date().toISOString(),
  };

  // Mode démonstration : aucun service configuré.
  if (!siteConfig.leadEndpoint) {
    // eslint-disable-next-line no-console
    console.info("[lead:demo] Demande non transmise (leadEndpoint absent) :", lead);
    return NextResponse.json({ status: "demo" }, { status: 200 });
  }

  try {
    const res = await fetch(siteConfig.leadEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (!res.ok) {
      return NextResponse.json(
        { errors: { form: "Le service de réception a refusé la demande." } },
        { status: 502 }
      );
    }
    return NextResponse.json({ status: "sent" }, { status: 200 });
  } catch {
    return NextResponse.json(
      { errors: { form: "Service de réception injoignable." } },
      { status: 502 }
    );
  }
}

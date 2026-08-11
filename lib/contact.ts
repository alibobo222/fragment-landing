/**
 * Envoi d'une demande de contact vers la fonction Edge Supabase.
 *
 * Isolé du composant pour être testable sans monter de formulaire : c'est ici
 * que vivent la forme exacte de la charge utile et la traduction des réponses
 * du serveur en messages lisibles.
 */

import type { LeadInput } from "@/lib/validation";

export interface ContactPayload extends LeadInput {
  configuration: string;
  source: string;
}

export type ContactResult =
  | { ok: true; emailed: boolean }
  | { ok: false; message: string };

/** Charge utile envoyée à la fonction Edge. Le honeypot part avec le reste :
 *  c'est le serveur qui décide quoi en faire. */
export function buildContactPayload(
  input: LeadInput,
  context: { configuration: string; source: string | null },
): ContactPayload {
  return {
    ...input,
    configuration: context.configuration,
    source: context.source ?? "direct",
  };
}

/** Messages destinés au visiteur. Aucun détail technique : le diagnostic vit
 *  dans les journaux de la fonction, pas sous les yeux du prospect. */
const MESSAGES: Record<string, string> = {
  rate_limited:
    "Plusieurs demandes viennent de partir depuis cet appareil. Réessayez dans quelques minutes.",
  invalid_payload: "Certaines informations sont incomplètes. Vérifiez le formulaire.",
  payload_too_large: "Votre message est trop long.",
  default: "L'envoi a échoué. Réessayez dans un instant.",
};

export async function submitContact(
  endpoint: string,
  payload: ContactPayload,
  signal?: AbortSignal,
): Promise<ContactResult> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
  } catch {
    return { ok: false, message: "Connexion impossible. Vérifiez votre réseau." };
  }

  // Une réponse peut être vide ou mal formée : ne jamais laisser un `json()`
  // qui échoue transformer un succès serveur en erreur affichée.
  let body: { ok?: boolean; error?: string; emailed?: boolean } = {};
  try {
    body = await res.json();
  } catch {
    /* corps illisible : on s'en remet au code HTTP */
  }

  if (res.ok && body.ok !== false) {
    return { ok: true, emailed: body.emailed === true };
  }

  return {
    ok: false,
    message: MESSAGES[body.error ?? ""] ?? MESSAGES.default,
  };
}

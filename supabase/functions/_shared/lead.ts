/**
 * Validation et normalisation d'une demande de contact.
 *
 * ⚠️ CE FICHIER EST LA SOURCE DE VÉRITÉ, et il vit ici — pas dans `lib/` —
 * pour une raison précise : `supabase functions deploy` ne garantit l'embarquement
 * que des fichiers situés sous `supabase/functions/`. Le placer ailleurs ferait
 * dépendre le déploiement d'un comportement de bundler non documenté.
 * `lib/validation.ts` le ré-exporte pour le front, si bien qu'une seule
 * implémentation existe et que client et serveur ne peuvent pas diverger.
 *
 * Aucun import : ni React, ni Deno, ni dépendance externe. C'est ce qui permet
 * au même fichier d'être compilé par Next, exécuté par Deno et testé par Vitest.
 */

/** Bornes de taille, appliquées côté serveur — le client peut mentir. */
export const LEAD_LIMITS = {
  firstName: 80,
  email: 160,
  message: 1000,
  variantId: 64,
  configuration: 240,
  source: 64,
  /** Taille maximale du corps de requête accepté par la fonction, en octets. */
  body: 8_000,
} as const;

export interface LeadInput {
  firstName: string;
  email: string;
  variantId: string;
  message?: string;
  consent: boolean;
  /** Champ honeypot anti-spam : doit rester vide. */
  company?: string;
  /** Contexte non critique, ajouté par le formulaire. */
  configuration?: string;
  source?: string;
}

export type LeadErrors = Partial<Record<keyof LeadInput | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(input: Partial<LeadInput>): LeadErrors {
  const errors: LeadErrors = {};

  const firstName = (input.firstName ?? "").trim();
  if (firstName.length < 2) {
    errors.firstName = "Indiquez votre prénom (2 caractères minimum).";
  } else if (firstName.length > LEAD_LIMITS.firstName) {
    errors.firstName = "Prénom trop long.";
  }

  const email = (input.email ?? "").trim();
  if (!email) {
    errors.email = "Une adresse e-mail est nécessaire pour vous répondre.";
  } else if (!EMAIL_RE.test(email) || email.length > LEAD_LIMITS.email) {
    errors.email = "Cette adresse e-mail semble invalide.";
  }

  if (!input.variantId) {
    errors.variantId = "Aucune configuration sélectionnée.";
  }

  if ((input.message ?? "").length > LEAD_LIMITS.message) {
    errors.message = "Message trop long (1000 caractères maximum).";
  }

  if (!input.consent) {
    errors.consent = "Votre accord est nécessaire pour traiter la demande.";
  }

  // Honeypot : rempli = robot. On renvoie une erreur générique neutre.
  if (input.company && input.company.trim().length > 0) {
    errors.form = "Envoi refusé.";
  }

  return errors;
}

export function isValid(errors: LeadErrors): boolean {
  return Object.keys(errors).length === 0;
}

/** Le honeypot se traite à part du reste : voir la fonction Edge, qui répond
 *  succès sans rien enregistrer plutôt que d'apprendre au robot qu'il est vu. */
export function isHoneypotFilled(input: Partial<LeadInput>): boolean {
  return typeof input.company === "string" && input.company.trim().length > 0;
}

/**
 * Ramène une entrée quelconque à la forme attendue : chaînes, espaces coupés,
 * longueurs tronquées. Appelée AVANT la validation côté serveur, de sorte
 * qu'aucune chaîne démesurée n'atteigne la base même si la validation évolue.
 */
export function normalizeLead(raw: unknown): Partial<LeadInput> {
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number): string =>
    typeof v === "string" ? v.trim().slice(0, max) : "";

  return {
    firstName: str(o.firstName, LEAD_LIMITS.firstName),
    email: str(o.email, LEAD_LIMITS.email).toLowerCase(),
    message: str(o.message, LEAD_LIMITS.message),
    variantId: str(o.variantId, LEAD_LIMITS.variantId),
    configuration: str(o.configuration, LEAD_LIMITS.configuration),
    source: str(o.source, LEAD_LIMITS.source),
    consent: o.consent === true || o.consent === "on",
    company: str(o.company, 200),
  };
}

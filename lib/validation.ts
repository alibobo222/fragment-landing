/**
 * Validation partagée entre client et serveur pour le formulaire de demande.
 * Volontairement sans dépendance externe.
 */

export interface LeadInput {
  firstName: string;
  email: string;
  variantId: string;
  message?: string;
  consent: boolean;
  /** Champ honeypot anti-spam : doit rester vide. */
  company?: string;
}

export type LeadErrors = Partial<Record<keyof LeadInput | "form", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(input: Partial<LeadInput>): LeadErrors {
  const errors: LeadErrors = {};

  const firstName = (input.firstName ?? "").trim();
  if (firstName.length < 2) {
    errors.firstName = "Indiquez votre prénom (2 caractères minimum).";
  } else if (firstName.length > 80) {
    errors.firstName = "Prénom trop long.";
  }

  const email = (input.email ?? "").trim();
  if (!email) {
    errors.email = "Une adresse e-mail est nécessaire pour vous répondre.";
  } else if (!EMAIL_RE.test(email) || email.length > 160) {
    errors.email = "Cette adresse e-mail semble invalide.";
  }

  if (!input.variantId) {
    errors.variantId = "Aucune configuration sélectionnée.";
  }

  if ((input.message ?? "").length > 1000) {
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

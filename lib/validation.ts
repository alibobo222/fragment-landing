/**
 * Validation partagée entre le formulaire et la fonction Edge.
 *
 * L'implémentation vit dans `supabase/functions/_shared/lead.ts` — seul endroit
 * dont `supabase functions deploy` garantit l'embarquement. Ce module n'est
 * qu'un point d'entrée pour le front, qui conserve ainsi son import habituel
 * `@/lib/validation`. Une seule implémentation, aucun risque de divergence.
 */

export {
  validateLead,
  isValid,
  isHoneypotFilled,
  normalizeLead,
  LEAD_LIMITS,
} from "@/supabase/functions/_shared/lead";

export type { LeadInput, LeadErrors } from "@/supabase/functions/_shared/lead";

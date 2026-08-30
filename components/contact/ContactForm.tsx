"use client";

import { useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSelection } from "@/components/SelectionProvider";
import { validateLead, isValid, type LeadErrors, type LeadInput } from "@/lib/validation";
import { buildContactPayload, submitContact } from "@/lib/contact";
import { track, getSource } from "@/lib/analytics";
import { siteConfig } from "@/config/site";
import { buttonMotion } from "@/components/ui/motion";

type Status = "idle" | "loading" | "sent" | "mailto" | "error";

/**
 * Formulaire de CONTACT (aucune logique d'achat). Invite à échanger autour du
 * projet ; la configuration en cours est jointe comme simple contexte.
 *
 * L'envoi passe par la fonction Edge Supabase `contact`, qui enregistre la
 * demande puis notifie l'atelier via Resend. La validation appliquée ici est
 * la MÊME que celle du serveur (`supabase/functions/_shared/lead.ts`) : elle
 * sert le confort de saisie, pas la sécurité — le serveur revalide tout.
 */
export function ContactForm() {
  const { variant } = useSelection();
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  // Lien mailto proposé quand le serveur est injoignable — PROPOSÉ, pas imposé :
  // après un échec on offre une porte, on ne pousse personne dedans.
  const [mailtoSecours, setMailtoSecours] = useState<string | null>(null);
  const startedRef = useRef(false);
  // Verrou synchrone : `status` ne change qu'au rendu suivant, ce qui laisse
  // passer un double clic rapide. Ce booléen, lui, est à jour immédiatement.
  const sendingRef = useRef(false);
  const ids = { firstName: useId(), email: useId(), message: useId(), consent: useId() };

  const onFirstInteraction = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("contact_form_started", { variant: variant.id });
    }
  };

  /** Courriel prérempli : même contenu pour le repli et pour le secours. */
  function construireMailto(input: LeadInput): string {
    const subject = `Contact FRAGMENT — ${variant.name}`;
    const lines = [
      `Prénom : ${input.firstName}`,
      `E-mail : ${input.email}`,
      `Configuration : ${variant.name} (${variant.materialsSummary})`,
      "",
      input.message || "(pas de message)",
    ];
    return `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(lines.join("\n"))}`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sendingRef.current) return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const input = {
      firstName: String(data.get("firstName") ?? ""),
      email: String(data.get("email") ?? ""),
      message: String(data.get("message") ?? ""),
      consent: data.get("consent") === "on",
      company: String(data.get("company") ?? ""), // honeypot
      variantId: variant.id,
    };

    const validation = validateLead(input);
    setErrors(validation);
    if (!isValid(validation)) {
      const firstKey = Object.keys(validation)[0];
      form.querySelector<HTMLElement>(`[name="${firstKey}"]`)?.focus();
      return;
    }

    // Chemin normal : la fonction Edge enregistre puis notifie.
    if (siteConfig.contactEndpoint) {
      sendingRef.current = true;
      setStatus("loading");
      setErrors({});

      const payload = buildContactPayload(input, {
        configuration: variant.materialsSummary,
        source: getSource(),
      });
      const result = await submitContact(siteConfig.contactEndpoint, payload);

      sendingRef.current = false;
      if (!result.ok) {
        setStatus("error");
        setErrors({ form: result.message });
        setMailtoSecours(result.injoignable ? construireMailto(input) : null);
        return;
      }

      track("contact_form_submitted", { variant: variant.id });
      form.reset();
      setStatus("sent");
      return;
    }

    // Repli quand l'endpoint n'est pas configuré (développement local, ou build
    // sans `NEXT_PUBLIC_CONTACT_ENDPOINT`) : ouverture du client mail prérempli.
    // Ce n'est PAS le chemin de production — il perd le message quand aucun
    // client mail n'est configuré, ce qui est fréquent sur mobile.
    const href = construireMailto(input);
    track("contact_form_submitted", { variant: variant.id });
    window.location.href = href;
    form.reset();
    setStatus("mailto");
  }

  if (status === "sent") {
    return (
      <Confirmation
        title="Message envoyé."
        body={`Votre demande à propos de « ${variant.name} » nous est bien parvenue. Nous vous répondons à l'adresse indiquée.`}
      />
    );
  }

  if (status === "mailto") {
    return (
      <Confirmation
        title="Message prêt à envoyer."
        body={`Votre logiciel de messagerie s'ouvre, pré-rempli, à propos de « ${variant.name} ». Il ne reste qu'à l'envoyer.`}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {status === "error" && errors.form && (
        <p role="alert" className="border border-brick/40 bg-brick/5 px-3 py-2 text-sm text-brick">
          {errors.form}
          {mailtoSecours && (
            <>
              {" "}Écrivez-nous directement :{" "}
              <a href={mailtoSecours} className="underline underline-offset-2">
                {siteConfig.contactEmail}
              </a>
            </>
          )}
        </p>
      )}

      <Field id={ids.firstName} name="firstName" label="Prénom" autoComplete="given-name" error={errors.firstName} onInteract={onFirstInteraction} />
      <Field id={ids.email} name="email" type="email" label="E-mail" autoComplete="email" inputMode="email" error={errors.email} onInteract={onFirstInteraction} />

      <div>
        <label htmlFor={ids.message} className="block text-sm font-medium text-ink">
          Votre message <span className="text-ink-muted">(facultatif)</span>
        </label>
        <textarea
          id={ids.message}
          name="message"
          rows={3}
          onFocus={onFirstInteraction}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? `${ids.message}-err` : undefined}
          className="mt-1.5 w-full resize-y border border-ink/25 bg-white px-3 py-2 text-ink outline-none focus:border-ink"
        />
        {errors.message && (
          <p id={`${ids.message}-err`} className="mt-1 text-sm text-brick">
            {errors.message}
          </p>
        )}
      </div>

      {/* Honeypot anti-spam. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${ids.email}-company`}>Société</label>
        <input id={`${ids.email}-company`} name="company" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-start gap-3">
        <input
          id={ids.consent}
          name="consent"
          type="checkbox"
          onChange={onFirstInteraction}
          aria-invalid={!!errors.consent}
          aria-describedby={errors.consent ? `${ids.consent}-err` : undefined}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        <label htmlFor={ids.consent} className="text-sm leading-snug text-ink-soft">
          J’accepte d’être recontacté(e) au sujet de ce message. Mes
          données ne servent qu’à cet échange.
        </label>
      </div>
      {errors.consent && (
        <p id={`${ids.consent}-err`} className="-mt-2 text-sm text-brick">
          {errors.consent}
        </p>
      )}

      <div className="pt-1">
        <motion.button
          type="submit"
          {...buttonMotion}
          disabled={status === "loading"}
          aria-busy={status === "loading"}
          className="btn-glass btn-glass-primary inline-flex min-h-[3rem] w-full items-center justify-center px-7 text-[0.95rem] font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? "Envoi…" : "Prendre contact"}
        </motion.button>
      </div>

      {/* Information au moment de la collecte (CNIL) : elle doit figurer ICI,
          pas seulement sur une page distincte. Placée APRÈS le bouton pour ne
          pas insérer son lien entre la case de consentement et l'envoi —
          l'ordre de tabulation des champs reste celui d'avant.

          Volontairement SÉPARÉE de la case à cocher : informer et recueillir un
          consentement sont deux actes distincts, les fondre en un seul rendrait
          le consentement moins clair. */}
      <p className="text-xs leading-relaxed text-ink-muted">
        Votre prénom, votre e-mail et votre message sont enregistrés par les
        éditeurs du site dans le seul but de vous répondre. Ils sont conservés
        trois ans après notre dernier échange, ne sont transmis à personne
        d’autre que nos prestataires techniques, et ne servent à aucune
        prospection. Vous pouvez demander leur suppression à tout moment. En
        savoir plus :{" "}
        <a href="/confidentialite/" className="underline underline-offset-2 hover:text-ink">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  error,
  onInteract,
  ...rest
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  error?: string;
  onInteract: () => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        onFocus={onInteract}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className="mt-1.5 w-full border border-ink/25 bg-white px-3 py-2 text-ink outline-none focus:border-ink"
        {...rest}
      />
      {error && (
        <p id={`${id}-err`} className="mt-1 text-sm text-brick">
          {error}
        </p>
      )}
    </div>
  );
}

function Confirmation({
  title,
  body,
  tone = "success",
}: {
  title: string;
  body: string;
  tone?: "success" | "notice";
}) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`border p-6 ${tone === "success" ? "border-glass/40 bg-glass/5" : "border-line bg-white"}`}
    >
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mt-2 text-ink-soft">{body}</p>
    </motion.div>
  );
}

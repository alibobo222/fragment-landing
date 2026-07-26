"use client";

import { useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useSelection } from "@/components/SelectionProvider";
import { validateLead, isValid, type LeadErrors } from "@/lib/validation";
import { track, getSource } from "@/lib/analytics";
import { siteConfig } from "@/config/site";
import { tapProps } from "@/components/ui/motion";

type Status = "idle" | "loading" | "sent" | "error";

/**
 * Formulaire de CONTACT (aucune logique d'achat). Invite à échanger autour du
 * projet ; la configuration en cours est jointe comme simple contexte.
 */
export function ContactForm() {
  const { variant } = useSelection();
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const startedRef = useRef(false);
  const ids = { firstName: useId(), email: useId(), message: useId(), consent: useId() };

  const onFirstInteraction = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("contact_form_started", { variant: variant.id });
    }
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

    const payload = {
      ...input,
      configuration: variant.materialsSummary,
      source: getSource() ?? "direct",
    };

    // Site 100 % statique (GitHub Pages) : aucun serveur.
    // 1) Si un endpoint externe est configuré (Formspree, Getform, Basin…),
    //    on lui envoie le formulaire directement.
    // 2) Sinon, repli sans serveur : ouverture du client mail (mailto) prérempli.
    if (siteConfig.leadEndpoint) {
      setStatus("loading");
      try {
        const res = await fetch(siteConfig.leadEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setStatus("error");
          setErrors({ form: "L'envoi a échoué. Réessayez dans un instant." });
          return;
        }
        track("contact_form_submitted", { variant: variant.id });
        setStatus("sent");
        form.reset();
      } catch {
        setStatus("error");
        setErrors({ form: "Connexion impossible. Vérifiez votre réseau." });
      }
      return;
    }

    // Repli mailto (aucune dépendance) : ouvre le client mail de l'utilisateur.
    const subject = `Contact FRAGMENT — ${variant.name}`;
    const lines = [
      `Prénom : ${input.firstName}`,
      `E-mail : ${input.email}`,
      `Configuration : ${variant.name} (${variant.materialsSummary})`,
      "",
      input.message || "(pas de message)",
    ];
    const href = `mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(lines.join("\n"))}`;
    track("contact_form_submitted", { variant: variant.id });
    window.location.href = href;
    setStatus("sent");
    form.reset();
  }

  if (status === "sent") {
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
          J&apos;accepte d&apos;être recontacté(e) au sujet de ce message. Mes
          données ne servent qu&apos;à cet échange.
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
          {...tapProps}
          disabled={status === "loading"}
          className="inline-flex min-h-[3rem] w-full items-center justify-center bg-ink px-7 text-[0.95rem] font-semibold text-paper transition-colors hover:bg-anthracite disabled:opacity-45"
        >
          {status === "loading" ? "Envoi…" : "Prendre contact"}
        </motion.button>
      </div>
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

"use client";

import { useId, useRef, useState } from "react";
import { useSelection } from "@/components/SelectionProvider";
import { validateLead, isValid, type LeadErrors } from "@/lib/validation";
import { track } from "@/lib/analytics";
import { getSource } from "@/lib/analytics";
import { siteConfig, orderCtaLabel } from "@/config/site";
import { Button } from "@/components/ui/Button";

type Status = "idle" | "loading" | "sent" | "demo" | "error";

export function LeadForm() {
  const { variant, quantity } = useSelection();
  const [errors, setErrors] = useState<LeadErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const startedRef = useRef(false);
  const ids = {
    firstName: useId(),
    email: useId(),
    message: useId(),
    consent: useId(),
  };

  const onFirstInteraction = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("lead_form_started", { variant: variant.id });
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

    setStatus("loading");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          quantity,
          configuration: variant.materialsSummary,
          source: getSource() ?? "direct",
        }),
      });

      if (res.status === 400) {
        const body = (await res.json()) as { errors?: LeadErrors };
        setErrors(body.errors ?? { form: "Vérifiez les champs du formulaire." });
        setStatus("error");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        setErrors({ form: "L'envoi a échoué. Réessayez dans un instant." });
        return;
      }

      const body = (await res.json()) as { status?: string };
      track("lead_form_submitted", { variant: variant.id, quantity });
      setStatus(body.status === "demo" ? "demo" : "sent");
      form.reset();
    } catch {
      setStatus("error");
      setErrors({ form: "Connexion impossible. Vérifiez votre réseau." });
    }
  }

  if (status === "sent") {
    return (
      <Confirmation
        title="Demande envoyée."
        body={`Merci. Nous revenons vers vous à propos de la configuration « ${variant.name} ».`}
      />
    );
  }

  if (status === "demo") {
    return (
      <Confirmation
        title="Configuration prête."
        // Message honnête : la demande n'a PAS été transmise (aucun service configuré).
        body="Mode démonstration : l'envoi n'est pas encore activé sur ce site. Renseignez « leadEndpoint » dans config/site.ts pour recevoir les demandes."
        tone="notice"
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {status === "error" && errors.form && (
        <p role="alert" className="rounded-none border border-brick/40 bg-brick/5 px-3 py-2 text-sm text-brick">
          {errors.form}
        </p>
      )}

      <Field
        id={ids.firstName}
        name="firstName"
        label="Prénom"
        autoComplete="given-name"
        error={errors.firstName}
        onInteract={onFirstInteraction}
      />
      <Field
        id={ids.email}
        name="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        inputMode="email"
        error={errors.email}
        onInteract={onFirstInteraction}
      />

      <div>
        <label htmlFor={ids.message} className="block text-sm font-medium text-ink">
          Message <span className="text-ink-muted">(facultatif)</span>
        </label>
        <textarea
          id={ids.message}
          name="message"
          rows={3}
          onFocus={onFirstInteraction}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? `${ids.message}-err` : undefined}
          className="mt-1.5 w-full resize-y rounded-none border border-ink/25 bg-paper-pure px-3 py-2 text-ink outline-none focus:border-ink"
        />
        {errors.message && (
          <p id={`${ids.message}-err`} className="mt-1 text-sm text-brick">
            {errors.message}
          </p>
        )}
      </div>

      {/* Honeypot anti-spam : masqué aux humains, laissé aux robots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor={`${ids.email}-company`}>Société</label>
        <input
          id={`${ids.email}-company`}
          name="company"
          tabIndex={-1}
          autoComplete="off"
        />
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
          J&apos;accepte d&apos;être recontacté(e) au sujet de cette demande. Mes
          données ne servent qu&apos;à ce contact.
        </label>
      </div>
      {errors.consent && (
        <p id={`${ids.consent}-err`} className="-mt-2 text-sm text-brick">
          {errors.consent}
        </p>
      )}

      <div className="pt-1">
        <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto">
          {status === "loading" ? "Envoi…" : orderCtaLabel()}
        </Button>
        {!siteConfig.leadEndpoint && (
          <p className="mt-3 text-xs text-ink-muted">
            {/* Note destinée au développeur, pas un faux message d'envoi. */}
            Astuce dev : aucun « leadEndpoint » configuré — envoi en mode démonstration.
          </p>
        )}
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
        className="mt-1.5 w-full rounded-none border border-ink/25 bg-paper-pure px-3 py-2 text-ink outline-none focus:border-ink"
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
    <div
      role="status"
      className={`rounded-none border p-6 ${
        tone === "success"
          ? "border-glass/40 bg-glass/5"
          : "border-line bg-paper-pure"
      }`}
    >
      <p className="font-display text-2xl text-ink">{title}</p>
      <p className="mt-2 text-ink-soft">{body}</p>
    </div>
  );
}

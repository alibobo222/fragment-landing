/**
 * Fonction Edge « contact » — le seul chemin d'écriture du formulaire.
 *
 * Flux : formulaire → cette fonction → table `contact_leads` → notification Resend.
 *
 * Deux principes commandent tout le fichier :
 *
 * 1. LA DEMANDE EST ENREGISTRÉE AVANT D'ÊTRE ENVOYÉE. Si Resend tombe, si le
 *    domaine n'est pas encore vérifié, si le quota est atteint — la demande est
 *    déjà en base, l'erreur est consignée à côté d'elle, et le visiteur reçoit
 *    quand même une confirmation. On ne perd pas un contact pour un e-mail raté.
 *
 * 2. AUCUNE CLÉ NE TRANSITE PAR LE NAVIGATEUR. `SUPABASE_SERVICE_ROLE_KEY` et
 *    `RESEND_API_KEY` ne sont lues qu'ici, depuis les secrets de la fonction.
 *
 * Déploiement : voir README.md, section « Formulaire de contact ».
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  isHoneypotFilled,
  isValid,
  LEAD_LIMITS,
  normalizeLead,
  validateLead,
} from "../_shared/lead.ts";

// --- Secrets et réglages ----------------------------------------------------
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectées automatiquement par
// la plateforme : ne PAS les déclarer en secret, le préfixe `SUPABASE_` est
// réservé et `supabase secrets set` les refuse.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const CONTACT_FROM_EMAIL = Deno.env.get("CONTACT_FROM_EMAIL") ?? "";
const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL") ?? "";
/** Origines autorisées, séparées par des virgules. Vide = toutes (dev). */
const ALLOWED_ORIGINS = (Deno.env.get("CONTACT_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
/** Sel du condensé d'IP. Sans lui, un condensé d'IP se casse par force brute. */
const IP_SALT = Deno.env.get("CONTACT_IP_SALT") ?? "";

/** Limitation de fréquence : au-delà, on refuse poliment. */
const RATE_LIMIT = { max: 3, windowMinutes: 10 } as const;

// --- Utilitaires ------------------------------------------------------------

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    ALLOWED_ORIGINS.length === 0
      ? "*"
      : origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(
  body: unknown,
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/** Condensé salé de l'adresse IP — jamais l'adresse elle-même. */
async function hashIp(ip: string): Promise<string | null> {
  if (!ip || !IP_SALT) return null;
  const data = new TextEncoder().encode(`${IP_SALT}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientIp(req: Request): string {
  // `x-forwarded-for` peut contenir une chaîne de relais : la première entrée
  // est le client d'origine.
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0]?.trim() ?? "";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Traitement -------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");

  // Préflight CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  // Corps borné AVANT analyse : on ne veut ni charge utile démesurée, ni
  // `Content-Length` menteur, d'où la vérification sur le texte réellement lu.
  const raw = await req.text();
  if (raw.length > LEAD_LIMITS.body) {
    return json({ ok: false, error: "payload_too_large" }, 413, origin);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, origin);
  }

  const lead = normalizeLead(parsed);

  // Honeypot : succès simulé. Répondre « refusé » apprendrait au robot quel
  // champ éviter au prochain passage ; un 200 ne lui apprend rien.
  if (isHoneypotFilled(lead)) {
    return json({ ok: true, stored: false, emailed: false }, 200, origin);
  }

  const errors = validateLead(lead);
  if (!isValid(errors)) {
    return json({ ok: false, error: "invalid_payload", errors }, 400, origin);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // --- Limitation de fréquence ---
  const ipHash = await hashIp(clientIp(req));
  if (ipHash) {
    const since = new Date(
      Date.now() - RATE_LIMIT.windowMinutes * 60_000,
    ).toISOString();
    const { count, error } = await supabase
      .from("contact_leads")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);

    // Une erreur de comptage ne doit pas bloquer une demande légitime :
    // on laisse passer, la validation et le honeypot restent en place.
    if (!error && (count ?? 0) >= RATE_LIMIT.max) {
      return json({ ok: false, error: "rate_limited" }, 429, origin);
    }
  }

  // --- Enregistrement ---
  const { data: inserted, error: insertError } = await supabase
    .from("contact_leads")
    .insert({
      first_name: lead.firstName,
      email: lead.email,
      message: lead.message || null,
      variant_id: lead.variantId,
      configuration: lead.configuration || null,
      source: lead.source || null,
      consent: lead.consent ?? false,
      ip_hash: ipHash,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("[contact] insertion échouée", insertError);
    return json({ ok: false, error: "storage_failed" }, 500, origin);
  }

  // --- Notification ---
  // À partir d'ici, la demande est sauvegardée : plus aucune erreur ne doit
  // renvoyer un échec au visiteur.
  let emailed = false;
  let emailError: string | null = null;

  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL || !CONTACT_TO_EMAIL) {
    emailError = "resend_non_configuré";
  } else {
    try {
      const dateFr = new Date(inserted.created_at).toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
      });
      const lignes = [
        ["Prénom", lead.firstName ?? ""],
        ["E-mail", lead.email ?? ""],
        ["Configuration", lead.configuration || lead.variantId || "—"],
        ["Source", lead.source || "direct"],
        ["Reçue le", dateFr],
      ];

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: CONTACT_FROM_EMAIL,
          to: [CONTACT_TO_EMAIL],
          // Répondre à la notification écrit directement au prospect.
          reply_to: lead.email,
          subject: `FRAGMENT — demande de ${lead.firstName}`,
          text: [
            ...lignes.map(([k, v]) => `${k} : ${v}`),
            "",
            lead.message || "(pas de message)",
          ].join("\n"),
          html: [
            '<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.6;color:#111">',
            "<table>",
            ...lignes.map(
              ([k, v]) =>
                `<tr><td style="padding:2px 12px 2px 0;color:#666">${k}</td><td>${escapeHtml(v)}</td></tr>`,
            ),
            "</table>",
            '<p style="white-space:pre-wrap;margin-top:16px">',
            escapeHtml(lead.message || "(pas de message)"),
            "</p>",
            "</div>",
          ].join(""),
        }),
      });

      if (res.ok) {
        emailed = true;
      } else {
        emailError = `resend_${res.status}: ${(await res.text()).slice(0, 300)}`;
      }
    } catch (e) {
      emailError = `resend_exception: ${String(e).slice(0, 300)}`;
    }
  }

  // Trace du résultat de l'envoi à côté de la demande, pour savoir plus tard
  // laquelle a bien été notifiée. Cette mise à jour ne peut pas faire échouer
  // la requête : la demande, elle, est déjà enregistrée.
  await supabase
    .from("contact_leads")
    .update({
      email_sent_at: emailed ? new Date().toISOString() : null,
      email_error: emailError,
    })
    .eq("id", inserted.id);

  if (emailError) console.error("[contact] notification échouée", emailError);

  return json({ ok: true, stored: true, emailed }, 200, origin);
});

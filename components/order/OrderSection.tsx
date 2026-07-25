"use client";

import Image from "next/image";
import { useSelection } from "@/components/SelectionProvider";
import { siteConfig, orderCtaLabel } from "@/config/site";
import { track } from "@/lib/analytics";
import { getSource } from "@/lib/analytics";
import { LeadForm } from "@/components/order/LeadForm";
import { LinkButton } from "@/components/ui/Button";

export function OrderSection() {
  const { variant, quantity, setQuantity } = useSelection();
  const isCheckout = siteConfig.purchaseMode === "checkout" && siteConfig.checkoutUrl;

  const priceLabel =
    siteConfig.price !== null
      ? new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: siteConfig.currency,
          maximumFractionDigits: 0,
        }).format(siteConfig.price)
      : "Sur demande";

  const checkoutHref = isCheckout
    ? `${siteConfig.checkoutUrl}${siteConfig.checkoutUrl!.includes("?") ? "&" : "?"}variant=${variant.id}&qty=${quantity}`
    : "#";

  return (
    <section
      id="commande"
      aria-labelledby="commande-title"
      className="scroll-mt-6 border-t border-ink bg-paper-pure py-24 sm:py-32"
    >
      <div className="u-container grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        {/* Résumé de la configuration */}
        <div>
          <p className="u-eyebrow">Votre configuration</p>
          <h2 id="commande-title" className="mt-5 text-5xl sm:text-6xl">
            {variant.name}
          </h2>

          <div className="mt-8 flex gap-5">
            <span className="relative h-28 w-28 shrink-0 overflow-hidden rounded-sm bg-paper ring-1 ring-line">
              <Image
                src={variant.image}
                alt={variant.alt}
                fill
                sizes="7rem"
                className="object-contain p-2"
              />
            </span>
            <dl
              aria-live="polite"
              className="min-w-0 flex-1 text-sm"
            >
              <SummaryRow label="Finition principale" value={variant.shade.label} />
              <SummaryRow label="Métal" value={variant.assembly.label} />
              <SummaryRow label="Câble" value={variant.cable.label} />
              <SummaryRow label="Prix" value={priceLabel} />
            </dl>
          </div>

          {/* Quantité */}
          <div className="mt-8 flex items-center gap-4">
            <span className="text-sm uppercase tracking-wider text-ink-muted">
              Quantité
            </span>
            <div className="flex items-center rounded-none border border-ink/30">
              <button
                type="button"
                onClick={() => setQuantity(quantity - 1)}
                disabled={quantity <= 1}
                aria-label="Diminuer la quantité"
                className="flex h-10 w-10 items-center justify-center text-lg text-ink disabled:opacity-40"
              >
                −
              </button>
              <span
                aria-live="polite"
                className="w-10 text-center text-ink"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                disabled={quantity >= 9}
                aria-label="Augmenter la quantité"
                className="flex h-10 w-10 items-center justify-center text-lg text-ink disabled:opacity-40"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Action commerciale selon le mode */}
        <div
          className={
            isCheckout
              ? "u-accent-bg rounded-none p-6 text-white sm:p-8"
              : "rounded-none border border-ink/15 bg-paper p-6 sm:p-8"
          }
        >
          {isCheckout ? (
            <div className="space-y-4">
              <h3 className="text-2xl text-white">Prêt à commander.</h3>
              <p className="text-white/80">
                Vous finalisez le paiement de façon sécurisée. La configuration
                sélectionnée est transmise automatiquement.
              </p>
              <LinkButton
                href={checkoutHref}
                className="w-full !bg-white !text-ink hover:!bg-paper-deep sm:w-auto"
                onClick={() =>
                  track("order_cta_click", {
                    mode: "checkout",
                    variant: variant.id,
                    quantity,
                    source: getSource() ?? "direct",
                  })
                }
              >
                {orderCtaLabel()}
              </LinkButton>
            </div>
          ) : (
            <div>
              <h3 className="text-2xl">
                {siteConfig.purchaseMode === "preorder"
                  ? "Réservez votre pièce."
                  : "Demandez cette configuration."}
              </h3>
              <p className="mt-2 mb-6 text-ink-soft">
                Laissez-nous vos coordonnées : nous confirmons les détails
                (dimensions, source lumineuse, délai) et la disponibilité.
              </p>
              <LeadForm />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

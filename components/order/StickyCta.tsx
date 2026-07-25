"use client";

import { useEffect, useState } from "react";
import { useSelection } from "@/components/SelectionProvider";
import { siteConfig, orderCtaLabel } from "@/config/site";
import { track, getSource } from "@/lib/analytics";
import { scrollToId } from "@/lib/scroll";

/**
 * CTA fixe sur mobile. Apparaît après le hero et se retire quand la zone de
 * commande (ou le pied de page) est visible, pour ne jamais masquer l'action
 * finale. Compatible safe-area iOS.
 */
export function StickyCta() {
  const { variant } = useSelection();
  const [pastHero, setPastHero] = useState(false);
  const [nearOrder, setNearOrder] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    const order = document.getElementById("commande");
    const footer = document.querySelector("footer");

    const heroObs = new IntersectionObserver(
      ([e]) => setPastHero(!e.isIntersecting),
      { rootMargin: "-40% 0px 0px 0px" }
    );
    if (hero) heroObs.observe(hero);

    const targets = [order, footer].filter(Boolean) as Element[];
    let visibleCount = 0;
    const orderObs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        visibleCount += e.isIntersecting ? 1 : -1;
      }
      setNearOrder(visibleCount > 0);
    });
    targets.forEach((t) => orderObs.observe(t));

    return () => {
      heroObs.disconnect();
      orderObs.disconnect();
    };
  }, []);

  const visible = pastHero && !nearOrder;

  const handleClick = () => {
    track("order_cta_click", {
      mode: siteConfig.purchaseMode,
      variant: variant.id,
      from: "sticky",
      source: getSource() ?? "direct",
    });
    scrollToId("commande");
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-ink bg-paper-pure transition-transform duration-300 sm:hidden u-safe-bottom ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 px-4 pt-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-ink-muted">Votre configuration</p>
          <p className="truncate text-sm font-medium text-ink">{variant.name}</p>
        </div>
        <button
          type="button"
          onClick={handleClick}
          tabIndex={visible ? 0 : -1}
          className="min-h-[2.9rem] shrink-0 rounded-none bg-ink px-5 text-sm font-semibold text-paper"
        >
          {orderCtaLabel()}
        </button>
      </div>
    </div>
  );
}

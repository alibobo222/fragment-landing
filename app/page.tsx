import { SelectionProvider } from "@/components/SelectionProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/hero/Hero";
import { ProductStory } from "@/components/product-story/ProductStory";
import { Configurator } from "@/components/configurator/Configurator";
import { Materials } from "@/components/product-story/Materials";
import { Details } from "@/components/product-story/Details";
import { OrderSection } from "@/components/order/OrderSection";
import { Reassurance } from "@/components/product-story/Reassurance";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyCta } from "@/components/order/StickyCta";
import { Marquee } from "@/components/ui/Marquee";

export default function Home() {
  return (
    <SelectionProvider>
      <SiteHeader />
      <main>
        <Hero />
        <div className="border-y border-ink bg-ink py-4 font-display text-xl font-extrabold uppercase tracking-tight text-paper sm:text-2xl">
          <Marquee
            items={[
              "Noir Minéral",
              "Édition composable",
              "Sept matières",
              "Pièce d'atelier",
              "La lumière prend position",
            ]}
          />
        </div>
        <ProductStory />
        <Configurator />
        <Materials />
        <Details />
        <OrderSection />
        <Reassurance />
      </main>
      <SiteFooter />
      <StickyCta />
    </SelectionProvider>
  );
}

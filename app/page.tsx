import { SelectionProvider } from "@/components/SelectionProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/hero/Hero";
import { ProjectStory } from "@/components/chapters/ProjectStory";
import { MaterialsIntro } from "@/components/chapters/MaterialsIntro";
import { Configurator } from "@/components/configurator/Configurator";
import { Details } from "@/components/product-story/Details";
import { ContactSection } from "@/components/contact/ContactSection";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Expérience mobile immersive — pensée pour smartphone, centrée sur desktop.
 * Parcours : Découvrir → Comprendre → Explorer → Contacter.
 * Aucune logique e-commerce : FRAGMENT est présenté comme un projet de design.
 */
export default function Home() {
  return (
    <SelectionProvider>
      <div className="app-shell">
        <SiteHeader />
        <main>
          {/* Découvrir */}
          <Hero />
          {/* Comprendre */}
          <ProjectStory />
          {/* Explorer */}
          <MaterialsIntro />
          <Configurator />
          <Details />
          {/* Contacter */}
          <ContactSection />
        </main>
        <SiteFooter />
      </div>
    </SelectionProvider>
  );
}

import { SelectionProvider } from "@/components/SelectionProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/hero/Hero";
import { ProjectStory } from "@/components/chapters/ProjectStory";
import { MaterialsIntro } from "@/components/chapters/MaterialsIntro";
import { Configurator } from "@/components/configurator/Configurator";
import { Details } from "@/components/product-story/Details";
import { ContactSection } from "@/components/contact/ContactSection";
import { PrechargementLampe } from "@/components/PrechargementLampe";
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
          {/* Ne rend rien : télécharge et analyse le modèle 3D en temps mort,
              pendant la lecture du haut de page. Supprime l'attente devant un
              configurateur vide en données mobiles — le cas d'arrivée par QR
              code. Aucun contexte WebGL ouvert ici. */}
          <PrechargementLampe />
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

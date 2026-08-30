import type { Metadata } from "next";
import { PageLegale, TitreRubrique } from "@/components/legal/PageLegale";

export const metadata: Metadata = {
  title: "Mentions légales",
  description:
    "Éditeurs, directrice de la publication, hébergeur et propriété intellectuelle du site FRAGMENT — Noir Minéral.",
};

export default function MentionsLegales() {
  return (
    <PageLegale id="mentions-legales-title" titre="Mentions légales">
      <TitreRubrique>Éditeurs du site</TitreRubrique>
      <p>Ce site est édité conjointement par :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>Alicia Bonnard</li>
        <li>Vincent Cassat</li>
        <li>Clémence Birot</li>
      </ul>
      <p>
        Les éditeurs interviennent à titre non professionnel. À ce titre, et
        conformément à l’article 6, III, 2° de la loi n° 2004-575 du 21 juin
        2004 pour la confiance dans l’économie numérique, leurs coordonnées
        personnelles ne sont pas rendues publiques ; leur identité est tenue à la
        disposition de l’hébergeur.
      </p>
      <p>
        <strong className="font-medium text-ink">
          Directrice de la publication :
        </strong>{" "}
        Alicia Bonnard
      </p>
      <p>
        <strong className="font-medium text-ink">Contact :</strong>{" "}
        studionoirmineral@outlook.fr
      </p>
      <p>
        Aucune immatriculation au registre du commerce et des sociétés ni au
        répertoire des métiers : le projet n’a pas d’activité
        commerciale.
      </p>

      <TitreRubrique>Hébergement</TitreRubrique>
      <p>
        Vercel Inc.
        <br />
        340 S Lemon Ave #4133
        <br />
        Walnut, CA 91789
        <br />
        États-Unis
        <br />
        https://vercel.com
      </p>

      <TitreRubrique>Le projet</TitreRubrique>
      <p>
        FRAGMENT — Noir Minéral est un projet de design présentant une lampe de
        table sculpturale réalisée en matières recyclées. Une part de la matière
        première provient de la gamme Wasterial® d’ETNISI. ETNISI n’est
        pas éditeur de ce site et n’intervient pas dans sa publication.
      </p>
      <p>
        Le site est un site de présentation. Il ne propose aucune vente, aucun
        paiement, aucune prise de commande. Le formulaire de contact permet
        uniquement d’ouvrir un échange autour du projet.
      </p>

      <TitreRubrique>Propriété intellectuelle</TitreRubrique>
      <p>
        Les textes, photographies, modèles tridimensionnels et éléments graphiques
        présentés sur ce site sont la propriété de leurs auteurs. Toute
        reproduction ou représentation, totale ou partielle, sans autorisation
        préalable, est interdite.
      </p>
      <p>Les marques et noms cités appartiennent à leurs titulaires respectifs.</p>

      <TitreRubrique>Données personnelles</TitreRubrique>
      <p>
        Le traitement des données collectées par le formulaire de contact est
        décrit dans la{" "}
        <a
          href="/confidentialite/"
          className="text-ink underline underline-offset-4"
        >
          politique de confidentialité
        </a>
        .
      </p>

      <TitreRubrique>Signalement</TitreRubrique>
      <p>
        Toute remarque relative au contenu de ce site peut être adressée à
        l’adresse de contact indiquée plus haut.
      </p>
    </PageLegale>
  );
}

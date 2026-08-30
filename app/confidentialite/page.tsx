import type { Metadata } from "next";
import { PageLegale, TitreRubrique } from "@/components/legal/PageLegale";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Ce qui est collecté par le formulaire de contact, pourquoi, où cela va, combien de temps c’est conservé, et comment le faire supprimer.",
};

export default function Confidentialite() {
  return (
    <PageLegale
      id="confidentialite-title"
      titre="Politique de confidentialité"
      chapeau="Dernière mise à jour : 30 août 2026"
    >
      <p>
        Ce site présente un projet de design. Il ne collecte de données
        personnelles que lorsque vous choisissez de nous écrire, via le formulaire
        de contact. Cette page décrit précisément ce qui est collecté, pourquoi, où
        cela va, combien de temps c’est conservé, et comment le faire
        supprimer.
      </p>

      <TitreRubrique>Qui est responsable du traitement</TitreRubrique>
      <p>
        Alicia Bonnard, Vincent Cassat et Clémence Birot, éditeurs du site,
        agissant à titre non professionnel.
      </p>
      <p>Contact : studionoirmineral@outlook.fr</p>

      <TitreRubrique>
        Ce qui est collecté, et seulement quand vous écrivez
      </TitreRubrique>
      <p>Lorsque vous envoyez le formulaire de contact, sont enregistrés :</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          votre <strong className="font-medium text-ink">prénom</strong> ;
        </li>
        <li>
          votre <strong className="font-medium text-ink">adresse e-mail</strong> ;
        </li>
        <li>
          votre <strong className="font-medium text-ink">message</strong>, si vous
          en rédigez un — il est facultatif ;
        </li>
        <li>
          la{" "}
          <strong className="font-medium text-ink">
            configuration de la lampe
          </strong>{" "}
          affichée au moment de l’envoi, et son identifiant, à titre de
          contexte de votre demande ;
        </li>
        <li>
          la <strong className="font-medium text-ink">provenance</strong> de votre
          visite, lorsqu’elle est connue (par exemple : arrivée directe, ou
          via le QR code) ;
        </li>
        <li>
          votre <strong className="font-medium text-ink">consentement</strong> à
          être recontacté, et la date de l’envoi ;
        </li>
        <li>
          une{" "}
          <strong className="font-medium text-ink">
            empreinte technique dérivée de votre adresse IP
          </strong>
          . Cette empreinte est calculée à l’aide d’un secret et ne
          permet pas de retrouver l’adresse d’origine. Elle sert
          uniquement à empêcher qu’un même appareil sature le formulaire
          d’envois automatisés. L’adresse IP elle-même n’est pas
          conservée.
        </li>
      </ul>
      <p>
        Le formulaire comporte également un champ invisible destiné à piéger les
        robots. S’il est rempli, la demande est ignorée et rien n’est
        enregistré.
      </p>
      <p>
        Aucune autre donnée n’est collectée. En particulier, aucune donnée
        n’est recueillie du simple fait de consulter les pages du site.
      </p>

      <TitreRubrique>Pourquoi, et sur quelle base</TitreRubrique>
      <p>
        Ces données servent à une seule chose : vous répondre et poursuivre
        l’échange que vous avez engagé au sujet du projet.
      </p>
      <p>
        La base légale est votre{" "}
        <strong className="font-medium text-ink">consentement</strong>, exprimé par
        la case que vous cochez avant l’envoi. Vous pouvez le retirer à tout
        moment, ce qui entraîne la suppression de votre demande.
      </p>
      <p>
        Les données ne sont ni vendues, ni louées, ni transmises à des tiers à des
        fins commerciales ou publicitaires. Elles ne servent à aucune prospection.
      </p>

      <TitreRubrique>Où vont vos données</TitreRubrique>
      <p>
        Deux prestataires techniques interviennent, et uniquement pour permettre au
        formulaire de fonctionner :
      </p>
      <p>
        <strong className="font-medium text-ink">Supabase</strong> — hébergement de
        la base de données dans laquelle votre demande est enregistrée, et
        exécution de la fonction qui la reçoit. Le projet est hébergé en Irlande
        (région <span className="u-mono">eu-west-1</span>), donc au sein de
        l’Union européenne : vos données ne quittent pas l’Espace
        économique européen à cette étape.
      </p>
      <p>
        <strong className="font-medium text-ink">Resend</strong> — envoi du
        courriel de notification qui nous prévient de votre demande. Resend Inc.
        est établie aux États-Unis ; ce transfert est encadré par les clauses
        contractuelles types de la Commission européenne.
      </p>
      <p>
        L’accès aux demandes enregistrées est réservé aux éditeurs du site. La
        table qui les contient n’est accessible depuis aucun navigateur.
      </p>

      <TitreRubrique>Combien de temps</TitreRubrique>
      <p>
        Vos données sont conservées{" "}
        <strong className="font-medium text-ink">
          trois ans à compter de notre dernier échange
        </strong>
        , puis supprimées.
      </p>
      <p>
        Si vous demandez leur suppression avant ce terme, elle intervient sans
        délai.
      </p>

      <TitreRubrique>Cookies et traceurs</TitreRubrique>
      <p>
        Ce site{" "}
        <strong className="font-medium text-ink">ne dépose aucun cookie</strong> et
        n’utilise{" "}
        <strong className="font-medium text-ink">
          aucun outil de mesure d’audience
        </strong>
        . Il n’y a donc pas de bandeau de consentement à afficher : il
        n’y a rien à consentir.
      </p>
      <p>
        Le configurateur mémorise vos préférences d’affichage — configuration
        choisie, type de perforation, lampe allumée ou éteinte — dans la mémoire de
        session de votre navigateur. Ces informations restent sur votre appareil,
        ne nous sont jamais transmises, et disparaissent lorsque vous fermez
        l’onglet.
      </p>

      <TitreRubrique>Vos droits</TitreRubrique>
      <p>
        Vous disposez d’un droit d’accès, de rectification,
        d’effacement, d’opposition, de limitation du traitement et de
        portabilité de vos données. Vous pouvez également retirer votre
        consentement à tout moment.
      </p>
      <p>
        Pour exercer ces droits, écrivez à studionoirmineral@outlook.fr. Nous
        répondons dans un délai d’un mois.
      </p>
      <p>
        Si vous estimez, après nous avoir contactés, que vos droits ne sont pas
        respectés, vous pouvez introduire une réclamation auprès de la Commission
        nationale de l’informatique et des libertés :
      </p>
      <p>
        Commission nationale de l’informatique et des libertés (CNIL)
        <br />
        3 place de Fontenoy — TSA 80715
        <br />
        75334 Paris Cedex 07
        <br />
        https://www.cnil.fr
      </p>

      <TitreRubrique>Sécurité</TitreRubrique>
      <p>
        Les échanges avec le site sont chiffrés. Les demandes sont enregistrées
        dans une base dont l’accès direct est fermé au public, et les clés
        d’accès ne figurent jamais dans le code du site consulté par votre
        navigateur.
      </p>

      <TitreRubrique>Modifications</TitreRubrique>
      <p>
        Cette politique peut être mise à jour si le fonctionnement du site évolue.
        La date de dernière mise à jour figure en tête de page.
      </p>
    </PageLegale>
  );
}

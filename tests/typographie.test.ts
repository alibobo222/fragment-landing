import { describe, it, expect } from "vitest";
import { composer } from "@/lib/typographie";

const INSEC = " ";
const APO = "’";

describe("composer — micro-typographie française", () => {
  describe("ponctuation double", () => {
    it("pose une insécable avant les deux-points", () => {
      expect(composer("Une seule chose : vous répondre.")).toBe(
        `Une seule chose${INSEC}: vous répondre.`
      );
    });

    it("pose une insécable avant point-virgule, exclamation et interrogation", () => {
      expect(composer("un ; deux ! trois ?")).toBe(
        `un${INSEC}; deux${INSEC}! trois${INSEC}?`
      );
    });

    it("insère l'insécable même quand aucune espace ne précède", () => {
      expect(composer("Attention: ceci")).toBe(`Attention${INSEC}: ceci`);
    });

    it("ne touche pas aux deux-points sans espace après — ratios, horaires", () => {
      expect(composer("format 16:9 large")).toBe("format 16:9 large");
    });
  });

  describe("guillemets français", () => {
    it("pose une insécable à l'intérieur des guillemets", () => {
      expect(composer("le « bon » choix")).toBe(`le${INSEC}«${INSEC}bon${INSEC}» choix`);
    });

    it("ajoute l'insécable même si elle manquait", () => {
      expect(composer("le «bon» choix")).toBe(`le${INSEC}«${INSEC}bon${INSEC}» choix`);
    });
  });

  describe("nombres et unités", () => {
    it("lie le nombre à son unité", () => {
      expect(composer("recommandée à 4000 K")).toContain(`4000${INSEC}K`);
    });

    it("lie les tranches d'un grand nombre", () => {
      expect(composer("environ 4 000 pièces")).toContain(`4${INSEC}000`);
    });

    it("traite le cas réel de la fiche technique", () => {
      const r = composer("Culot E27 — ampoule recommandée à 4 000 K");
      expect(r).toContain(`4${INSEC}000${INSEC}K`);
    });

    it("ne traite pas un mot ordinaire comme une unité", () => {
      // « composants » n'est pas une unité : le lien vient de la règle des mots
      // courts (un nombre d un ou deux chiffres est un orphelin comme « la »),
      // pas de celle-ci — d où un nombre à trois chiffres pour l isoler.
      expect(composer("environ 666 composants ici")).not.toContain(`666${INSEC}composants`);
    });
  });

  describe("mots courts en fin de ligne", () => {
    it("retient un mot d'une lettre", () => {
      expect(composer("fabriqué à partir")).toBe(`fabriqué à${INSEC}partir`);
    });

    it("retient un mot de deux lettres", () => {
      expect(composer("le grain de la matière")).toContain(`de${INSEC}la`);
    });

    it("ne retient pas un mot de trois lettres ou plus", () => {
      expect(composer("une forme constante ici")).not.toContain(`une${INSEC}forme`);
    });

    it("n'enchaîne pas les mots courts en un bloc long", () => {
      // Piège mesuré : « il y a » collé d'un bloc déborde à 320 px.
      const r = composer("il y a une lampe");
      expect(r.split(INSEC).length - 1).toBeLessThanOrEqual(2);
    });
  });

  describe("apostrophe typographique", () => {
    it("remplace l'apostrophe droite", () => {
      expect(composer("l'atelier")).toBe(`l${APO}atelier`);
    });

    it("traite toutes les occurrences d'une même phrase", () => {
      expect(composer("l'âme d'un objet")).toContain(`d${APO}un`);
    });
  });

  describe("garde-fous", () => {
    it("laisse une chaîne vide intacte", () => {
      expect(composer("")).toBe("");
    });

    it("n'introduit jamais d'espace ordinaire supplémentaire", () => {
      const avant = "Une phrase : simple, avec « des guillemets » et l'apostrophe.";
      const apres = composer(avant);
      expect(apres.replace(new RegExp(INSEC, "g"), " ")).toBe(avant.replace(/'/g, APO));
    });

    it("est idempotente — composer deux fois ne change rien de plus", () => {
      const une = composer("Une chose : « ainsi » à 4 000 K, l'atelier.");
      expect(composer(une)).toBe(une);
    });
  });
});

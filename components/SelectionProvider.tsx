"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  defaultPerforation,
  defaultVariantId,
  getVariant,
  type PerforationShape,
  type ProductVariant,
} from "@/data/product";
import { lampLightConfig } from "@/data/lampModel";
import { track } from "@/lib/analytics";

interface SelectionContextValue {
  selectedId: string;
  variant: ProductVariant;
  quantity: number;
  /** Sélectionne une variante. `silent` évite de renvoyer un événement analytics. */
  select: (id: string, opts?: { silent?: boolean; from?: string }) => void;
  setQuantity: (n: number) => void;
  /** État lumineux partagé de la lampe 3D (hero + atelier). */
  lampOn: boolean;
  setLampOn: (on: boolean) => void;
  /** Température de couleur de la lumière, en kelvins — réglage CONTINU entre
   *  `lampLightConfig.kelvinMin` et `kelvinMax` (mélange des deux canaux d'un
   *  module LED Tunable White), et non un choix binaire chaud/froid. */
  kelvin: number;
  setKelvin: (kelvin: number) => void;
  /** Géométrie des perforations de la pièce d'assemblage. */
  perforation: PerforationShape;
  setPerforation: (shape: PerforationShape) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

const STORAGE_KEY = "etnisi:variant";
const PERFORATION_KEY = "etnisi:perforation";

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string>(defaultVariantId);
  const [quantity, setQuantity] = useState<number>(1);
  // État lumineux partagé. La lampe démarre ÉTEINTE : l'allumage est un geste
  // de l'utilisateur, pas un état imposé. On voit donc d'abord la pièce et ses
  // matières telles quelles, sous le seul éclairage de studio ; la lumière n'est
  // ajoutée que si on la demande. Le bouton reflète cet état dès le départ.
  const [lampOn, setLampOn] = useState<boolean>(false);
  const [kelvin, setKelvinState] = useState<number>(lampLightConfig.defaultKelvin);
  // Option produit, mémorisée le temps de la session comme la variante.
  const [perforation, setPerforationState] =
    useState<PerforationShape>(defaultPerforation);

  // Diffuse la couleur dominante de la variante sélectionnée à toute la page
  // (var CSS `--accent`). Centralisé ici → cohérent quel que soit le chapitre
  // 3D visible (hero ou atelier) et au changement de configuration.
  useEffect(() => {
    const v = getVariant(selectedId);
    const root = document.documentElement.style;
    root.setProperty("--accent", v.accent);
    root.setProperty("--accent-on-dark", v.accentOnDark);
  }, [selectedId]);

  // Restaure la variante choisie pendant la session (sans casser le SSR).
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored && getVariant(stored).id === stored) {
        setSelectedId(stored);
      }
    } catch {
      /* sessionStorage indisponible : on garde la valeur par défaut. */
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(PERFORATION_KEY);
      if (stored === "round" || stored === "square" || stored === "none") {
        setPerforationState(stored);
      }
    } catch {
      /* sessionStorage indisponible : on garde la valeur par défaut. */
    }
  }, []);

  // Non persisté entre sessions, comme l'ancien réglage chaud/froid qu'il
  // remplace : c'est une préférence d'ambiance du moment, pas un choix produit.
  const setKelvin = useCallback((k: number) => {
    setKelvinState(
      Math.min(lampLightConfig.kelvinMax, Math.max(lampLightConfig.kelvinMin, k))
    );
  }, []);

  // Partagée par le choix manuel (les trois boutons) et la recommandation
  // appliquée au changement de configuration (`select`, plus bas) : même
  // état, même persistance de session — seule la provenance envoyée à
  // l'analytique diffère (voir `track` ci-dessous). Distinguer les deux SANS
  // dupliquer cette logique est tout le rôle de ce helper.
  const applyPerforation = useCallback(
    (shape: PerforationShape, source: "user" | "reco") => {
      setPerforationState(shape);
      try {
        window.sessionStorage.setItem(PERFORATION_KEY, shape);
      } catch {
        /* ignore */
      }
      // Un seul événement, un champ `source` — plutôt qu'un événement
      // séparé pour la bascule automatique : même schéma que
      // `material_variant_selected`/`from` juste en dessous (une origine
      // contextuelle sur l'événement existant, pas une famille d'événements
      // par déclencheur), et ça garde une seule requête pour reconstituer
      // « quelle perforation est affichée, et pourquoi » — un filtre sur
      // `source` suffit ensuite à isoler les bascules automatiques du choix
      // utilisateur réel dans l'analytique.
      track("perforation_selected", { shape, source });
    },
    []
  );

  const setPerforation = useCallback(
    (shape: PerforationShape) => applyPerforation(shape, "user"),
    [applyPerforation]
  );

  const select = useCallback(
    (id: string, opts?: { silent?: boolean; from?: string }) => {
      const variant = getVariant(id);
      setSelectedId(variant.id);
      try {
        window.sessionStorage.setItem(STORAGE_KEY, variant.id);
      } catch {
        /* ignore */
      }
      // La recommandation de la configuration devient le point de départ de
      // la perforation — écrase un choix manuel antérieur, y compris en
      // resélectionnant la configuration déjà active (aucune garde sur un
      // changement d'id : c'est le SEUL déclencheur de cette bascule, elle
      // ne doit dépendre de rien d'autre). Un choix manuel ultérieur prévaut
      // ensuite jusqu'au PROCHAIN changement de configuration — pas au-delà.
      applyPerforation(variant.perforation ?? defaultPerforation, "reco");
      if (!opts?.silent) {
        track("material_variant_selected", {
          variant: variant.id,
          name: variant.name,
          from: opts?.from ?? "configurator",
        });
      }
    },
    [applyPerforation]
  );

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedId,
      variant: getVariant(selectedId),
      quantity,
      select,
      setQuantity: (n: number) => setQuantity(Math.min(9, Math.max(1, n))),
      lampOn,
      setLampOn,
      kelvin,
      setKelvin,
      perforation,
      setPerforation,
    }),
    [selectedId, quantity, select, lampOn, kelvin, setKelvin, perforation, setPerforation]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) {
    throw new Error("useSelection doit être utilisé dans <SelectionProvider>.");
  }
  return ctx;
}

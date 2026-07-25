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
  defaultVariantId,
  getVariant,
  type ProductVariant,
} from "@/data/product";
import { track } from "@/lib/analytics";

interface SelectionContextValue {
  selectedId: string;
  variant: ProductVariant;
  quantity: number;
  /** Sélectionne une variante. `silent` évite de renvoyer un événement analytics. */
  select: (id: string, opts?: { silent?: boolean; from?: string }) => void;
  setQuantity: (n: number) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

const STORAGE_KEY = "etnisi:variant";

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedId, setSelectedId] = useState<string>(defaultVariantId);
  const [quantity, setQuantity] = useState<number>(1);

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

  const select = useCallback(
    (id: string, opts?: { silent?: boolean; from?: string }) => {
      const variant = getVariant(id);
      setSelectedId(variant.id);
      try {
        window.sessionStorage.setItem(STORAGE_KEY, variant.id);
      } catch {
        /* ignore */
      }
      if (!opts?.silent) {
        track("material_variant_selected", {
          variant: variant.id,
          name: variant.name,
          from: opts?.from ?? "configurator",
        });
      }
    },
    []
  );

  const value = useMemo<SelectionContextValue>(
    () => ({
      selectedId,
      variant: getVariant(selectedId),
      quantity,
      select,
      setQuantity: (n: number) => setQuantity(Math.min(9, Math.max(1, n))),
    }),
    [selectedId, quantity, select]
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

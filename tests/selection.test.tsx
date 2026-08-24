import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectionProvider, useSelection } from "@/components/SelectionProvider";
import { defaultVariantId, perforationOptions, variants } from "@/data/product";

function Consumer() {
  const { variant, select, quantity, setQuantity, perforation, setPerforation } =
    useSelection();
  return (
    <div>
      <p data-testid="summary">
        {variant.name} — {variant.materialsSummary}
      </p>
      <p data-testid="qty">{quantity}</p>
      <p data-testid="perforation">{perforation}</p>
      {variants.map((v) => (
        <button key={v.id} onClick={() => select(v.id)}>
          {v.name}
        </button>
      ))}
      {perforationOptions.map((opt) => (
        <button key={opt.value} onClick={() => setPerforation(opt.value)}>
          {opt.label}
        </button>
      ))}
      <button onClick={() => setQuantity(quantity + 1)}>plus</button>
      <button onClick={() => setQuantity(0)}>zero</button>
    </div>
  );
}

describe("SelectionProvider", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("démarre sur la variante par défaut", () => {
    render(
      <SelectionProvider>
        <Consumer />
      </SelectionProvider>
    );
    const def = variants.find((v) => v.id === defaultVariantId)!;
    expect(screen.getByTestId("summary")).toHaveTextContent(def.name);
  });

  it("met à jour le résumé quand on choisit une variante", () => {
    render(
      <SelectionProvider>
        <Consumer />
      </SelectionProvider>
    );
    const target = variants.find((v) => v.id === "verre-bleu-acier-anodise")!;
    fireEvent.click(screen.getByText(target.name));
    expect(screen.getByTestId("summary")).toHaveTextContent(
      target.materialsSummary
    );
  });

  it("borne la quantité au minimum de 1", () => {
    render(
      <SelectionProvider>
        <Consumer />
      </SelectionProvider>
    );
    fireEvent.click(screen.getByText("zero"));
    expect(screen.getByTestId("qty")).toHaveTextContent("1");
  });

  it("applique la perforation recommandée à chaque changement de configuration, mais un choix manuel prévaut jusqu'au prochain changement", () => {
    render(
      <SelectionProvider>
        <Consumer />
      </SelectionProvider>
    );
    // Ancré sur `index`, pas sur le nom (renommable) — voir data/product.ts.
    const c01 = variants.find((v) => v.index === "01")!;
    const c02 = variants.find((v) => v.index === "02")!;
    const c03 = variants.find((v) => v.index === "03")!;

    fireEvent.click(screen.getByText(c01.name));
    expect(screen.getByTestId("perforation")).toHaveTextContent("square");

    fireEvent.click(screen.getByText("Ronde"));
    expect(screen.getByTestId("perforation")).toHaveTextContent("round");

    fireEvent.click(screen.getByText(c02.name));
    expect(screen.getByTestId("perforation")).toHaveTextContent("round");

    fireEvent.click(screen.getByText(c03.name));
    expect(screen.getByTestId("perforation")).toHaveTextContent("none");

    fireEvent.click(screen.getByText("Carrée"));
    expect(screen.getByTestId("perforation")).toHaveTextContent("square");

    // Reselectionner la configuration déjà active réapplique sa
    // recommandation — même sans changement d'id.
    fireEvent.click(screen.getByText(c03.name));
    expect(screen.getByTestId("perforation")).toHaveTextContent("none");
  });
});

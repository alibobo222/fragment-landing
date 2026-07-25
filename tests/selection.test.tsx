import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SelectionProvider, useSelection } from "@/components/SelectionProvider";
import { defaultVariantId, variants } from "@/data/product";

function Consumer() {
  const { variant, select, quantity, setQuantity } = useSelection();
  return (
    <div>
      <p data-testid="summary">
        {variant.name} — {variant.materialsSummary}
      </p>
      <p data-testid="qty">{quantity}</p>
      {variants.map((v) => (
        <button key={v.id} onClick={() => select(v.id)}>
          {v.name}
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
});

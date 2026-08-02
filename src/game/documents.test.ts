import { describe, expect, it } from "vitest";
import {
  DOCUMENT_COUNT,
  SECRET_PHOTO_ID,
  allDocumentsRead,
  isBurnablePaper,
  isDocumentItemId,
  noteDocumentRead,
  noteDocumentsFound,
  pickDocumentItemId,
  veryRarePoolFor,
  withoutRecoveredDocument,
} from "./documents";
import { lightFire, placeInFireplace } from "./fire";
import { createNewRun, emptyFireplace } from "./persist";
import { ITEMS, itemActions, itemComfortBonus } from "./items";

describe("documents", () => {
  it("defines nine document items sharing document art aliases", () => {
    for (let n = 1; n <= DOCUMENT_COUNT; n++) {
      const id = `document_${n}`;
      expect(isDocumentItemId(id)).toBe(true);
      expect(ITEMS[id]?.stack).toBe(1);
      expect(ITEMS[id]?.type).toBe("Document");
    }
  });

  it("picks a numbered document and tracks recovered / burn", () => {
    const rng = (() => {
      let i = 0;
      return () => {
        i += 1;
        return (i % 9) / 9;
      };
    })();
    const id = pickDocumentItemId(rng);
    expect(isDocumentItemId(id)).toBe(true);
    const recovered = noteDocumentsFound([], [id, "wood", id]);
    expect(recovered).toHaveLength(1);
    expect(withoutRecoveredDocument(recovered, id)).toEqual([]);
  });

  it("accepts magazine, book, and documents as burnable paper", () => {
    expect(isBurnablePaper("tinder")).toBe(true);
    expect(isBurnablePaper("magazine")).toBe(true);
    expect(isBurnablePaper("book")).toBe(true);
    expect(isBurnablePaper("document_4")).toBe(true);
    expect(isBurnablePaper("wood")).toBe(false);
  });

  it("burning a document as tinder removes it from the recovered set", () => {
    const t0 = 5_000_000;
    let state = createNewRun(t0);
    state = {
      ...state,
      recoveredDocuments: [4, 7],
      inventory: [{ itemId: "document_4", qty: 1 }],
      fireplace: {
        ...emptyFireplace(),
        built: "simple",
        lit: false,
        syncedAt: t0,
        slots: {
          ignition: { itemId: "flint", qty: 1, durability: 8 },
          tinder: null,
          fuelWood: 2,
          food: [null],
        },
      },
    };
    const placed = placeInFireplace(
      state,
      0,
      { kind: "tinder" },
      t0,
    );
    expect(placed).not.toBeNull();
    expect(placed!.fireplace.slots.tinder?.itemId).toBe("document_4");
    const lit = lightFire(placed!, t0);
    expect(lit.fireplace.lit).toBe(true);
    expect(lit.recoveredDocuments).toEqual([7]);
    expect(lit.diary.some((d) => /Document #4/i.test(d.text))).toBe(true);
  });
});

describe("secret photograph unlock", () => {
  it("stays out of the very-rare pool until all nine documents are read", () => {
    expect(veryRarePoolFor("chest", []).includes(SECRET_PHOTO_ID)).toBe(false);
    expect(veryRarePoolFor("large", [1, 2, 3]).includes(SECRET_PHOTO_ID)).toBe(
      false,
    );
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(allDocumentsRead(all)).toBe(true);
    expect(veryRarePoolFor("chest", all)).toHaveLength(9);
    expect(veryRarePoolFor("large", all).includes(SECRET_PHOTO_ID)).toBe(true);
  });

  it("never appears for small or medium even when unlocked", () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(veryRarePoolFor("small", all).includes(SECRET_PHOTO_ID)).toBe(false);
    expect(veryRarePoolFor("medium", all).includes(SECRET_PHOTO_ID)).toBe(
      false,
    );
  });

  it("keeps reads permanent when marking the ninth document", () => {
    expect(allDocumentsRead([1, 2, 3, 4, 5, 6, 7, 8])).toBe(false);
    expect(
      allDocumentsRead(noteDocumentRead([1, 2, 3, 4, 5, 6, 7, 8], 9)),
    ).toBe(true);
  });

  it("defines LAB04_S4_A51 with Look and −10 comfort", () => {
    const def = ITEMS[SECRET_PHOTO_ID];
    expect(def?.name).toBe("LAB04_S4_A51");
    expect(itemComfortBonus(def!)).toBe(-10);
    expect(itemActions(def!)).toEqual(["Look", "Destroy"]);
  });
});

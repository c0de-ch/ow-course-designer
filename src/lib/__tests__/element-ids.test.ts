import { assignElementIds } from "../element-ids";

let n = 0;
const newId = () => `new${++n}`;

describe("assignElementIds", () => {
  beforeEach(() => { n = 0; });

  it("keeps the ids, so a gate's buoys are still found after a reload", () => {
    const els = [
      { id: "b1", metadata: null },
      { id: "b2", metadata: null },
      { id: "g", metadata: JSON.stringify({ between: ["b1", "b2"], mandatoryLaps: "1" }) },
    ];
    expect(assignElementIds(els, new Set(), newId)).toEqual(els);
  });

  it("replaces missing, duplicate and foreign ids and rewrites the gate's references", () => {
    const out = assignElementIds(
      [
        { id: "b1", metadata: null },        // taken by another course
        { metadata: null },                  // no id
        { id: "b3", metadata: null },
        { id: "b3", metadata: null },        // duplicate
        { id: "g", metadata: JSON.stringify({ between: ["b1", "b3"] }) },
      ],
      new Set(["b1"]),
      newId
    );
    expect(out.map((e) => e.id)).toEqual(["new1", "new2", "b3", "new3", "g"]);
    // b1 → new1; b3 kept (its first use)
    expect(JSON.parse(out[4].metadata!)).toEqual({ between: ["new1", "b3"] });
  });

  it("leaves metadata it cannot read alone", () => {
    const out = assignElementIds([{ id: "x y", metadata: "not json" }], new Set(), newId);
    expect(out).toEqual([{ id: "new1", metadata: "not json" }]);
  });
});

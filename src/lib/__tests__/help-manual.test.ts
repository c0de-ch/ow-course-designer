import { findCachedResponse } from "../help-manual";

describe("findCachedResponse", () => {
  it("matches on plural/punctuated keywords via tokenization", () => {
    const a = findCachedResponse("How do I add buoys to a new course?");
    expect(a).not.toBeNull();
    expect(a).toMatch(/marker|buoy/i);
  });

  it("matches export/download phrasing", () => {
    expect(findCachedResponse("Can I download a PDF?")).toMatch(/PDF|Export/i);
  });

  it("matches share/link question", () => {
    expect(findCachedResponse("How do I share a link?")).toMatch(/share/i);
  });

  it("ignores stop-word-only queries", () => {
    expect(findCachedResponse("What? How?")).toBeNull();
  });

  it("returns null when no topic has >= 2 overlapping tokens", () => {
    expect(findCachedResponse("Tell me about banana weather.")).toBeNull();
  });

  it("matches gate question with word-order and punctuation variation", () => {
    expect(findCachedResponse("create a gate, how?")).toMatch(/gate/i);
  });
});

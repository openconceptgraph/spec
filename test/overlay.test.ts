import { describe, expect, it } from "vitest";
import { readBundle } from "../src/bundle.js";
import { type PinnedBase, validateOverlay } from "../src/overlay.js";
import { validateRelease } from "../src/release.js";
import { byCode, edited, errorRules, OVERLAY_DIR, RELEASE_DIR } from "./helpers.js";

function pinned(): PinnedBase {
  const bundle = readBundle(RELEASE_DIR);
  const r = validateRelease(bundle);
  if (!r.index) throw new Error("the example release did not validate");
  return { index: r.index, manifestRaw: bundle.manifestRaw };
}

describe("the example overlay", () => {
  it("conforms against the release it is pinned to", () => {
    const r = validateOverlay(readBundle(OVERLAY_DIR), pinned());
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("warns that the pin is unchecked without a base release", () => {
    const r = validateOverlay(readBundle(OVERLAY_DIR));
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.rule)).toEqual(["base-not-checked"]);
  });
});

describe("the client's own records", () => {
  it("refuses an artefact kind the profile does not define", () => {
    const r = validateOverlay(edited(OVERLAY_DIR, (d) => (d.artefacts[0].kind = "worksheet")), pinned());
    expect(errorRules(r)).toContain("artefact-kind");
  });

  it("refuses records in another client's namespace", () => {
    const r = validateOverlay(edited(OVERLAY_DIR, (d) => (d.artefacts[0].namespace = "someone-else")), pinned());
    expect(errorRules(r)).toContain("namespace");
  });

  it("refuses an alignment type the profile does not allow for the kind", () => {
    const r = validateOverlay(
      edited(OVERLAY_DIR, (d) => {
        const lesson = byCode(d.artefacts, "EL-G8-L03");
        d.alignments.find((a: any) => a.artefact === lesson.id).alignmentType = "tests";
      }),
      pinned(),
    );
    expect(errorRules(r)).toContain("alignment-allowed");
  });

  it("refuses an alignment pointing at the wrong kind of base object", () => {
    const r = validateOverlay(
      edited(OVERLAY_DIR, (d) => {
        const reveals = d.alignments.find((a: any) => a.alignmentType === "reveals");
        reveals.targetKind = "concept";
      }),
      pinned(),
    );
    expect(errorRules(r)).toContain("alignment-target");
  });

  it("catches a placement for an artefact that does not exist", () => {
    const r = validateOverlay(edited(OVERLAY_DIR, (d) => (d.placements[0].artefact = "66666666-6666-4666-8666-666666666666")), pinned());
    expect(errorRules(r)).toContain("reference");
  });
});

describe("the pin to a base release", () => {
  it("refuses a target that is not in the pinned release", () => {
    const r = validateOverlay(edited(OVERLAY_DIR, (d) => (d.alignments[0].target = "77777777-7777-4777-8777-777777777777")), pinned());
    expect(errorRules(r)).toEqual(["alignment-target"]);
  });

  it("refuses a different release version", () => {
    const r = validateOverlay(edited(OVERLAY_DIR, (_d, m) => (m.base.version = "0.2.0")), pinned());
    expect(errorRules(r)).toContain("base-pin");
  });

  it("refuses a release whose manifest is not the exact one pinned", () => {
    const r = validateOverlay(edited(OVERLAY_DIR, (_d, m) => (m.base.manifestSha256 = "f".repeat(64))), pinned());
    expect(errorRules(r)).toContain("base-pin");
  });

  it("refuses an education level the base does not have", () => {
    const r = validateOverlay(edited(OVERLAY_DIR, (d) => (d.placements[0].educationLevel = d.artefacts[0].id)), pinned());
    expect(errorRules(r)).toContain("reference");
  });
});

describe("a pin to a draft bundle", () => {
  it("is checked like a pin to a release, with a warning that it is not one", () => {
    const draft = validateRelease(
      edited(RELEASE_DIR, (_d, m) => {
        m.kind = "base-draft";
        m.version = "0.1.0-draft.1";
      }),
      { draft: true },
    );
    if (!draft.index) throw new Error("the draft did not validate");
    const r = validateOverlay(
      edited(OVERLAY_DIR, (_d, m) => {
        m.base.version = "0.1.0-draft.1";
        delete m.base.manifestSha256;
      }),
      { index: draft.index },
    );
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.rule)).toEqual(["base-draft"]);
  });
});

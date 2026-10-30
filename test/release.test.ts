import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readBundle } from "../src/bundle.js";
import { findCycles, validateRelease } from "../src/release.js";
import { byCode, edited, errorRules, RELEASE_DIR, rules } from "./helpers.js";

const link = (data: Record<string, any>, linkType: string, fromCode: string, toCode: string) => {
  const c = (code: string) => byCode(data.concepts, code).id;
  return data.links.find((l: any) => l.linkType === linkType && l.from === c(fromCode) && l.to === c(toCode));
};

describe("the example release", () => {
  it("conforms, with no warnings", () => {
    const r = validateRelease(readBundle(RELEASE_DIR));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.ok).toBe(true);
  });
});

describe("manifest and files", () => {
  it("catches a file whose bytes no longer match its hash", () => {
    const bundle = readBundle(RELEASE_DIR);
    bundle.raw!.concepts = Buffer.from(readFileSync(join(RELEASE_DIR, "concepts.json"), "utf8").replace("add integers", "add integers!"));
    expect(errorRules(validateRelease(bundle))).toContain("manifest-files");
  });

  it("catches a count that does not match", () => {
    const bundle = edited(RELEASE_DIR);
    // edited() recounts, so break the count after it.
    (bundle.manifest as any).files.concepts.count = 99;
    expect(errorRules(validateRelease(bundle))).toContain("manifest-files");
  });

  it("refuses a spec version it does not implement", () => {
    const r = validateRelease(edited(RELEASE_DIR, (_d, m) => (m.spec = "0.2.0")));
    expect(errorRules(r)).toEqual(["spec-version"]);
  });

  it("checks every file against its schema, and skips the rules when one fails", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.concepts[0].id = "not-a-uuid")));
    expect(errorRules(r)).toContain("schema");
    expect(rules(r)).toContain("skipped");
  });

  it("rejects a statement carrying a language map instead of its document's text", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.statements[0].text = { en: d.statements[0].text })));
    expect(errorRules(r)).toContain("schema");
  });
});

describe("identity and references", () => {
  it("catches an ID used twice", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.families[0].id = d.concepts[0].id)));
    expect(errorRules(r)).toContain("unique-ids");
  });

  it("catches a link to an object that is not in the release", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        link(d, "needs", "INT-02", "INT-01").to = "11111111-1111-4111-8111-111111111111";
      }),
    );
    expect(errorRules(r)).toContain("reference");
  });

  it("catches a reference to the wrong kind of object", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.levels[0].concept = d.families[0].id)));
    expect(errorRules(r)).toContain("reference");
  });

  it("catches a node type the framework does not declare", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.nodes[1].nodeType = "strand")));
    expect(errorRules(r)).toContain("node-type");
  });

  it("catches statements whose parents loop", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        const [a, b] = [byCode(d.statements, "8/1.1/n02"), byCode(d.statements, "8/1.1/n03")];
        a.parent = b.id;
      }),
    );
    expect(errorRules(r)).toContain("node-tree");
  });

  it("catches a duplicate concept code, including against aliases", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => d.concepts[1].aliases.push(d.concepts[0].code)));
    expect(errorRules(r)).toContain("unique-codes");
  });

  it("catches a placement whose weeks run backwards", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => Object.assign(d.placements[0], { weekStart: 3, weekEnd: 1 })));
    expect(errorRules(r)).toContain("placement");
  });
});

describe("the graph's rules", () => {
  it("catches a link joining the wrong kinds", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        const l = link(d, "needs", "INT-02", "INT-01");
        Object.assign(l, { from: d.statements[0].id, fromKind: "statement" });
      }),
    );
    expect(errorRules(r)).toContain("link-endpoints");
  });

  it("catches a needs loop and names it by code", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        const template = link(d, "needs", "INT-02", "INT-01");
        d.links.push({ ...template, id: "22222222-2222-4222-8222-222222222222", from: byCode(d.concepts, "INT-01").id, to: byCode(d.concepts, "INT-03").id });
        d.reviews.push({ ...d.reviews.find((x: any) => x.object === template.id), object: "22222222-2222-4222-8222-222222222222" });
      }),
    );
    const loop = r.errors.find((i) => i.rule === "needs-acyclic");
    expect(loop?.message).toMatch(/INT-0\d → INT-0\d → INT-0\d → INT-0\d/);
  });

  it("requires every concept to be defined by a statement", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        const id = byCode(d.concepts, "INT-01").id;
        d.links = d.links.filter((l: any) => !(l.linkType === "defines" && l.to === id));
      }),
    );
    expect(errorRules(r)).toContain("concept-defined");
  });

  it("allows a concept one family at most", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        d.families.push({ ...d.families[0], id: "33333333-3333-4333-8333-333333333333", code: "INT2" });
        const partOf = d.links.find((l: any) => l.linkType === "part-of");
        d.links.push({ ...partOf, id: "44444444-4444-4444-8444-444444444444", to: "33333333-3333-4333-8333-333333333333" });
      }),
    );
    expect(errorRules(r)).toContain("one-family");
  });

  it("warns when a revise statement defines a concept", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        const defines = d.links.find((l: any) => l.linkType === "defines");
        defines.from = byCode(d.statements, "8/1.1/c03").id;
      }),
    );
    expect(r.warnings.map((w) => w.rule)).toContain("revise-defines");
  });

  it("warns about an unsourced mistake and a concept without one", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) => {
        d.misconceptions[0].source = null;
        d.links = d.links.filter((l: any) => l.linkType !== "hinders");
        const live = new Set([...d.links, ...d.families, ...d.concepts, ...d.levels, ...d.misconceptions].map((o: any) => o.id));
        d.reviews = d.reviews.filter((x: any) => live.has(x.object));
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.map((w) => w.rule)).toEqual(expect.arrayContaining(["unsourced-misconception", "concept-without-mistake"]));
  });
});

describe("only confirmed, reviewed interpretation is released", () => {
  it("refuses a proposed concept", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.concepts[0].status = "proposed")));
    expect(errorRules(r)).toContain("released-status");
  });

  it("refuses an object with no review summary", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.reviews = d.reviews.slice(1))));
    expect(errorRules(r)).toContain("review-coverage");
  });

  it("refuses fewer reviewers than the base's policy", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.reviews[0].reviewers = ["A. Example"])));
    expect(errorRules(r)).toContain("review-coverage");
  });

  it("refuses a review of an older revision", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.concepts[0].revision = 2)));
    expect(errorRules(r)).toContain("review-coverage");
  });
});

describe("retirement", () => {
  it("refuses a retired ID that is still live", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => d.retired.push({ id: d.concepts[0].id, kind: "concept", retiredIn: "0.1.0" })));
    expect(errorRules(r)).toContain("retired");
  });

  it("needs a replaced-by link for a replacement", () => {
    const r = validateRelease(
      edited(RELEASE_DIR, (d) =>
        d.retired.push({ id: "55555555-5555-4555-8555-555555555555", kind: "concept", retiredIn: "0.1.0", replacedBy: d.concepts[0].id }),
      ),
    );
    expect(errorRules(r)).toEqual(["retired"]);
  });
});

describe("findCycles", () => {
  it("finds each loop once and ignores what is acyclic", () => {
    expect(findCycles([["a", "b"], ["b", "c"], ["c", "d"]])).toEqual([]);
    expect(findCycles([["a", "b"], ["b", "c"], ["c", "a"], ["c", "d"]])).toEqual([["a", "b", "c", "a"]]);
  });
});

describe("a draft bundle", () => {
  /** The example release as a draft: one concept still proposed, reviewed by one reviewer so far, and one nobody has judged. */
  const asDraft = (more: (data: Record<string, any>, manifest: any) => void = () => {}) =>
    edited(RELEASE_DIR, (d, m) => {
      m.kind = "base-draft";
      m.version = "0.1.0-draft.1";
      const [first, second] = [d.concepts[0], d.concepts[1]];
      first.status = "proposed";
      Object.assign(d.reviews.find((r: any) => r.object === first.id), { status: "proposed", reviewers: ["A. Example"], judgements: 1 });
      second.status = "proposed";
      const review = d.reviews.find((r: any) => r.object === second.id);
      delete review.decided;
      Object.assign(review, { status: "proposed", reviewers: [], judgements: 0 });
      more(d, m);
    });

  it("holds proposed interpretation with its review so far, checked as a draft", () => {
    const r = validateRelease(asDraft(), { draft: true });
    expect(r.errors).toEqual([]);
    expect(r.index?.draft).toBe(true);
  });

  it("is never accepted as a release, nor a release as a draft", () => {
    expect(errorRules(validateRelease(asDraft()))).toEqual(["bundle-kind"]);
    expect(errorRules(validateRelease(readBundle(RELEASE_DIR), { draft: true }))).toEqual(["bundle-kind"]);
  });

  it("carries a version marked draft, and a release never does", () => {
    expect(errorRules(validateRelease(asDraft((_d, m) => (m.version = "0.1.1")), { draft: true }))).toContain("schema");
    expect(errorRules(validateRelease(edited(RELEASE_DIR, (_d, m) => (m.version = "0.1.0-draft.1"))))).toContain("schema");
  });

  it("holds nothing rejected", () => {
    const r = validateRelease(
      asDraft((d) => {
        d.concepts[2].status = "rejected";
        d.reviews.find((x: any) => x.object === d.concepts[2].id).status = "rejected";
      }),
      { draft: true },
    );
    expect(errorRules(r)).toEqual(["draft-status"]);
  });

  it("gives each object's review the object's own status", () => {
    const r = validateRelease(asDraft((d) => (d.reviews.find((x: any) => x.object === d.concepts[0].id).status = "confirmed")), { draft: true });
    expect(errorRules(r)).toEqual(["review-coverage"]);
  });

  it("still holds what it calls confirmed to the base's review policy", () => {
    const r = validateRelease(asDraft((d) => (d.reviews.find((x: any) => x.object === d.concepts[2].id).reviewers = ["A. Example"])), { draft: true });
    expect(errorRules(r)).toEqual(["review-coverage"]);
  });

  it("keeps a release's review summaries strict", () => {
    const r = validateRelease(edited(RELEASE_DIR, (d) => (d.reviews[0].reviewers = [])));
    expect(errorRules(r)).toContain("schema");
  });
});

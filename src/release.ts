import { type Bundle, countOf, sha256 } from "./bundle.js";
import { Report, type Result } from "./report.js";
import { checkSchema, specSupported } from "./schemas.js";

type LangString = Record<string, string>;
type Status = "proposed" | "confirmed" | "rejected";

interface Obj {
  id: string;
  type: string;
  revision: number;
}
interface EducationLevel extends Obj { code: string }
interface Framework extends Obj { slug: string; nodeTypes: string[]; educationLevels: EducationLevel[] }
interface Document extends Obj { framework: string }
interface Node extends Obj { document: string; parent: string | null; nodeType: string; code?: string }
interface Statement extends Obj {
  document: string;
  node: string | null;
  parent: string | null;
  educationLevel?: string;
  revise: boolean;
  code?: string;
}
interface TeachingPlan extends Obj { framework: string; document?: string; slug: string }
interface Placement extends Obj {
  teachingPlan: string;
  target: string;
  targetKind: string;
  educationLevel: string;
  weekStart?: number;
  weekEnd?: number;
}
interface Interp extends Obj { status: Status }
interface Family extends Interp { framework: string; code: string }
interface Concept extends Interp { framework: string; code: string; aliases: string[]; title: LangString }
interface Level extends Interp { concept: string }
interface Misconception extends Interp { framework: string; code: string; source: string | null }
interface Link extends Interp {
  linkType: "needs" | "hinders" | "defines" | "part-of" | "replaced-by";
  from: string;
  fromKind: string;
  to: string;
  toKind: string;
  source: string;
}
interface Source extends Obj { framework: string; kind: string; statement?: string }
interface Review { object: string; objectKind: string; revision: number; status: Status; reviewers: string[] }
interface Retired { id: string; kind: string; replacedBy?: string }
interface Manifest {
  spec: string;
  base: string;
  framework: string;
  version: string;
  reviewPolicy: { minReviewers: number };
  files: Record<string, { path: string; sha256: string; count: number }>;
}

/** Each manifest file key, the file it is conventionally called, and its schema. */
export const RELEASE_FILES = {
  framework: "release/transcription.schema.json#/$defs/framework",
  documents: "release/transcription.schema.json#/$defs/documents",
  nodes: "release/transcription.schema.json#/$defs/nodes",
  statements: "release/transcription.schema.json#/$defs/statements",
  teachingPlans: "release/transcription.schema.json#/$defs/teachingPlans",
  placements: "release/transcription.schema.json#/$defs/placements",
  families: "release/interpretation.schema.json#/$defs/families",
  concepts: "release/interpretation.schema.json#/$defs/concepts",
  levels: "release/interpretation.schema.json#/$defs/levels",
  misconceptions: "release/interpretation.schema.json#/$defs/misconceptions",
  links: "release/interpretation.schema.json#/$defs/links",
  sources: "release/provenance.schema.json#/$defs/sources",
  reviews: "release/provenance.schema.json#/$defs/reviews",
  retired: "release/provenance.schema.json#/$defs/retiredList",
} as const;
type FileKey = keyof typeof RELEASE_FILES;

/** Which kinds each link type may join. replaced-by joins two objects of the same kind. */
const LINK_ENDPOINTS: Record<Exclude<Link["linkType"], "replaced-by">, [string, string]> = {
  needs: ["concept", "concept"],
  hinders: ["misconception", "concept"],
  defines: ["statement", "concept"],
  "part-of": ["concept", "family"],
};

/** The parsed contents of a release, once every file has passed its schema. */
export interface ReleaseIndex {
  manifest: Manifest;
  framework: Framework;
  /** Every live object's kind, by ID. */
  kinds: Map<string, string>;
  /** Retired IDs and their kinds. */
  retired: Map<string, string>;
  concepts: Concept[];
  misconceptions: Misconception[];
  statements: Statement[];
  nodes: Node[];
}

export interface ReleaseValidation extends Result {
  /** Present when the release could be read well enough to resolve references into it. */
  index?: ReleaseIndex;
}

/** Validates a base release: every file against its schema, then the rules in docs/validation.md. */
export function validateRelease(bundle: Bundle): ReleaseValidation {
  const report = new Report();
  if (!checkSchema(report, "release/manifest.schema.json", bundle.manifest, "manifest.json")) return report.result();
  const manifest = bundle.manifest as Manifest;
  if (!specSupported(manifest.spec)) {
    report.error("spec-version", `The release follows spec ${manifest.spec}; this validator implements 0.1.x`, { file: "manifest.json" });
    return report.result();
  }

  let schemasPass = true;
  for (const key of Object.keys(RELEASE_FILES) as FileKey[]) {
    const entry = manifest.files[key]!;
    if (bundle.unreadable?.[key]) {
      report.error("manifest-files", `${entry.path} cannot be read: ${bundle.unreadable[key]}`, { file: entry.path });
      schemasPass = false;
      continue;
    }
    if (!(key in bundle.data)) {
      report.error("manifest-files", `${entry.path} is listed but missing`, { file: entry.path });
      schemasPass = false;
      continue;
    }
    const data = bundle.data[key];
    const raw = bundle.raw?.[key];
    if (raw && sha256(raw) !== entry.sha256) report.error("manifest-files", `${entry.path}: its SHA-256 does not match the manifest`, { file: entry.path });
    if (countOf(data) !== entry.count) report.error("manifest-files", `${entry.path} holds ${countOf(data)} objects; the manifest says ${entry.count}`, { file: entry.path });
    if (!checkSchema(report, RELEASE_FILES[key], data, entry.path)) schemasPass = false;
  }
  if (!schemasPass) {
    report.warn("skipped", "The release's own rules were not checked, because a file failed its schema");
    return report.result();
  }

  const index = checkRules(report, manifest, bundle.data as Record<FileKey, unknown>);
  return { ...report.result(), index };
}

function checkRules(report: Report, manifest: Manifest, d: Record<FileKey, unknown>): ReleaseIndex {
  const f = (key: FileKey) => manifest.files[key]!.path;
  const framework = d.framework as Framework;
  const documents = d.documents as Document[];
  const nodes = d.nodes as Node[];
  const statements = d.statements as Statement[];
  const plans = d.teachingPlans as TeachingPlan[];
  const placements = d.placements as Placement[];
  const families = d.families as Family[];
  const concepts = d.concepts as Concept[];
  const levels = d.levels as Level[];
  const misconceptions = d.misconceptions as Misconception[];
  const links = d.links as Link[];
  const sources = d.sources as Source[];
  const reviews = d.reviews as Review[];
  const retiredList = d.retired as Retired[];

  // The manifest describes this framework.
  if (manifest.framework !== framework.id) report.error("manifest-framework", `The manifest names framework ${manifest.framework}; framework.json is ${framework.id}`, { file: "manifest.json" });
  if (manifest.base !== framework.slug) report.error("manifest-framework", `The manifest names base "${manifest.base}"; the framework's slug is "${framework.slug}"`, { file: "manifest.json" });

  // unique-ids: one ID, one object, across the whole release.
  const kinds = new Map<string, string>();
  const register = (kind: string, file: string, objs: Obj[]) => {
    for (const o of objs) {
      if (kinds.has(o.id)) report.error("unique-ids", `${o.id} is used more than once`, { file, id: o.id });
      else kinds.set(o.id, kind);
    }
  };
  register("framework", f("framework"), [framework]);
  register("education-level", f("framework"), framework.educationLevels);
  register("document", f("documents"), documents);
  register("node", f("nodes"), nodes);
  register("statement", f("statements"), statements);
  register("teaching-plan", f("teachingPlans"), plans);
  register("placement", f("placements"), placements);
  register("family", f("families"), families);
  register("concept", f("concepts"), concepts);
  register("level", f("levels"), levels);
  register("misconception", f("misconceptions"), misconceptions);
  register("link", f("links"), links);
  register("source", f("sources"), sources);

  const retired = new Map<string, string>();
  for (const r of retiredList) {
    if (kinds.has(r.id)) report.error("retired", `${r.id} is retired but still live`, { file: f("retired"), id: r.id });
    if (retired.has(r.id)) report.error("unique-ids", `${r.id} is retired more than once`, { file: f("retired"), id: r.id });
    retired.set(r.id, r.kind);
  }

  // reference: every reference resolves to a live object of the kind it should be.
  const ref = (file: string, owner: string, field: string, id: string | null | undefined, kind: string) => {
    if (id == null) return;
    const actual = kinds.get(id);
    if (actual === undefined) report.error("reference", `${field} ${id} is not in the release`, { file, id: owner });
    else if (actual !== kind) report.error("reference", `${field} ${id} is a ${actual}, not a ${kind}`, { file, id: owner });
  };

  // framework-scope: everything belongs to the release's one framework.
  const scoped = (file: string, objs: { id: string; framework: string }[]) => {
    for (const o of objs) if (o.framework !== framework.id) report.error("framework-scope", `belongs to framework ${o.framework}, not ${framework.id}`, { file, id: o.id });
  };
  scoped(f("documents"), documents);
  scoped(f("teachingPlans"), plans);
  scoped(f("families"), families);
  scoped(f("concepts"), concepts);
  scoped(f("misconceptions"), misconceptions);
  scoped(f("sources"), sources);

  // Transcription: nodes and statements form trees inside their own document.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const statementById = new Map(statements.map((s) => [s.id, s]));
  const nodeTypes = new Set(framework.nodeTypes);
  for (const n of nodes) {
    ref(f("nodes"), n.id, "document", n.document, "document");
    ref(f("nodes"), n.id, "parent", n.parent, "node");
    if (!nodeTypes.has(n.nodeType)) report.error("node-type", `node type "${n.nodeType}" is not one of the framework's (${framework.nodeTypes.join(", ")})`, { file: f("nodes"), id: n.id });
    const parent = n.parent ? nodeById.get(n.parent) : undefined;
    if (parent && parent.document !== n.document) report.error("node-tree", "its parent is in another document", { file: f("nodes"), id: n.id });
  }
  for (const s of statements) {
    ref(f("statements"), s.id, "document", s.document, "document");
    ref(f("statements"), s.id, "node", s.node, "node");
    ref(f("statements"), s.id, "parent", s.parent, "statement");
    ref(f("statements"), s.id, "educationLevel", s.educationLevel, "education-level");
    const node = s.node ? nodeById.get(s.node) : undefined;
    if (node && node.document !== s.document) report.error("node-tree", "its node is in another document", { file: f("statements"), id: s.id });
    const parent = s.parent ? statementById.get(s.parent) : undefined;
    if (parent && parent.document !== s.document) report.error("node-tree", "its parent statement is in another document", { file: f("statements"), id: s.id });
  }
  reportParentCycles(report, f("nodes"), nodes);
  reportParentCycles(report, f("statements"), statements);

  for (const p of plans) ref(f("teachingPlans"), p.id, "document", p.document, "document");
  for (const p of placements) {
    ref(f("placements"), p.id, "teachingPlan", p.teachingPlan, "teaching-plan");
    ref(f("placements"), p.id, "target", p.target, p.targetKind);
    ref(f("placements"), p.id, "educationLevel", p.educationLevel, "education-level");
    if (p.weekStart !== undefined && p.weekEnd !== undefined && p.weekEnd < p.weekStart) report.error("placement", `weeks run backwards (${p.weekStart}–${p.weekEnd})`, { file: f("placements"), id: p.id });
  }

  // Interpretation and provenance references.
  for (const l of levels) ref(f("levels"), l.id, "concept", l.concept, "concept");
  for (const m of misconceptions) ref(f("misconceptions"), m.id, "source", m.source, "source");
  for (const s of sources) ref(f("sources"), s.id, "statement", s.statement, "statement");

  // link-endpoints, and every link's ends and source resolve.
  for (const l of links) {
    ref(f("links"), l.id, "source", l.source, "source");
    if (l.linkType === "replaced-by") {
      if (l.fromKind !== l.toKind) report.error("link-endpoints", `replaced-by joins a ${l.fromKind} to a ${l.toKind}; both ends must be the same kind`, { file: f("links"), id: l.id });
      if (retired.get(l.from) !== l.fromKind) report.error("link-endpoints", `replaced-by starts at ${l.from}, which is not a retired ${l.fromKind}`, { file: f("links"), id: l.id });
      ref(f("links"), l.id, "to", l.to, l.toKind);
      continue;
    }
    const [fromKind, toKind] = LINK_ENDPOINTS[l.linkType];
    if (l.fromKind !== fromKind || l.toKind !== toKind) report.error("link-endpoints", `${l.linkType} must join a ${fromKind} to a ${toKind}, not a ${l.fromKind} to a ${l.toKind}`, { file: f("links"), id: l.id });
    if (l.from === l.to) report.error("link-endpoints", "a link may not join an object to itself", { file: f("links"), id: l.id });
    ref(f("links"), l.id, "from", l.from, l.fromKind);
    ref(f("links"), l.id, "to", l.to, l.toKind);
  }

  // retired: a replacement is live, the same kind, and joined by a replaced-by link.
  for (const r of retiredList) {
    if (!r.replacedBy) continue;
    ref(f("retired"), r.id, "replacedBy", r.replacedBy, r.kind);
    if (!links.some((l) => l.linkType === "replaced-by" && l.from === r.id && l.to === r.replacedBy)) report.error("retired", `no replaced-by link from ${r.id} to ${r.replacedBy}`, { file: f("retired"), id: r.id });
  }

  // needs-acyclic.
  const conceptCode = new Map(concepts.map((c) => [c.id, c.code]));
  for (const cycle of findCycles(links.filter((l) => l.linkType === "needs").map((l) => [l.from, l.to] as const))) {
    report.error("needs-acyclic", `needs loops: ${cycle.map((id) => conceptCode.get(id) ?? id).join(" → ")}`, { file: f("links"), id: cycle[0] });
  }

  // concept-defined: every concept has a word-for-word source; one family at most.
  const defined = new Set(links.filter((l) => l.linkType === "defines").map((l) => l.to));
  const familyCount = new Map<string, number>();
  for (const l of links) if (l.linkType === "part-of") familyCount.set(l.from, (familyCount.get(l.from) ?? 0) + 1);
  const hindered = new Set(links.filter((l) => l.linkType === "hinders").map((l) => l.to));
  for (const c of concepts) {
    if (!defined.has(c.id)) report.error("concept-defined", `${c.code} has no statement that defines it`, { file: f("concepts"), id: c.id });
    if ((familyCount.get(c.id) ?? 0) > 1) report.error("one-family", `${c.code} is part of ${familyCount.get(c.id)} families`, { file: f("concepts"), id: c.id });
    if (!hindered.has(c.id)) report.warn("concept-without-mistake", `${c.code} has no typical mistake`, { file: f("concepts"), id: c.id });
  }

  // revise-defines: a "revise" statement points back; it never creates a concept.
  for (const l of links) {
    if (l.linkType !== "defines") continue;
    const s = statementById.get(l.from);
    if (s?.revise) report.warn("revise-defines", `revise statement ${s.code ?? s.id} defines ${conceptCode.get(l.to) ?? l.to}`, { file: f("links"), id: l.id });
  }
  for (const m of misconceptions) if (m.source === null) report.warn("unsourced-misconception", `${m.code} has no source`, { file: f("misconceptions"), id: m.id });

  // unique-codes.
  uniqueValues(report, f("framework"), framework.educationLevels.map((e) => [e.id, e.code]), "education level code");
  uniqueValues(report, f("teachingPlans"), plans.map((p) => [p.id, p.slug]), "teaching plan slug");
  uniqueValues(report, f("families"), families.map((x) => [x.id, x.code]), "family code");
  uniqueValues(report, f("concepts"), concepts.flatMap((c) => [[c.id, c.code], ...c.aliases.map((a) => [c.id, a] as [string, string])]), "concept code or alias");
  uniqueValues(report, f("misconceptions"), misconceptions.map((m) => [m.id, m.code]), "misconception code");
  uniqueValues(report, f("nodes"), nodes.filter((n) => n.code).map((n) => [n.id, `${n.document} ${n.code}`]), "node code within a document");
  uniqueValues(report, f("statements"), statements.filter((s) => s.code).map((s) => [s.id, `${s.document} ${s.code}`]), "statement code within a document");

  // released-status and review-coverage: only confirmed interpretation, each with its review.
  const reviewFor = new Map<string, Review>();
  for (const r of reviews) {
    if (reviewFor.has(r.object)) report.error("review-coverage", `${r.object} has more than one review summary`, { file: f("reviews"), id: r.object });
    reviewFor.set(r.object, r);
    ref(f("reviews"), r.object, "object", r.object, r.objectKind);
  }
  const interpretation: [string, string, Interp[]][] = [
    ["family", f("families"), families],
    ["concept", f("concepts"), concepts],
    ["level", f("levels"), levels],
    ["misconception", f("misconceptions"), misconceptions],
    ["link", f("links"), links],
  ];
  for (const [kind, file, objs] of interpretation) {
    for (const o of objs) {
      if (o.status !== "confirmed") report.error("released-status", `a ${kind} in a release must be confirmed; this one is ${o.status}`, { file, id: o.id });
      const r = reviewFor.get(o.id);
      if (!r) {
        report.error("review-coverage", `the ${kind} has no review summary`, { file, id: o.id });
        continue;
      }
      if (r.status !== "confirmed") report.error("review-coverage", `its review summary says ${r.status}`, { file: f("reviews"), id: o.id });
      if (r.revision !== o.revision) report.error("review-coverage", `reviewed at revision ${r.revision}, but the ${kind} is at revision ${o.revision}`, { file: f("reviews"), id: o.id });
      if (r.reviewers.length < manifest.reviewPolicy.minReviewers) report.error("review-coverage", `confirmed by ${r.reviewers.length} reviewer(s); the base's policy needs ${manifest.reviewPolicy.minReviewers}`, { file: f("reviews"), id: o.id });
    }
  }

  return { manifest, framework, kinds, retired, concepts, misconceptions, statements, nodes };
}

/** Reports every object whose parent chain loops back on itself. */
function reportParentCycles(report: Report, file: string, objs: { id: string; parent: string | null }[]): void {
  const parent = new Map(objs.map((o) => [o.id, o.parent]));
  const clear = new Set<string>();
  for (const o of objs) {
    const seen = new Set<string>();
    let at: string | null | undefined = o.id;
    while (at && !clear.has(at)) {
      if (seen.has(at)) {
        report.error("node-tree", "its parents loop back on themselves", { file, id: o.id });
        break;
      }
      seen.add(at);
      at = parent.get(at);
    }
    for (const s of seen) clear.add(s);
  }
}

/** Finds directed cycles, each reported once as the path that closes it. */
export function findCycles(edges: readonly (readonly [string, string])[]): string[][] {
  const out = new Map<string, string[]>();
  for (const [a, b] of edges) out.set(a, [...(out.get(a) ?? []), b]);
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (v: string): void => {
    state.set(v, 1);
    stack.push(v);
    for (const w of out.get(v) ?? []) {
      if (state.get(w) === 1) cycles.push([...stack.slice(stack.indexOf(w)), w]);
      else if (!state.has(w)) visit(w);
    }
    stack.pop();
    state.set(v, 2);
  };
  for (const v of out.keys()) if (!state.has(v)) visit(v);
  return cycles;
}

function uniqueValues(report: Report, file: string, pairs: [string, string][], what: string): void {
  const owner = new Map<string, string>();
  for (const [id, value] of pairs) {
    const first = owner.get(value);
    if (first !== undefined && first !== id) report.error("unique-codes", `${what} "${value}" is used by ${first} and ${id}`, { file, id });
    else owner.set(value, id);
  }
}

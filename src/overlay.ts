import { type Bundle, countOf, sha256 } from "./bundle.js";
import type { ReleaseIndex } from "./release.js";
import { Report, type Result } from "./report.js";
import { checkSchema, specSupported } from "./schemas.js";

type AlignmentType = "teaches" | "assumes" | "tests" | "reveals" | "backfills" | "covers";

interface Profile { namespace: string; artefactKinds: { kind: string; alignments: AlignmentType[] }[] }
interface Artefact { id: string; namespace: string; kind: string; parent?: string; code?: string }
interface Alignment { id: string; artefact: string; alignmentType: AlignmentType; target: string; targetKind: string }
interface Plan { id: string; namespace: string; slug: string }
interface Placement { id: string; plan: string; artefact: string; educationLevel: string; weekStart?: number; weekEnd?: number }
interface Manifest {
  spec: string;
  client: { namespace: string };
  base: { slug: string; framework: string; version: string; manifestSha256?: string };
  files: Record<string, { path: string; sha256: string; count: number }>;
}

export const OVERLAY_FILES = {
  profile: "overlay/records.schema.json#/$defs/profile",
  artefacts: "overlay/records.schema.json#/$defs/artefacts",
  alignments: "overlay/records.schema.json#/$defs/alignments",
  plans: "overlay/records.schema.json#/$defs/plans",
  placements: "overlay/records.schema.json#/$defs/placements",
} as const;
type FileKey = keyof typeof OVERLAY_FILES;

/** The kinds of base object each alignment type may point at. */
export const ALIGNMENT_TARGETS: Record<AlignmentType, string[]> = {
  teaches: ["concept", "level"],
  assumes: ["concept", "level"],
  tests: ["concept", "level"],
  backfills: ["concept", "level"],
  reveals: ["misconception"],
  covers: ["statement", "node"],
};

/** The pinned base release, for resolving alignment targets. Without it, those checks are skipped with a warning. */
export interface PinnedBase {
  index: ReleaseIndex;
  manifestRaw?: Buffer;
}

export function validateOverlay(bundle: Bundle, base?: PinnedBase): Result {
  const report = new Report();
  if (!checkSchema(report, "overlay/manifest.schema.json", bundle.manifest, "manifest.json")) return report.result();
  const manifest = bundle.manifest as Manifest;
  if (!specSupported(manifest.spec)) {
    report.error("spec-version", `The overlay follows spec ${manifest.spec}; this validator implements 0.1.x`, { file: "manifest.json" });
    return report.result();
  }

  let schemasPass = true;
  for (const key of Object.keys(OVERLAY_FILES) as FileKey[]) {
    const entry = manifest.files[key]!;
    if (bundle.unreadable?.[key] || !(key in bundle.data)) {
      report.error("manifest-files", `${entry.path} is listed but cannot be read`, { file: entry.path });
      schemasPass = false;
      continue;
    }
    const data = bundle.data[key];
    const raw = bundle.raw?.[key];
    if (raw && sha256(raw) !== entry.sha256) report.error("manifest-files", `${entry.path}: its SHA-256 does not match the manifest`, { file: entry.path });
    if (countOf(data) !== entry.count) report.error("manifest-files", `${entry.path} holds ${countOf(data)} objects; the manifest says ${entry.count}`, { file: entry.path });
    if (!checkSchema(report, OVERLAY_FILES[key], data, entry.path)) schemasPass = false;
  }
  if (!schemasPass) {
    report.warn("skipped", "The overlay's own rules were not checked, because a file failed its schema");
    return report.result();
  }

  const f = (key: FileKey) => manifest.files[key]!.path;
  const profile = bundle.data.profile as Profile;
  const artefacts = bundle.data.artefacts as Artefact[];
  const alignments = bundle.data.alignments as Alignment[];
  const plans = bundle.data.plans as Plan[];
  const placements = bundle.data.placements as Placement[];
  const ns = manifest.client.namespace;

  // namespace: every record belongs to the client named in the manifest.
  if (profile.namespace !== ns) report.error("namespace", `the profile is for "${profile.namespace}"; the manifest names "${ns}"`, { file: f("profile") });
  for (const a of artefacts) if (a.namespace !== ns) report.error("namespace", `in namespace "${a.namespace}", not "${ns}"`, { file: f("artefacts"), id: a.id });
  for (const p of plans) if (p.namespace !== ns) report.error("namespace", `in namespace "${p.namespace}", not "${ns}"`, { file: f("plans"), id: p.id });

  // unique-ids across the overlay's records.
  const ids = new Map<string, string>();
  for (const [kind, file, objs] of [
    ["artefact", f("artefacts"), artefacts],
    ["alignment", f("alignments"), alignments],
    ["plan", f("plans"), plans],
    ["placement", f("placements"), placements],
  ] as const) {
    for (const o of objs) {
      if (ids.has(o.id)) report.error("unique-ids", `${o.id} is used more than once`, { file, id: o.id });
      else ids.set(o.id, kind);
    }
  }
  const kindsSeen = new Set<string>();
  for (const k of profile.artefactKinds) {
    if (kindsSeen.has(k.kind)) report.error("unique-codes", `artefact kind "${k.kind}" is defined twice`, { file: f("profile") });
    kindsSeen.add(k.kind);
  }
  const plansSeen = new Set<string>();
  for (const p of plans) {
    if (plansSeen.has(p.slug)) report.error("unique-codes", `plan slug "${p.slug}" is used twice`, { file: f("plans"), id: p.id });
    plansSeen.add(p.slug);
  }

  // artefact-kind and reference.
  const kindOf = new Map(profile.artefactKinds.map((k) => [k.kind, k]));
  const artefactById = new Map(artefacts.map((a) => [a.id, a]));
  const ref = (file: string, owner: string, field: string, id: string | undefined, kind: string) => {
    if (id === undefined) return;
    const actual = ids.get(id);
    if (actual === undefined) report.error("reference", `${field} ${id} is not in the overlay`, { file, id: owner });
    else if (actual !== kind) report.error("reference", `${field} ${id} is a ${actual}, not a ${kind}`, { file, id: owner });
  };
  for (const a of artefacts) {
    if (!kindOf.has(a.kind)) report.error("artefact-kind", `kind "${a.kind}" is not in the client profile`, { file: f("artefacts"), id: a.id });
    ref(f("artefacts"), a.id, "parent", a.parent, "artefact");
  }
  reportParentCycles(report, f("artefacts"), artefacts);

  // alignment-allowed and alignment-target.
  for (const al of alignments) {
    ref(f("alignments"), al.id, "artefact", al.artefact, "artefact");
    const artefact = artefactById.get(al.artefact);
    const allowed = artefact ? kindOf.get(artefact.kind)?.alignments : undefined;
    if (allowed && !allowed.includes(al.alignmentType)) report.error("alignment-allowed", `a ${artefact!.kind} may not carry "${al.alignmentType}" (the profile allows ${allowed.join(", ")})`, { file: f("alignments"), id: al.id });
    if (!ALIGNMENT_TARGETS[al.alignmentType].includes(al.targetKind)) report.error("alignment-target", `"${al.alignmentType}" must point at a ${ALIGNMENT_TARGETS[al.alignmentType].join(" or ")}, not a ${al.targetKind}`, { file: f("alignments"), id: al.id });
  }

  for (const p of placements) {
    ref(f("placements"), p.id, "plan", p.plan, "plan");
    ref(f("placements"), p.id, "artefact", p.artefact, "artefact");
    if (p.weekStart !== undefined && p.weekEnd !== undefined && p.weekEnd < p.weekStart) report.error("placement", `weeks run backwards (${p.weekStart}–${p.weekEnd})`, { file: f("placements"), id: p.id });
  }

  // base-pin and base references, against the pinned release.
  if (!base) {
    report.warn("base-not-checked", "No base release given (--base), so the pin and the alignment targets were not checked");
    return report.result();
  }
  const bm = base.index.manifest;
  if (manifest.base.slug !== bm.base || manifest.base.version !== bm.version || manifest.base.framework !== bm.framework) {
    report.error("base-pin", `pinned to ${manifest.base.slug} ${manifest.base.version}; the release given is ${bm.base} ${bm.version}`, { file: "manifest.json" });
  }
  if (manifest.base.manifestSha256 && base.manifestRaw && sha256(base.manifestRaw) !== manifest.base.manifestSha256) {
    report.error("base-pin", "the pinned manifestSha256 does not match the release's manifest.json", { file: "manifest.json" });
  }
  for (const al of alignments) {
    const actual = base.index.kinds.get(al.target);
    if (actual === undefined) {
      const retired = base.index.retired.has(al.target);
      report.error("alignment-target", retired ? `target ${al.target} is retired in the pinned release; re-pin through its replacement` : `target ${al.target} is not in the pinned release`, { file: f("alignments"), id: al.id });
    } else if (actual !== al.targetKind) {
      report.error("alignment-target", `target ${al.target} is a ${actual}, not a ${al.targetKind}`, { file: f("alignments"), id: al.id });
    }
  }
  for (const p of placements) {
    if (base.index.kinds.get(p.educationLevel) !== "education-level") report.error("reference", `educationLevel ${p.educationLevel} is not an education level of the pinned base`, { file: f("placements"), id: p.id });
  }
  return report.result();
}

function reportParentCycles(report: Report, file: string, objs: { id: string; parent?: string }[]): void {
  const parent = new Map(objs.map((o) => [o.id, o.parent]));
  for (const o of objs) {
    const seen = new Set<string>();
    let at: string | undefined = o.id;
    while (at) {
      if (seen.has(at)) {
        report.error("reference", "its parents loop back on themselves", { file, id: o.id });
        break;
      }
      seen.add(at);
      at = parent.get(at);
    }
  }
}

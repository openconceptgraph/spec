import { type Bundle, countOf, readBundle } from "../src/bundle.js";
import type { Issue, Result } from "../src/report.js";

export const RELEASE_DIR = new URL("../examples/release/", import.meta.url).pathname;
export const OVERLAY_DIR = new URL("../examples/overlay/", import.meta.url).pathname;

/** The example bundle as data only (no raw bytes, so hashes are not checked), deep-copied and changed by `edit`. */
export function edited(dir: string, edit: (data: Record<string, any>, manifest: any) => void = () => {}): Bundle {
  const read = readBundle(dir);
  const manifest = structuredClone(read.manifest) as any;
  const data = structuredClone(read.data) as Record<string, any>;
  edit(data, manifest);
  for (const [key, entry] of Object.entries(manifest.files as Record<string, { count: number }>)) {
    if (key in data) entry.count = countOf(data[key]);
  }
  return { manifest, data };
}

export const rules = (r: Result): string[] => [...r.errors, ...r.warnings].map((i: Issue) => i.rule);
export const errorRules = (r: Result): string[] => r.errors.map((i) => i.rule);

/** Finds an object in a list by its code (concepts, misconceptions, statements, nodes) and returns it. */
export function byCode(list: any[], code: string): any {
  const found = list.find((o) => o.code === code);
  if (!found) throw new Error(`no object with code ${code}`);
  return found;
}

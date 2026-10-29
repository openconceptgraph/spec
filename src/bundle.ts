import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A release or overlay as read from disk: its manifest, each file's parsed
 * contents keyed by the manifest's file key, and the raw bytes for hashing.
 * Raw bytes are optional so tests can validate data built in memory.
 */
export interface Bundle {
  manifest: unknown;
  data: Record<string, unknown>;
  raw?: Record<string, Buffer>;
  /** Files the manifest lists that could not be read or parsed. */
  unreadable?: Record<string, string>;
  /** The raw manifest, for pinning an overlay to the exact release. */
  manifestRaw?: Buffer;
}

export const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

/** How many objects a file holds, as the manifest counts them: an array's length, otherwise one. */
export const countOf = (data: unknown): number => (Array.isArray(data) ? data.length : 1);

/** Reads a bundle directory: manifest.json, then each file its `files` block names. */
export function readBundle(dir: string): Bundle {
  const manifestPath = join(dir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`No manifest.json in ${dir}`);
  const manifestRaw = readFileSync(manifestPath);
  const manifest: unknown = JSON.parse(manifestRaw.toString("utf8"));
  const bundle: Bundle = { manifest, data: {}, raw: {}, unreadable: {}, manifestRaw };
  const files = (manifest as { files?: Record<string, { path?: unknown }> }).files;
  if (files && typeof files === "object") {
    for (const [key, entry] of Object.entries(files)) {
      const path = typeof entry?.path === "string" ? entry.path : undefined;
      if (!path || path.includes("/") || path.includes("\\")) continue;
      try {
        const bytes = readFileSync(join(dir, path));
        bundle.raw![key] = bytes;
        bundle.data[key] = JSON.parse(bytes.toString("utf8"));
      } catch (e) {
        bundle.unreadable![key] = e instanceof Error ? e.message : String(e);
      }
    }
  }
  return bundle;
}

/**
 * Rewrites a manifest's `files` block from the files on disk: each file's
 * SHA-256 and object count. For base builders making a release by hand.
 */
export function stampManifest(dir: string): { key: string; path: string; sha256: string; count: number }[] {
  const manifestPath = join(dir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { files: Record<string, { path: string; sha256: string; count: number }> };
  const stamped = Object.entries(manifest.files).map(([key, entry]) => {
    const bytes = readFileSync(join(dir, entry.path));
    entry.sha256 = sha256(bytes);
    entry.count = countOf(JSON.parse(bytes.toString("utf8")));
    return { key, path: entry.path, sha256: entry.sha256, count: entry.count };
  });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  return stamped;
}

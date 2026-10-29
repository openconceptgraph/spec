#!/usr/bin/env node
import { readBundle, stampManifest } from "./bundle.js";
import { validateOverlay } from "./overlay.js";
import { validateRelease } from "./release.js";
import type { Issue, Result } from "./report.js";
import { SPEC_VERSION } from "./schemas.js";

const USAGE = `ocg-validate: checks OpenConceptGraph bundles against spec ${SPEC_VERSION}

  ocg-validate release <dir>                     a base release
  ocg-validate overlay <dir> [--base <dir>]      an overlay, and its pin to a base release
  ocg-validate stamp <dir>                       rewrite manifest.json's file hashes and counts

Exits 1 when there are errors. Warnings are printed but do not fail.`;

function print(label: string, r: Result): void {
  const line = (i: Issue) =>
    `  ${i.severity === "error" ? "error  " : "warning"}  ${i.rule.padEnd(24)} ${[i.file, i.id].filter(Boolean).join(" ")}${i.file || i.id ? ": " : ""}${i.message}`;
  for (const i of [...r.errors, ...r.warnings]) console.log(line(i));
  console.log(`${label}: ${r.ok ? "conforms" : "does not conform"} (${r.errors.length} errors, ${r.warnings.length} warnings)`);
}

function main(argv: string[]): number {
  const [command, dir, ...rest] = argv;
  if (!command || !dir || command === "--help" || command === "-h") {
    console.log(USAGE);
    return command ? 0 : 2;
  }
  switch (command) {
    case "release": {
      const r = validateRelease(readBundle(dir));
      print(`release ${dir}`, r);
      return r.ok ? 0 : 1;
    }
    case "overlay": {
      const at = rest.indexOf("--base");
      const baseDir = at >= 0 ? rest[at + 1] : undefined;
      let pinned;
      if (baseDir) {
        const baseBundle = readBundle(baseDir);
        const base = validateRelease(baseBundle);
        if (!base.index) {
          print(`base release ${baseDir}`, base);
          console.log("The base release could not be read well enough to check the overlay against it.");
          return 1;
        }
        pinned = { index: base.index, manifestRaw: baseBundle.manifestRaw };
      }
      const r = validateOverlay(readBundle(dir), pinned);
      print(`overlay ${dir}`, r);
      return r.ok ? 0 : 1;
    }
    case "stamp": {
      for (const s of stampManifest(dir)) console.log(`  ${s.path.padEnd(22)} ${String(s.count).padStart(5)}  ${s.sha256}`);
      console.log(`stamped ${dir}/manifest.json`);
      return 0;
    }
    default:
      console.log(USAGE);
      return 2;
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 2;
}

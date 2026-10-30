import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import ajvFormats from "ajv-formats";
import type { Report } from "./report.js";

/** The specification version this validator implements. Releases and overlays name it in their manifest. */
export const SPEC_VERSION = "0.1.1";

const SCHEMA_ROOT = "https://openconceptgraph.org/spec/0.1/schema/";

/** The schema folder ships beside dist/ and src/, so the same path works built or from source. */
const schemaDir = fileURLToPath(new URL("../schema/", import.meta.url));

function schemaFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? schemaFiles(join(dir, e.name)) : e.name.endsWith(".schema.json") ? [join(dir, e.name)] : [],
  );
}

/** ajv-formats is CommonJS: under Node's ESM loader its function may arrive as the module or as its default. */
type FormatsPlugin = (ajv: Ajv2020, formats: string[]) => unknown;
const formatsModule = ajvFormats as unknown as FormatsPlugin & { default?: FormatsPlugin };
const addFormats: FormatsPlugin = formatsModule.default ?? formatsModule;

// strictRequired is off because the schemas require fields conditionally (if/then), naming properties declared outside the `then`.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
addFormats(ajv, ["date", "uri"]);
for (const file of schemaFiles(schemaDir)) ajv.addSchema(JSON.parse(readFileSync(file, "utf8")));

const compiled = new Map<string, ValidateFunction>();

function validator(ref: string): ValidateFunction {
  let v = compiled.get(ref);
  if (!v) {
    v = ajv.getSchema(SCHEMA_ROOT + ref);
    if (!v) throw new Error(`No schema at ${ref}`);
    compiled.set(ref, v);
  }
  return v;
}

function describe(e: ErrorObject): string {
  const where = e.instancePath || "(top)";
  const extra =
    e.keyword === "additionalProperties"
      ? ` (${String((e.params as { additionalProperty: string }).additionalProperty)})`
      : e.keyword === "enum"
        ? ` (${JSON.stringify((e.params as { allowedValues: unknown[] }).allowedValues)})`
        : "";
  return `${where} ${e.message ?? e.keyword}${extra}`;
}

/** Checks data against a schema (`release/transcription.schema.json#/$defs/statements`); reports each failure. */
export function checkSchema(report: Report, ref: string, data: unknown, file: string): boolean {
  const v = validator(ref);
  if (v(data)) return true;
  for (const e of (v.errors ?? []).slice(0, 25)) report.error("schema", describe(e), { file });
  if ((v.errors?.length ?? 0) > 25) report.error("schema", `${(v.errors?.length ?? 0) - 25} more schema errors`, { file });
  return false;
}

/** True when a bundle's `spec` version is one this validator implements (0.1.x). */
export function specSupported(version: string): boolean {
  const [major, minor] = version.split(".");
  const [ours, oursMinor] = SPEC_VERSION.split(".");
  return major === ours && minor === oursMinor;
}

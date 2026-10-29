# OpenConceptGraph specification

**Open concept graphs of the world's curricula, built for AI-assisted learning.**

This repository is the standard: the data model, JSON Schemas, a JSON-LD context, the mapping to 1EdTech CASE 1.1, identifier and versioning rules, and a reference validator. A **base** is one curriculum for one subject built to it, such as [CAPS Mathematics](https://github.com/openconceptgraph/base-za-caps). The [platform](https://github.com/openconceptgraph/platform) is where a base is transcribed, drafted, reviewed and released.

**Status: 0.1.0, a draft.** It describes what the first base needs, and it will change before 1.0.0.

## The idea in brief

A curriculum document says what to teach. It does not say what a learner must already have secure, or what typically goes wrong. A base adds both, without blurring them into the official text:

- **Transcription:** the authority's documents, headings and statements, word for word, with their pages, and the teaching plans that place them in time.
- **Interpretation:** concepts (atomic teachable units), families, levels, typical mistakes, and typed links (`needs`, `hinders`, `defines`, `part-of`). Each link has a source and a status, and nothing is released until qualified reviewers have confirmed it.
- **Provenance:** a source for every link and mistake, and a published summary of the reviews.

Clients align their own artefacts to a base through **overlays**, pinned to a release. The base never holds a client's records.

## What is here

| Path | What it is |
|---|---|
| [`docs/model.md`](docs/model.md) | The model: every object, field and link type |
| [`docs/identifiers-and-versions.md`](docs/identifiers-and-versions.md) | Permanent UUIDs, codes, retirement, semver, pinning |
| [`docs/release.md`](docs/release.md) | A base release: its files, manifest and what it may hold |
| [`docs/overlay.md`](docs/overlay.md) | Overlays: client profile, artefacts, alignments, plans |
| [`docs/case-mapping.md`](docs/case-mapping.md) | How a release maps to CASE 1.1 |
| [`docs/validation.md`](docs/validation.md) | Every rule the validator checks |
| [`schema/`](schema/) | JSON Schema 2020-12, for releases and overlays |
| [`context/ocg-0.1.jsonld`](context/ocg-0.1.jsonld) | JSON-LD context: a release is also linked data |
| [`examples/`](examples/) | A small fictional release and an overlay pinned to it |
| [`src/`](src/) | The reference validator, `ocg-validate` (TypeScript) |

## Validate a release or an overlay

Node 22 or later and pnpm:

```sh
pnpm install
pnpm run build
node dist/cli.js release examples/release
node dist/cli.js overlay examples/overlay --base examples/release
```

`pnpm test` runs the validator's tests. The package (`@openconceptgraph/validate`) is not yet published to npm.

## Licence and contributions

Apache-2.0 ([LICENSE](LICENSE)). The examples are fictional and written for this specification.

Contributions are signed off under the [Developer Certificate of Origin](https://developercertificate.org/) (`git commit -s`).

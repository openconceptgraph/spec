# Changelog

## 0.1.1 (draft, 2026-10-30)

- **Draft bundles** (`kind: base-draft`): a release's layout for a private workspace or a tool built on a base, holding proposed interpretation beside confirmed, each object with its review so far. Its version is marked draft (`0.1.0-draft.1`); it is never published. `ocg-validate draft` checks one, and the validator refuses it as a release. New rules `bundle-kind` and `draft-status`; an overlay pinned to a draft is warned (`base-draft`).
- A release's version may not be marked draft.
- **`explains`**, a seventh alignment type: reference material (a source document, a textbook section) explains a concept or level, so that what is taught can be grounded in it.

## 0.1.0 (draft, 2026-10-29)

First draft of the specification.

- The model: transcription (framework, education levels, documents with transcription checks, nodes, statements, teaching plans, placements), interpretation (families, concepts, levels, misconceptions, links: `needs`, `hinders`, `defines`, `part-of`, `replaced-by`) and provenance (sources, review summaries, retired IDs).
- The base release: its files and manifest, with a review policy the validator enforces.
- Overlays: client profile, artefacts, alignments (`teaches`, `assumes`, `tests`, `reveals`, `backfills`, `covers`), plans and placements, pinned to a release.
- JSON Schema 2020-12 for both, a JSON-LD context, and the mapping to CASE 1.1.
- The reference validator, `ocg-validate`, with a fictional example release and overlay.

# Changelog

## 0.1.0 (draft, 2026-10-29)

First draft of the specification.

- The model: transcription (framework, education levels, documents with transcription checks, nodes, statements, teaching plans, placements), interpretation (families, concepts, levels, misconceptions, links: `needs`, `hinders`, `defines`, `part-of`, `replaced-by`) and provenance (sources, review summaries, retired IDs).
- The base release: its files and manifest, with a review policy the validator enforces.
- Overlays: client profile, artefacts, alignments (`teaches`, `assumes`, `tests`, `reveals`, `backfills`, `covers`), plans and placements, pinned to a release.
- JSON Schema 2020-12 for both, a JSON-LD context, and the mapping to CASE 1.1.
- The reference validator, `ocg-validate`, with a fictional example release and overlay.

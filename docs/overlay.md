# Overlays

An overlay is a client's own artefacts (lessons, videos, questions, whatever the client makes) and how they align to a base. It is data, pinned to one base release. **The base never holds a client's records**, and an overlay never changes the base.

Schemas: [`schema/overlay/`](../schema/overlay/). An example: [`examples/overlay/`](../examples/overlay/), pinned to [`examples/release/`](../examples/release/).

## Layout

```
manifest.json      whose overlay it is, the base release it is pinned to, every file's hash
profile.json       the client profile: its namespace and its kinds of artefact
artefacts.json     the client's artefacts
alignments.json    links from artefacts into the pinned release
plans.json         the client's own teaching sequences
placements.json    when each plan teaches each artefact
```

## The records

**Client profile.** Written when the client is onboarded. It sets out:
- the client's `namespace`;
- each **kind** of artefact it has, the alignment types that kind may carry, and the nearest schema.org/LRMI `learningResourceType`.

Kinds are the client's own. A shared vocabulary of kinds will be agreed only once several clients' kinds can be compared, borrowing from schema.org/LRMI and, for assessment items, QTI.

**Artefact.** Identifies one artefact:
- its UUID, the client's namespace and its kind;
- the client's own code, title and language;
- a URL or an opaque `ref`;
- optionally the artefact it sits inside (a question inside a lesson's exit ticket).

**An artefact record does not carry the artefact's content.** The content stays wherever the client keeps it.

**Alignment.** A typed link from an artefact (or a `part` of it, such as "option B") into the pinned release, with a source (an AI run, a person, or an import) and its own status.

| `alignmentType` | Points at | Meaning |
|---|---|---|
| `teaches` | concept or level | The artefact sets out to teach it. |
| `assumes` | concept or level | It relies on it without teaching it. |
| `tests` | concept or level | It checks it. |
| `reveals` | misconception | Choosing it (usually a wrong option) shows the mistake. |
| `backfills` | concept or level | It remedies a prerequisite the learner lacks. |
| `covers` | statement or node | It covers official curriculum text directly. |

An alignment's status is the client's own (`proposed`, `confirmed`, `rejected`). Its target must be in the pinned release, which holds only confirmed base objects (a [draft bundle](release.md#draft-bundles) may also hold proposed ones).

**Plans and placements.** A client's teaching sequence is a plan like any other. A placement says when it teaches one of the client's artefacts, using the base's education levels.

## What an overlay makes possible

Because the alignments point at a reviewed graph, reports follow from the data alone:
- **Coverage** against any teaching plan.
- **Assumed but never taught:** concepts an artefact assumes that nothing teaches.
- **Taught out of order:** a concept taught before one it needs.
- **Mistakes a question bank can catch, and those it never does.**
- **On a re-pin:** what changed.

## Pinning and re-pinning

The manifest pins the base by slug, framework UUID and exact version, and optionally by the SHA-256 of the release's `manifest.json`. A newer release is adopted by an explicit re-pin. `replaced-by` links carry most alignments across, and the rest are listed for a person to decide ([identifiers-and-versions.md](identifiers-and-versions.md)).

A pilot may pin a [draft bundle](release.md#draft-bundles) before the base's interpretation is confirmed. The validator checks the pin as for a release and warns that it is a draft. Re-pin to a release before anything aligned to it is published.

## Linked data

If an overlay is published as JSON-LD, give it its own `@base` in the client's own domain. Client records are never addressed under `openconceptgraph.org/id/`.

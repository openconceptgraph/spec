# The model

A base holds one curriculum for one subject, in three layers kept apart on purpose. Schemas: [`schema/release/`](../schema/release/).

| Layer | What it is | Who it belongs to |
|---|---|---|
| **Transcription** | What the curriculum authority published, word for word, with its page | The authority. Endorsement attaches here |
| **Interpretation** | The base's reading of it: concepts, families, levels, typical mistakes, and the links between them | The base. Trust is earned through review |
| **Provenance** | Where each link and mistake comes from, and what reviewers decided | The base |

Client overlays sit outside the base entirely ([overlay.md](overlay.md)).

## Conventions

- **Identity.** Every object has a permanent `id`: a version 4 UUID in lower case. A `code` is a label for people and never the identity ([identifiers-and-versions.md](identifiers-and-versions.md)).
- **References.** An object refers to another by UUID, in a field named for what it points at (`framework`, `document`, `parent`, `concept`, `source`).
- **Every object carries `type` and `revision`.** `type` names the kind (`"Concept"`). `revision` counts changes to its content. A review names the revision it judged, so a change sends the object back for review.
- **Two kinds of text.**
  - *Official text* (a statement's words, a document's title, a heading) is a plain string, copied exactly, in its document's language.
  - *Authored text* (a concept's title, a mistake, a rationale) is a language map keyed by BCP 47 tag, `{"en": "...", "af": "..."}`, the same shape as a JSON-LD language map.
- **Status.** Interpretation objects and links carry `status`: `proposed`, `confirmed` or `rejected`. Only confirmed objects reach a release.

## Transcription

| Object | Holds | Notes |
|---|---|---|
| **Framework** | Slug (`za-caps/mathematics`), title, jurisdiction (ISO 3166), subject, publisher, `nodeTypes`, education levels | A framework names its own structure: `nodeTypes` lists its heading types from the top down, such as `["content-area", "topic"]` for one curriculum or `["domain", "cluster"]` for another. |
| **Education level** | Local code ("8", "Y10"), title, **ISCED 2011 level**, order | Lives inside the framework. ISCED makes grades comparable across countries. |
| **Document** | Official title, language, publisher, date, version label, URL, rights; optionally the file's hash and page offset, and **checks** | One official publication. Citation and licence attach here. A check records the transcription being checked, by machine against the file's text layer or by a person against the printed page, with the pages, the date and (for a person) their public name. |
| **Node** | Document, parent, `nodeType`, code ("1.3"), title, order | A heading, at any depth. Its type must be one of the framework's `nodeTypes`. |
| **Statement** | Document, node, parent, education level, `statementType`, `revise`, code, text, page, order. Optionally: the printed `label` and `heading`, a `locator`, `verifiedBy` and a transcriber's `note` | The unit a concept is defined by and coverage is measured against. See below. |
| **Teaching plan** | Framework, source document, slug, title | A sequence for teaching the framework: the curriculum's own terms and hours, or an annual plan's weeks. |
| **Placement** | Plan, target (a node, family or concept), education level, term, weeks, hours, order, `asPrinted` | When a plan teaches something. **Timing lives here, never in a concept**: a new teaching plan changes placements, not concepts. |

**Statements.** A statement is one line of official text. Its `statementType` says what kind:
- `content`: a leaf of the curriculum;
- `clarification`: teaching guidance beside it;
- `progression`: the authority's own account of what changes from the grade before;
- `exemplar`: a worked example;
- `prerequisite`: a stated prerequisite, such as a teaching plan's pre-knowledge cell.

Nested bullets point at their `parent`. Four optional fields keep the transcription faithful:
- `revise` marks a line that points back to earlier teaching. It never creates a concept.
- `label` keeps a printed lead-in ("Revise:", "Example:").
- `heading` keeps the printed sub-heading the line sits under.
- `verifiedBy` says whether the machine check confirmed the line against the file's text layer or, where the text layer could not order it, by eye.

The original's own errors are kept as printed, with a transcriber's `note`.

## Interpretation

| Object | Holds | Notes |
|---|---|---|
| **Family** | Code, title, description | A planning-grain group of concepts. |
| **Concept** | Code, aliases, title, description, `kind` (fact, category, procedure, principle), `gateway` | The atomic teachable unit: taught in one go, checked with a few short questions, with at least one typical way of going wrong. Split a concept where the governing rule and the typical mistake change. Concepts are authored per framework, in the base's own namespace; there is no universal ontology. |
| **Level** | Concept, order, title | An ordered variant of a concept that differs only by a parameter, such as the number range. |
| **Misconception** | Code, `statement` (the wrong rule, written as a rule), example, source | A typical mistake. A null source means unsourced, and consumers should say so. |
| **Link** | `linkType`, `from` and `fromKind`, `to` and `toKind`, source, status; optionally confidence and rationale | Typed and directed. **Every link has a source and a status.** |

**Link types**

| `linkType` | From → to | Meaning |
|---|---|---|
| `needs` | concept → concept | The origin needs the target: the target must be secure before the origin can be learnt. **`needs` never loops.** |
| `hinders` | misconception → concept | The mistake blocks the concept. |
| `defines` | statement → concept | The statement defines the concept: its word-for-word source. **Every concept has at least one.** |
| `part-of` | concept → family | One family per concept at most. |
| `replaced-by` | retired object → its replacement | Both of the same kind. |

Reserved for a later version: `exact-match` and `close-match` between concepts of different bases (crosswalks).

## Provenance

| Object | Holds | Notes |
|---|---|---|
| **Source** | `kind` and its fields: `statement` (a statement's ID), `publication` (citation, URL), `reviewer` (a public name), `ai` (model and prompt version) | Every link cites one; so does every sourced misconception. |
| **Review** | Object and kind, revision, status, date decided, reviewers' public names, number of judgements | The published summary of the judgements on one object. The judgements themselves stay in the steward's append-only record. Reviewers appear under the public names they chose. |
| **Retired** | ID, kind, the release that retired it, its replacement | A retired ID stays reserved for ever. |

## Rules that bind every release

The validator checks each of these ([validation.md](validation.md)):
1. IDs are permanent UUIDs and never reused.
2. Every concept is defined by at least one statement, word for word.
3. Every link has a source and a status.
4. `needs` never loops.
5. Only confirmed interpretation is released, each object with a review summary that meets the base's review policy.

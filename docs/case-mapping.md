# Mapping to 1EdTech CASE 1.1

A base release can be published as a [CASE 1.1](https://www.1edtech.org/standards/case) package, so any CASE-aware tool can read it without integration. The native release stays the full truth; CASE carries what CASE can, plus `extensions` blocks for the rest. This page is the mapping a release builder follows. Publishing CASE JSON is not the same as being CASE Certified, which only 1EdTech can grant.

## Packages and documents

Each release becomes CASE packages of two kinds:

| CFDocument | From | Creator |
|---|---|---|
| **One per official Document** | The transcription: its nodes and statements | The curriculum authority (the document's `publisher`) |
| **One for the base's interpretation** | Concepts, families and levels | The steward |

Keeping the authority's text and the base's reading in separate CFDocuments is deliberate: endorsement attaches to the first, and trust in the second is earned through review.

**CFDocument fields:**
- `title`, `language`, `publisher` and `officialSourceURL` come from the Document; `version` from its `versionLabel`.
- `licenseURI` points at the release's licence.
- `subject` is the framework's subject.
- The interpretation CFDocument's identifier is a version 5 UUID derived from `<framework UUID>|CFDocument|interpretation`, so it is stable from release to release.

## Items

| Native | CFItem | Fields |
|---|---|---|
| Node | `CFItemType` = its `nodeType` | `fullStatement` = title; `humanCodingScheme` = code |
| Statement | `CFItemType` = its `statementType` | `fullStatement` = text; `humanCodingScheme` = code; `educationLevel` = its level's code; `notes` = page and locator; `extensions.ocg` = `revise`, `label`, `heading`, `page`, `verifiedBy`, `note` |
| Concept | `CFItemType` = `concept` | `fullStatement` = title; `humanCodingScheme` = code; `extensions.ocg` = `kind`, `gateway`, `aliases`, `description`, `status`, the review summary, and **`misconceptions`** |
| Family | `CFItemType` = `family` | `fullStatement` = title; `humanCodingScheme` = code |
| Level | `CFItemType` = `level` | `fullStatement` = title; `listEnumeration` = its order |

**Identifiers.** Every object keeps its UUID as its CASE `identifier`, and its `uri` is `https://openconceptgraph.org/id/<uuid>`.

**Text.** CASE strings take one language. A language map contributes the release's main language: the language of the framework's principal document, or `en` when that is absent. The full maps stay in `extensions.ocg`.

**Misconceptions** are not items. Each concept's `extensions.ocg.misconceptions` lists the mistakes that hinder it, each with its `id`, `code`, `statement`, `example`, source and review summary.

## Associations

| Native | CFAssociation | Origin → destination | Identifier |
|---|---|---|---|
| Node or statement under its parent | `isChildOf` | child → parent (a top node → its CFDocument) | derived |
| `needs` (A needs B) | **`ext:requires`** | A → B | the link's |
| | **`precedes`** (a standard-vocabulary shadow) | B → A | derived |
| `defines` (statement S defines concept C) | **`ext:defines`** | S → C | the link's |
| | `isRelatedTo` (shadow) | S → C | derived |
| `part-of` | `isPartOf` | concept → family | the link's |
| Level of a concept | `hasSkillLevel` | concept → level | derived |
| `replaced-by` | `replacedBy` | retired → replacement | the link's |
| `hinders` | none: carried in the concept's `misconceptions` | | |

- **Shadows** let a tool that ignores `ext:` types still see the order (`precedes`) and the tie between statement and concept (`isRelatedTo`).
- **`sequenceNumber`** is the object's `ordinal` where it has one.
- **Every association made from a link** carries `extensions.ocg` with its `source`, `status`, review summary, and, where present, `confidence` and `rationale`.
- **Derived identifiers** are version 5 UUIDs in the namespace given in [identifiers-and-versions.md](identifiers-and-versions.md).

## Definitions

`CFDefinitions` lists:
- the item types used (the framework's node types, the five statement types, `concept`, `family`, `level`);
- the subject;
- the licence.

## Not in CASE (0.1)

- **Teaching plans and placements:** CASE has no place for timing, so they are in the native release only.
- **Documents' transcription checks:** native only.

Both may move into `extensions` in a later version.

## Other exports

- A **JSONL export shaped like Learning Commons'** (one object per line) is planned, for tools that ingest that format.
- **CSV tables** of the main objects are planned too.

Neither is part of 0.1.

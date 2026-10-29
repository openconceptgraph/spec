# A base release

A release is a folder of JSON files and a `manifest.json`. It is the archival and legal form of a base: what the licence attaches to, what an authority can endorse, and what survives any server. APIs serve releases; they do not replace them.

## Layout

```
manifest.json          what the release is, its licence, its review policy, every file's hash
framework.json         the framework and its education levels (one object)
documents.json         official documents, with their transcription checks
nodes.json             the documents' headings
statements.json        the official statements, word for word
teaching-plans.json    teaching plans
placements.json        when each plan teaches what
families.json          ┐
concepts.json          │
levels.json            │ the interpretation: confirmed objects only
misconceptions.json    │
links.json             ┘
sources.json           where links and mistakes come from
reviews.json           one review summary per released interpretation object and link
retired.json           IDs no longer live
```

Each file except `framework.json` is a JSON array of objects. Every object carries `id`, `type` and `revision`. Schemas: [`schema/release/`](../schema/release/). An example: [`examples/release/`](../examples/release/).

## The manifest

| Field | Meaning |
|---|---|
| `spec` | The version of this specification the release conforms to. |
| `kind` | Always `base-release`. |
| `base`, `framework` | The framework's slug and UUID. |
| `version`, `previous` | This release's version, and the one before it. |
| `released` | The date. |
| `title`, `notes` | Release title and notes, as language maps. |
| `license` | SPDX identifier and URL. |
| `attribution` | The credit lines a user must carry, in full: the steward's and the curriculum authority's. |
| `reviewPolicy` | The base's own confirmation rule: `minReviewers`, the number of different reviewers who must confirm each object. |
| `files` | For each file, its path, SHA-256 and object count. `ocg-validate stamp <dir>` writes them. |

## What a release may hold

- **All of the transcription it covers.** The authority's text is public; the release says which documents and pages it covers.
- **Confirmed interpretation only.** Proposed and rejected objects stay in the steward's working database. AI drafts are never released unreviewed.
- **A review summary for every released interpretation object and link:** its status, the revision judged, the reviewers' public names and how many judgements. It must meet the manifest's `reviewPolicy`.
- **No people's real names unless they chose them,** and no learner data of any kind.

## Claims

What a release lets anyone say follows from what it holds. For example:
- "Term 1 Numbers transcribed word for word, checked by machine and by a person" needs `checks` on the document;
- "reviewed by two qualified reviewers" needs `reviewPolicy.minReviewers` of 2 and the review summaries to match.

Claim only what the release supports.

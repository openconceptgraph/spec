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

## Draft bundles

A **draft bundle** has a release's layout, files and schemas, but it is not a release. It exists so that a client's private workspace, or a tool built on a base, can work with a base before its interpretation has been confirmed: a pilot that cannot wait for two reviewers, or a slice one reviewer has checked so far. It is **never published**: not in a base's public repository, not on a public server.

- **Its manifest says so:** `kind` is `base-draft`, and its version is a pre-release marked draft, such as `0.1.0-draft.3`. `previous` names the release it builds on, if any.
- **It may hold proposed interpretation** beside confirmed: families, concepts, levels, mistakes and links that reviewers have not yet confirmed, each with its status. It never holds anything rejected, retired or planted.
- **Each object has its review so far** in `reviews.json`: its status, and the public names of the reviewers whose current judgements confirm it. An object nobody has judged has no reviewers, no judgements and no `decided` date. What a draft holds as `confirmed` must still meet the base's review policy.
- **The transcription is the same** as a release's: in full.
- **The validator accepts it only as a draft** (`ocg-validate draft <dir>`), and refuses it as a release. An overlay may pin a draft, with a warning; re-pin to a release before anything aligned to it is published.

What a draft lets anyone say is narrower than a release. A concept a draft holds as proposed, with one reviewer so far, is "reviewed by one reviewer", not "confirmed"; one with no reviewers is "drafted, not reviewed".

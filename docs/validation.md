# Validation

The reference validator, `ocg-validate`, checks a base release or an overlay. It first checks every file against its JSON Schema, then checks the rules a schema cannot express. **Errors** make a bundle non-conformant. **Warnings** are for a person to look at.

```sh
pnpm install && pnpm run build
node dist/cli.js release <dir>                    # a base release
node dist/cli.js draft <dir>                      # a draft bundle, which is never published
node dist/cli.js overlay <dir> --base <release>   # an overlay and its pin (to a release or a draft)
node dist/cli.js stamp <dir>                      # write the manifest's hashes and counts
```

As a library: `validateRelease(readBundle(dir))` (with `{ draft: true }` for a draft bundle) and `validateOverlay(readBundle(dir), base)` return `{ ok, errors, warnings }`. Each issue carries its rule, the file and the object's ID.

## Rules for a base release

| Rule | Severity | Checks |
|---|---|---|
| `schema` | error | Each file against its schema. If any file fails, the rules below are skipped (`skipped`). |
| `spec-version` | error | The manifest's `spec` is one the validator implements (0.1.x). |
| `bundle-kind` | error | A release is checked as a release and a draft bundle as a draft, never the other way round. |
| `manifest-files` | error | Each listed file exists, and its SHA-256 and object count match the manifest. |
| `manifest-framework` | error | The manifest's `framework` and `base` are the framework's UUID and slug. |
| `unique-ids` | error | No ID is used twice anywhere in the release, including among retired IDs. |
| `framework-scope` | error | Every document, plan, family, concept, mistake and source belongs to the release's framework. |
| `reference` | error | Every reference resolves to a live object of the right kind. |
| `node-type` | error | A node's type is one of the framework's `nodeTypes`. |
| `node-tree` | error | Nodes and statements nest inside their own document, and no chain of parents loops. |
| `placement` | error | A placement's weeks do not run backwards. |
| `link-endpoints` | error | Each link type joins the kinds it may (see [model.md](model.md)); `replaced-by` starts at a retired object and ends at one of the same kind. No link joins an object to itself. |
| `needs-acyclic` | error | `needs` never loops. The error names the loop by concept code. |
| `concept-defined` | error | Every concept is defined by at least one statement. |
| `one-family` | error | A concept is part of one family at most. |
| `unique-codes` | error | Codes are unique: education levels, plan slugs, families, concepts (with their aliases) and mistakes in the framework; nodes and statements within their document. |
| `released-status` | error | Every family, concept, level, mistake and link is `confirmed`. A draft bundle checks `draft-status` instead. |
| `draft-status` | error | In a draft bundle, every family, concept, level, mistake and link is `proposed` or `confirmed`, never `rejected`. |
| `review-coverage` | error | Each of those has exactly one review summary, with the object's own status (in a release, `confirmed`), on its current revision. Whatever is `confirmed` has at least the manifest's `reviewPolicy.minReviewers` reviewers. |
| `retired` | error | A retired ID is not also live, and a replacement has its `replaced-by` link. |
| `concept-without-mistake` | warning | A concept has no typical mistake (`hinders`). |
| `revise-defines` | warning | A `revise` statement defines a concept. A revise line points back to earlier teaching; it should not create one. |
| `unsourced-misconception` | warning | A mistake has no source. |

## Rules for an overlay

| Rule | Severity | Checks |
|---|---|---|
| `schema`, `spec-version`, `manifest-files`, `unique-ids` | error | As for a release. |
| `namespace` | error | The profile, artefacts and plans are all in the client's namespace. |
| `unique-codes` | error | Artefact kinds and plan slugs are unique. |
| `artefact-kind` | error | Each artefact's kind is defined in the profile. |
| `reference` | error | Parents, artefacts and plans resolve within the overlay, without loops; education levels resolve in the pinned base. |
| `alignment-allowed` | error | The profile allows the alignment type for the artefact's kind. |
| `alignment-target` | error | The target is the right kind for the alignment type and is in the pinned release (a retired target asks for a re-pin). |
| `placement` | error | Weeks do not run backwards. |
| `base-pin` | error | The release given is the pinned slug, framework and version, and matches `manifestSha256` when it is set. |
| `base-not-checked` | warning | No base release was given, so the pin and the targets were not checked. |
| `base-draft` | warning | The pin is to a draft bundle, not a release. |

## Tests

`pnpm test` checks the two examples (both conform with no warnings) and breaks a copy of each in turn to show that every rule catches what it should.

# Identifiers and versions

## Identifiers

- **Canonical identifier: a version 4 UUID in lower case,** minted when the object is created. CASE requires UUIDs, and a UUID carries no meaning that could go stale.
- **Permanent and never reused.** An object is never deleted. When it stops being live it is *retired*: it is listed in the release's `retired.json` with the release that retired it, and, where it has a replacement, a `replaced-by` link points to it. Its ID stays reserved.
- **Codes are labels.** `code` (`INT-03`, `8/1.3/c04`) is for people. A concept may gain `aliases`, but a code never changes meaning, and no reference uses one.
- **Global address:** `https://openconceptgraph.org/id/<uuid>` resolves any base object, whatever its kind: HTML for a browser, JSON-LD for a machine. This is what makes a release linked data ([`context/ocg-0.1.jsonld`](../context/ocg-0.1.jsonld) maps every field).
- **Namespaces.**
  - A base's objects belong to its framework.
  - A client's artefacts, alignments and plans belong to the client's `namespace` and are never addressed under `openconceptgraph.org/id/`.
  - Concepts are authored per framework. Equivalence across frameworks waits for crosswalks.
- **Derived identifiers** (CASE associations that are not links, such as `isChildOf`) are version 5 UUIDs, so they stay stable from release to release. The namespace is `9f29ac24-a279-4bcf-995a-7a71e2c44896`, and the name is `<origin UUID>|<association type>|<destination UUID>`.

## Versions of a base

Each base is released with its own [semantic version](https://semver.org/):

| Change | Version | Examples |
|---|---|---|
| **Patch** | 0.1.**1** | A link or mistake corrected, a rationale reworded, a transcription error fixed. No concept's meaning changes and no ID is retired. |
| **Minor** | 0.**2**.0 | Concepts, statements, links, mistakes, placements or teaching plans added. A concept retired with a replacement inside the same curriculum. |
| **Major** | **1**.0.0 | A new official version of the curriculum. |

- Each release names the one before it (`previous`).
- The current major and the one before it are supported.
- Before 1.0.0, a base is still finding its shape: minors may retire more freely, always with replacements.

## Pinning

An overlay pins one release: the framework, the exact version and, optionally, the SHA-256 of the release's `manifest.json`. Moving to another release is an explicit **re-pin**, never automatic:
- `replaced-by` links carry most alignments across;
- the rest are listed for a person to decide.

A new teaching plan is not a re-pin: it changes placements, so only the coverage report changes.

## Versions of this specification

This specification has its own version, separate from any base's. A release or overlay names the version it conforms to in its manifest's `spec` field. Before 1.0.0, a minor version may make breaking changes.

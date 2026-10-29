# Accepted Hello Observatory packages

These are byte-for-byte copies of the three Step A portable packages from the separately owned, CC0 [reference repository](https://github.com/bobrs/observatory-hello-reference), not another implementation of its app.

- Reviewed source: `982aeb68451a8044a00c15a7f079861ac53e31bb` ([accepted PR #1](https://github.com/bobrs/observatory-hello-reference/pull/1)).
- Accepted main merge: `da5731368d49c0426fd57a52588ff3db3e4a69e2`; identical reviewed tree.
- [Canonical contract](https://github.com/bobrs/observatory-hello-reference/blob/da5731368d49c0426fd57a52588ff3db3e4a69e2/CONTRACT.md) and [external evidence index](https://github.com/bobrs/observatory-hello-reference/blob/da5731368d49c0426fd57a52588ff3db3e4a69e2/evidence/step-a/artifact-index.json).
- Dev transcribed Sponsor acceptance/merge and Step B authorization in [Issue #7](https://github.com/bobrs/Application-Observatory/issues/7#issuecomment-6485726662). These role statements are not separately authenticated GitHub identities.

The trusted [Observatory verifier/index](../../src/reference/catalog.ts) pins the accepted digests outside these packages and checks exact membership and covered bytes **before** execution. It does not import a candidate's verifier. Including a copy here makes the demo reproducible without fetching repositories or downloading candidate code at runtime. The runtime copies verified files into a generated local workspace once, retains the original earlier artifacts and refuses altered retained packages rather than repairing them silently. No build or source lookup is part of activation.

| Version | Canonical package SHA-256 |
| --- | --- |
| 1.0.0 | `53cfab8899f14848e3979a1afa2e41c12334fb05bccee5c55398d53598c04262` |
| 1.1.0 | `17498c7bc08280b1bc2077d9ee302bdada8fb401192f2efce61f594ad2b236e8` |
| 1.2.0 | `7410f8f433f8d7668000a290b573df8873334ca1f4aadc4622c48b76610b199f` |

Do not edit these package bytes in place. Future artifact changes need their own review and explicitly updated external pins. Source SHA, package identity, HTTP response hash, launch context and boot identity are different evidence. Node/OS and hostile same-user interference are outside the package boundary. See the included [CC0 license](LICENSE).

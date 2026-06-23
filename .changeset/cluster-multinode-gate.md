---
"@objectstack/service-cluster": minor
"@objectstack/cli": minor
---

feat(cluster): multi-node authorization gate (open mechanism)

`@objectstack/service-cluster` now exports `registerMultiNodeGate` /
`checkMultiNodeAllowed`: a distribution (e.g. the Enterprise Edition) can
register a gate that authorizes whether the runtime may enable a multi-node
(remote-driver) topology. The open framework ships no gate — multi-node is
always allowed.

`os serve` consults the gate before activating a remote cluster driver; on
denial it **downgrades to single-node (in-memory) rather than failing** —
multi-node is an add-on, never bricks the runtime. The framework holds zero
license logic; this is the open seam an EE license plugs into (cloud ADR-0022).

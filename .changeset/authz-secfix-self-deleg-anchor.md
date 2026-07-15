---
'@objectstack/plugin-security': patch
---

Security fix: constrain self-delegation (D3) position anchor to prevent lateral
visibility escalation (cloud#830 follow-up).

cloud#830 (C1 position-anchor) made `sys_user_position.business_unit_id`
visibility **load-bearing** — it is the readScope depth anchor, so a
`unit`/`unit_and_below` holder sees the owner set rooted at that BU (and, for
`unit_and_below`, its whole subtree). The delegated-admin gate's self-service
delegation path (`assertSelfDelegation`) stamped this anchor with **no
subtree/source constraint**: a holder of a delegatable, non-admin-scope position
anchored at a LOW business unit could delegate it to a co-conspirator with an
**ancestor / arbitrary-high** anchor, leaking that BU's whole subtree of member
records — visibility beyond the delegator's own range. Mutual delegation could
grant it both ways.

The gate now requires a self-delegated `business_unit_id` to fall inside the
delegator's **own effective anchor** for that position (the subtree of their own
direct holding's anchor, or of their member BU when the holding is unanchored) —
the same "assignments must target your subtree" spirit as the D12
delegated-admin boundary. Fail-closed: an anchor that cannot be proven inside the
delegator's range is rejected. Unanchored delegation rows keep prior behavior
(the delegate resolves to their own member BU — not a widening). The
"anchoring only narrows, never widens" invariant now holds on the D3 path too.

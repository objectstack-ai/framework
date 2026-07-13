---
'@objectstack/spec': patch
'@objectstack/platform-objects': patch
---

**Action params gain a `visible` predicate; the create-user `phoneNumber` param is gated on `features.phoneNumber`.**

`ActionParamSchema` gains an optional `visible` (CEL, `ExpressionInputSchema`) evaluated against the same scope as action `visible` (`current_user`/`app`/`data`/`features`); a UI that honors it omits the param when it's false. The `sys_user` `create_user` action's `phoneNumber` param now carries `visible: 'features.phoneNumber == true'`, so the form no longer offers a Phone Number field when the opt-in `phoneNumber` auth plugin is off — otherwise the endpoint rejects it with "Phone numbers require the phoneNumber auth plugin". Pairs with the objectui `ActionParamDialog` change that evaluates `param.visible`.

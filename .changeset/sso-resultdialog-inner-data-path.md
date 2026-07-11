---
'@objectstack/platform-objects': patch
---

`sys_sso_provider` domain-verification `resultDialog` paths now address the
inner `data` payload (`dnsRecordType`, not `data.dnsRecordType`), matching every
other object. Pairs with the objectui `apiHandler` envelope-unwrap fix
(objectui#2396) — the old `data.` prefix compensated for a runtime bug and would
blank the dialog once the runtime unwraps correctly.

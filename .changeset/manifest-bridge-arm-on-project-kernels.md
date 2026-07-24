---
"@objectstack/objectql": patch
---

fix(objectql): arm the late-manifest metadata bridge on project kernels too

The per-manifest bridge added for marketplace installs (#3428) armed itself
inside the same `environmentId === undefined` gate as the one-shot startup
bridge — but `os dev` boots the kernel project-scoped (environmentId
'env_local'), which is marketplace install-local's primary home, so the fix
was inert exactly where it matters. Caught by browser-dogfooding the install
flow.

The gate is correct for the one-shot bridge (it copies the entire
process-wide SchemaRegistry, which would leak sibling-project objects on
multi-environment servers) but does not apply to the per-manifest bridge: it
only copies the objects of the one package this kernel just registered.
Arming now happens unconditionally at the end of `start()`; boot-time
behavior on every kernel shape is unchanged (the flag still flips only after
the startup path has run), and the one-shot bridge keeps its gate.

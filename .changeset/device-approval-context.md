---
"@objectstack/cloud-connection": patch
---

bind/start appends device context (`runtime_name`, `runtime_version`) to the device-flow verification URLs so the cloud approval page can show WHAT is being authorized (ADR runtime-identity-binding §2.3). Display-only informed-consent context; the approval page pairs it with an "only approve if you started this" warning.

---
"@objectstack/service-settings": minor
---

feat(settings): `company` settings — legal organization identity

Adds a `company` SettingsManifest for the workspace's **legal entity** identity, distinct from `branding` (public name/logo/theme). Organization-level (`tenant` scope), all keys optional for v1.

Grouped Identity / Registered address / Contact: `legal_name`, `registration_number`, `tax_id`, `address_line1`/`address_line2`/`city`/`state`/`postal_code`/`country`, `phone`, `website`, `primary_contact_name`, `primary_contact_email`. Benchmarked against Salesforce "Company Information" and Stripe's business profile.

These feed invoices/receipts, email footers (CAN-SPAM requires a physical postal address), contracts, and compliance exports. Ships with en + zh-CN translations and a manifest test.

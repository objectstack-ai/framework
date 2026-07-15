---
'@objectstack/metadata-protocol': patch
---

fix(metadata-protocol): findData now rejects unknown `$`-prefixed query parameters with 400 `UNSUPPORTED_QUERY_PARAM` instead of silently treating them as implicit field-equality filters that match zero rows (#2926 ⑩). A `$`-prefixed key can never be a field name, so this is loud-failure only for the unsupported-alias class; bare-key implicit equality filtering is unchanged. The error message lists the supported aliases ($top, $skip, $orderby, $select, $count, $search, $searchFields, $filter, $expand).

---
"@objectstack/client-react": major
---

Remove the deprecated `useQuery` legacy query-field aliases — use the canonical Spec names (11.0).

`UseQueryOptions` / `useQuery` / `useInfiniteQuery` no longer accept the legacy
aliases `select` / `filters` / `sort` / `top` / `skip`. Use the canonical
protocol names instead:

| removed | use |
|---|---|
| `select`  | `fields`  |
| `filters` | `where`   |
| `sort`    | `orderBy` |
| `top`     | `limit`   |
| `skip`    | `offset`  |

Behavior is unchanged for callers already on the canonical names.

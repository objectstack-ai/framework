# API Design — Endpoint & Method Reference

> Auto-derived from `packages/spec/src/api/plugin-rest-api.zod.ts` and related schemas.
> This file is for quick reference only. The Zod source is the single source of truth.

## API Methods (Object Operations)

| Method | HTTP Verb | Path | Description |
|:-------|:----------|:-----|:------------|
| `get` | `GET` | `/:id` | Retrieve single record |
| `list` | `GET` | `/` | List with filter/sort/pagination |
| `create` | `POST` | `/` | Create record |
| `update` | `PATCH` | `/:id` | Update record |
| `delete` | `DELETE` | `/:id` | Delete record |
| `upsert` | `PUT` | `/` | Create or update by external ID |
| `bulk` | `POST` | `/bulk` | Batch operations |
| `aggregate` | `GET` | `/aggregate` | Count, sum, avg, min, max |
| `history` | `GET` | `/:id/history` | Audit trail |
| `search` | `GET` | `/search` | Full-text search |
| `restore` | `POST` | `/:id/restore` | Restore from trash |
| `purge` | `DELETE` | `/:id/purge` | Permanent deletion |
| `import` | `POST` | `/import` | Bulk data import |
| `export` | `GET` | `/export` | Data export |

## Handler Status Values

| Status | Meaning |
|:-------|:--------|
| `implemented` | Fully functional |
| `stub` | Returns mock data |
| `planned` | Defined but not coded |

## Dispatcher Error Codes

| HTTP | Type | Description |
|:-----|:-----|:------------|
| 404 | `ROUTE_NOT_FOUND` | No matching route |
| 405 | `METHOD_NOT_ALLOWED` | Route exists, wrong method |
| 501 | `NOT_IMPLEMENTED` | Handler is stub/planned |
| 503 | `SERVICE_UNAVAILABLE` | Service not ready |

## Service Status Values

| Status | Description |
|:-------|:------------|
| `healthy` | Fully operational |
| `degraded` | Partially functional |
| `unhealthy` | Not operational |
| `registered` | Declared but handler not verified |

## Security Layers

| Layer | Scope | Description |
|:------|:------|:------------|
| Authentication | Request | Identity verification (JWT, API key, OAuth) |
| RBAC | Object | Role-based access control |
| RLS | Record | Row-level security |
| FLS | Field | Field-level security |

## Datasource Drivers

| Driver | Use Case |
|:-------|:---------|
| `postgresql` | Primary production |
| `mysql` | Legacy systems |
| `sqlite` | Local / embedded |
| `turso` | Edge SQLite (serverless) |
| `memory` | Tests / development |

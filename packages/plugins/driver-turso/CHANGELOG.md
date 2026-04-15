# @objectstack/driver-turso

## 4.0.4

### Patch Changes

- Updated dependencies [326b66b]
  - @objectstack/spec@4.0.4
  - @objectstack/core@4.0.4
  - @objectstack/driver-sql@4.0.4

## 4.0.3

### Patch Changes

- @objectstack/spec@4.0.3
- @objectstack/core@4.0.3
- @objectstack/driver-sql@4.0.3

## 4.0.3

### Patch Changes

- fix: implement lazy connect in RemoteTransport to self-heal from serverless cold-start failures, transient network errors, or missed `connect()` calls. The transport now accepts a connect factory and auto-initializes the @libsql/client on first operation when the client is not yet available. Concurrent reconnection attempts are de-duplicated.

## 4.0.2

### Patch Changes

- Updated dependencies [5f659e9]
  - @objectstack/driver-sql@4.0.2
  - @objectstack/spec@4.0.2
  - @objectstack/core@4.0.2

## 3.3.2

### Patch Changes

- Updated dependencies [f08ffc3]
- Updated dependencies [e0b0a78]
  - @objectstack/spec@4.0.0
  - @objectstack/core@4.0.0
  - @objectstack/driver-sql@3.3.2

## 3.3.1

### Patch Changes

- @objectstack/spec@3.3.1
- @objectstack/core@3.3.1
- @objectstack/driver-sql@3.3.1

## 3.3.0

### Minor Changes

- 814a6c4: sql driver

### Patch Changes

- Updated dependencies [814a6c4]
  - @objectstack/driver-sql@3.3.0
  - @objectstack/spec@3.3.0
  - @objectstack/core@3.3.0

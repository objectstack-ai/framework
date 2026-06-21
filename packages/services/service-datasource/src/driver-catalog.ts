// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in datasource driver catalog.
 *
 * Each entry carries a JSON-Schema `configSchema` describing the driver's
 * connection options, so the Studio UI can render a typed connection form
 * instead of a raw-JSON editor (the `DriverDefinitionSchema.configSchema`
 * contract — "Used by the UI to generate the connection form").
 *
 * Served by `GET /api/v1/datasources/drivers`. This is the curated set of
 * connection drivers the connection form offers; a future runtime driver
 * registry can supersede this list without changing the route contract.
 */

export interface DriverCatalogEntry {
  /** Unique driver identifier used as `datasource.driver`. */
  id: string;
  /** Display label. */
  label: string;
  /** Optional one-line description. */
  description?: string;
  /** Optional Lucide icon name. */
  icon?: string;
  /** JSON Schema (draft-2020-12) for the driver's `config` object. */
  configSchema: Record<string, unknown>;
}

const SSL_PROP = {
  ssl: { type: 'boolean', title: 'Use SSL/TLS', default: false },
} as const;

export const DRIVER_CATALOG: DriverCatalogEntry[] = [
  {
    id: 'memory',
    label: 'In-Memory',
    description: 'Ephemeral in-memory driver for dev, tests, and prototyping. No connection settings.',
    icon: 'memory-stick',
    configSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    id: 'sqlite',
    label: 'SQLite',
    description: 'File-backed (or in-memory) SQL database. Great for local dev and small deployments.',
    icon: 'database',
    configSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          title: 'Filename',
          description: 'Database file path, or ":memory:" for an ephemeral in-memory database.',
          default: ':memory:',
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    id: 'postgres',
    label: 'PostgreSQL',
    description: 'PostgreSQL connection. Supply host/port/database or a connection URL.',
    icon: 'database',
    configSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', title: 'Connection URL', description: 'postgres://user:pass@host:5432/db (overrides the fields below when set).' },
        host: { type: 'string', title: 'Host', default: 'localhost' },
        port: { type: 'number', title: 'Port', default: 5432 },
        database: { type: 'string', title: 'Database' },
        username: { type: 'string', title: 'User' },
        password: { type: 'string', title: 'Password', format: 'password' },
        schema: { type: 'string', title: 'Schema', default: 'public' },
        ...SSL_PROP,
      },
      additionalProperties: true,
    },
  },
  {
    id: 'mysql',
    label: 'MySQL / MariaDB',
    description: 'MySQL or MariaDB connection.',
    icon: 'database',
    configSchema: {
      type: 'object',
      properties: {
        host: { type: 'string', title: 'Host', default: 'localhost' },
        port: { type: 'number', title: 'Port', default: 3306 },
        database: { type: 'string', title: 'Database' },
        username: { type: 'string', title: 'User' },
        password: { type: 'string', title: 'Password', format: 'password' },
        ...SSL_PROP,
      },
      additionalProperties: true,
    },
  },
  {
    id: 'mongo',
    label: 'MongoDB',
    description: 'MongoDB connection via a connection URI.',
    icon: 'database',
    configSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', title: 'Connection URI', description: 'mongodb://host:27017' },
        database: { type: 'string', title: 'Database' },
      },
      required: ['url'],
      additionalProperties: true,
    },
  },
];

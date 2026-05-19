// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import { CronJobAdapter } from './cron-job-adapter';

describe('CronJobAdapter', () => {
  let adapter: CronJobAdapter;
  afterEach(async () => { await adapter?.destroy(); });

  it('schedules and triggers a cron job', async () => {
    adapter = new CronJobAdapter();
    let calls = 0;
    await adapter.schedule('daily', { type: 'cron', expression: '0 0 * * *' }, async () => { calls++; });
    expect(await adapter.listJobs()).toEqual(['daily']);

    await adapter.trigger('daily');
    expect(calls).toBe(1);
  });

  it('accepts per-job timezone', async () => {
    adapter = new CronJobAdapter({ timezone: 'UTC' });
    await adapter.schedule(
      'tz',
      { type: 'cron', expression: '0 9 * * *', timezone: 'America/New_York' },
      async () => {},
    );
    expect(await adapter.listJobs()).toEqual(['tz']);
  });

  it('throws on cron without expression', async () => {
    adapter = new CronJobAdapter();
    await expect(adapter.schedule('bad', { type: 'cron' } as any, async () => {})).rejects.toThrow(/missing expression/);
  });

  it('records executions', async () => {
    adapter = new CronJobAdapter();
    await adapter.schedule('tracked', { type: 'cron', expression: '* * * * *' }, async () => {});
    await adapter.trigger('tracked');
    const execs = await adapter.getExecutions('tracked');
    expect(execs).toHaveLength(1);
    expect(execs[0].status).toBe('success');
  });

  it('cancels a job', async () => {
    adapter = new CronJobAdapter();
    await adapter.schedule('temp', { type: 'cron', expression: '* * * * *' }, async () => {});
    await adapter.cancel('temp');
    expect(await adapter.listJobs()).toEqual([]);
  });

  it('supports interval schedule via setInterval', async () => {
    adapter = new CronJobAdapter();
    await adapter.schedule('iv', { type: 'interval', intervalMs: 60_000 }, async () => {});
    expect(await adapter.listJobs()).toEqual(['iv']);
  });

  it('handles failures in cron handlers', async () => {
    adapter = new CronJobAdapter();
    await adapter.schedule('fail', { type: 'cron', expression: '* * * * *' }, async () => {
      throw new Error('boom');
    });
    await adapter.trigger('fail');
    const execs = await adapter.getExecutions('fail');
    expect(execs[0].status).toBe('failed');
    expect(execs[0].error).toBe('boom');
  });
});

// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { HonoHttpServer } from './adapter';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * P1-3 regression: `close()` must DRAIN in-flight requests (let them finish)
 * rather than force-killing them, and must force-close only after the drain
 * window elapses so shutdown can't hang.
 */
describe('HonoHttpServer — graceful close drains in-flight requests (P1-3)', () => {
  it('lets an in-flight request complete instead of aborting it', async () => {
    const server = new HonoHttpServer(0, undefined, 5000); // generous drain window
    server.getRawApp().get('/slow', async (c) => {
      await sleep(200); // still running when close() is called
      return c.text('drained-ok');
    });
    await server.listen(0);
    const port = server.getPort();

    const reqP = fetch(`http://127.0.0.1:${port}/slow`);
    await sleep(50); // ensure the request is being handled
    const closeP = server.close();

    const res = await reqP;
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('drained-ok'); // completed, not reset
    await closeP;
  });

  it('force-closes after the drain window so shutdown cannot hang', async () => {
    const server = new HonoHttpServer(0, undefined, 100); // tiny drain window
    server.getRawApp().get('/hang', async (c) => {
      await sleep(5000); // far longer than the drain window
      return c.text('late');
    });
    await server.listen(0);
    const port = server.getPort();

    const reqP = fetch(`http://127.0.0.1:${port}/hang`).catch((e) => e); // will be aborted
    await sleep(50);

    const t0 = Date.now();
    await server.close();
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(2000); // didn't wait out the 5s request
    await reqP; // the aborted request settled — fine
  });
});

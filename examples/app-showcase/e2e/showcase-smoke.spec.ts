import { test, expect } from '@playwright/test';

/**
 * Showcase workspace smoke — sweeps every nav surface and asserts the health
 * invariants manual QA otherwise eyeballs (render crash / leaked dev placeholder
 * / collapsed chart). Runs against the console the backend serves at /_console
 * (baseURL set in playwright.config.ts). Non-blocking nightly + manual.
 */
const APP = process.env.SHOWCASE_APP || 'com.example.showcase';
const base = (seg: string) => `/_console/apps/${APP}/${seg}`;

const SURFACES: { name: string; path: string; chart?: boolean }[] = [
  { name: 'Capability Map', path: base('page/showcase_capability_map') },
  { name: 'My Work', path: base('page/showcase_my_work') },
  { name: 'Approvals', path: base('page/showcase_review_queue') },
  { name: 'New Project Wizard', path: base('page/showcase_new_project_wizard') },
  { name: 'Settings', path: base('showcase_preference') },
  { name: 'Projects', path: base('showcase_project') },
  { name: 'Tasks', path: base('showcase_task') },
  { name: 'Accounts', path: base('showcase_account') },
  { name: 'Invoices', path: base('showcase_invoice') },
  { name: 'Products', path: base('showcase_product') },
  { name: 'Teams', path: base('showcase_team') },
  { name: 'Categories', path: base('showcase_category') },
  { name: 'Field Zoo', path: base('showcase_field_zoo') },
  { name: 'Delivery Operations', path: base('dashboard/showcase_ops_dashboard'), chart: true },
  { name: 'Chart Gallery', path: base('dashboard/showcase_chart_gallery'), chart: true },
  { name: 'Hours by Status', path: base('report/showcase_hours_by_status') },
  { name: 'Status × Priority', path: base('report/showcase_status_priority_matrix') },
  { name: 'Task Overview', path: base('report/showcase_task_overview') },
  { name: 'Component Gallery', path: base('page/showcase_component_gallery') },
  { name: 'Project Workspace', path: base('page/showcase_project_workspace') },
  { name: 'Task Workbench', path: base('page/showcase_task_workbench') },
  { name: 'Task Triage', path: base('page/showcase_task_triage') },
  { name: 'Active Projects', path: base('page/showcase_active_projects') },
  { name: 'All Views', path: base('page/showcase_task_all_views') },
  { name: 'Task Board', path: base('page/showcase_task_board') },
  { name: 'Task Calendar', path: base('page/showcase_task_calendar') },
  { name: 'Task Gallery', path: base('page/showcase_task_gallery') },
  { name: 'Team Schedule', path: base('page/showcase_task_schedule') },
  { name: 'Activity Timeline', path: base('page/showcase_task_timeline') },
  { name: 'Work Map', path: base('page/showcase_task_map') },
];

for (const surface of SURFACES) {
  test(`surface renders cleanly: ${surface.name}`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await page.goto(surface.path, { waitUntil: 'domcontentloaded' });
    await page.locator('main').first().waitFor({ state: 'visible', timeout: 25_000 });
    await page.waitForTimeout(1500);

    expect(pageErrors, `uncaught errors on ${surface.name}`).toEqual([]);
    await expect(
      page.getByText(/no actions configured/i),
      `leaked placeholder on ${surface.name}`,
    ).toHaveCount(0);
    const mainText = (await page.locator('main').first().innerText().catch(() => '')) || '';
    expect(mainText.trim().length, `${surface.name} rendered no main content`).toBeGreaterThan(0);

    if (surface.chart) {
      const svg = page.locator('.recharts-wrapper svg, .recharts-surface').first();
      await svg.waitFor({ state: 'visible', timeout: 25_000 });
      const box = await svg.boundingBox();
      expect(box, `${surface.name}: no chart SVG`).not.toBeNull();
      expect(box!.width, `${surface.name}: chart width`).toBeGreaterThan(0);
      expect(box!.height, `${surface.name}: chart height`).toBeGreaterThan(0);
    }
  });
}

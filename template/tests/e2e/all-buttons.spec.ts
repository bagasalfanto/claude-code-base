/**
 * All-buttons smoke test: for every route in routes.json, clicks every visible button, link and
 * [role=button] (each on a fresh page load) and fails when a click causes:
 *   - an uncaught JavaScript error (pageerror)
 *   - a console.error
 *   - a server response with status >= 500
 *   - a same-origin link that returns >= 400
 *   - (when routes.json has "axe": true) serious/critical accessibility violations on page load
 *
 * Maintained by the button-tester agent: every new page/feature adds its routes to routes.json.
 * Mark an element that must never be clicked in tests with data-e2e-skip (e.g. "Delete account").
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

type Route = { path: string; storageState?: string; name?: string };
type Config = { routes: Route[]; skipText?: string[]; maxClicksPerPage?: number; ignoreConsole?: string[]; axe?: boolean };

const cfg: Config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "e2e", "routes.json"), "utf8"));
const SKIP_TEXT = new RegExp((cfg.skipText ?? []).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "$^", "i");
const IGNORE_CONSOLE = (cfg.ignoreConsole ?? []).map((s) => new RegExp(s, "i"));
const MAX = cfg.maxClicksPerPage ?? 40;
const CLICKABLE = 'button, [role="button"], a[href], input[type="submit"], input[type="button"]';

function watch(page: Page, baseOrigin: string) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error" || IGNORE_CONSOLE.some((re) => re.test(m.text()))) return;
    const src = m.location()?.url ?? "";
    if (/\/favicon\.ico(\?|$)/.test(src)) return; // browser-requested icon, not an app error
    problems.push(`console.error: ${m.text()}${src ? ` (${src})` : ""}`);
  });
  page.on("response", (r) => {
    if (/\/favicon\.ico(\?|$)/.test(r.url())) return;
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.request().method()} ${r.url()}`);
    else if (r.status() >= 400 && r.request().isNavigationRequest() && r.url().startsWith(baseOrigin)) problems.push(`HTTP ${r.status()} navigation ${r.url()}`);
  });
  return problems;
}

async function openPage(browser: Browser, route: Route, baseURL: string) {
  const context = await browser.newContext({ baseURL, storageState: route.storageState });
  const page = await context.newPage();
  const problems = watch(page, new URL(baseURL).origin);
  await page.goto(route.path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
  return { context, page, problems };
}

for (const route of cfg.routes) {
  test(`all buttons & links: ${route.name ?? route.path}`, async ({ browser, baseURL }) => {
    test.setTimeout(5 * 60_000);
    const base = baseURL ?? "http://localhost:3000";
    const failures: string[] = [];

    const first = await openPage(browser, route, base);
    failures.push(...first.problems.map((p) => `[load ${route.path}] ${p}`));
    if (cfg.axe) {
      // Optional accessibility check. Needs: npm i -D @axe-core/playwright
      const mod = "@axe-core/playwright";
      const { default: AxeBuilder } = await import(mod).catch(() => {
        throw new Error('routes.json has "axe": true but @axe-core/playwright is not installed (npm i -D @axe-core/playwright)');
      });
      const result = await new AxeBuilder({ page: first.page }).analyze();
      for (const v of result.violations.filter((x: { impact?: string | null }) => x.impact === "serious" || x.impact === "critical")) {
        failures.push(`[a11y ${route.path}] ${v.id} (${v.impact}): ${v.help} - ${v.nodes.length} element(s)`);
      }
    }
    const total = Math.min(await first.page.locator(CLICKABLE).count(), MAX);
    await first.context.close();

    for (let i = 0; i < total; i++) {
      const { context, page, problems } = await openPage(browser, route, base);
      try {
        const el = page.locator(CLICKABLE).nth(i);
        if (!(await el.isVisible().catch(() => false)) || (await el.isDisabled().catch(() => true))) continue;
        if ((await el.getAttribute("data-e2e-skip")) !== null) continue;
        const label = ((await el.innerText().catch(() => "")) || (await el.getAttribute("aria-label")) || (await el.getAttribute("value")) || "").trim().slice(0, 60);
        if (SKIP_TEXT.test(label)) continue;
        const href = await el.getAttribute("href");
        if (href && /^(https?:)?\/\//i.test(href) && !href.startsWith(new URL(base).origin)) continue; // external link
        if (href && /^(mailto:|tel:|javascript:)/i.test(href)) continue;

        problems.length = 0;
        await el.click({ timeout: 5_000 }).catch((e) => problems.push(`not clickable: ${String(e.message).split("\n")[0]}`));
        await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(300);
        for (const p of problems) failures.push(`[${route.path}] element #${i} "${label || "(no text)"}" -> ${p}`);
      } finally {
        await context.close();
      }
    }

    expect(failures, `Problems found:\n${failures.join("\n")}`).toEqual([]);
  });
}

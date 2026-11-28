// Drive the built site the way a reader does, in an instance this script starts and stops itself.
//   node .claude/skills/verify-longevity/drive.ts doctor
//   node .claude/skills/verify-longevity/drive.ts run <journey.json> [--keep-going]
//   node .claude/skills/verify-longevity/drive.ts cleanup
// `run` starts `wrangler dev` on a free port (the same asset rules as production: 307 to the trailing slash, the
// nearest 404.html for a missing page), starts headless Chrome with a throwaway profile, plays the journey's steps,
// writes evidence to .verify/<run>/, and stops both. Evidence stays after cleanup.
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
process.chdir(ROOT);
const CHROME = process.env.CHROME_EXE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EVIDENCE = '.verify';
const PIDS = join(EVIDENCE, 'pids.json');

// One journey is a list of steps. Each step does one thing and every step is logged with its result.
type Step =
  | { go: string; width?: 390 | 1440; scheme?: 'light' | 'dark'; acceptLanguage?: string; noScript?: boolean; expectStatus?: number }
  | { click: string; text?: string; nav?: boolean } // real mouse press and release at the centre of the first match (whose visible text is `text`, if given)
  | { type: string; text: string } // focus the field, select what is in it, and type over it
  | { choose: string; value: string } // pick an <select> option (see Gotchas in features/README.md)
  | { press: 'Escape' | 'Enter' | 'Tab' | 'ArrowDown' | 'ArrowUp' | 'Space' }
  | { waitFor: string; timeout?: number } // a JS expression that becomes truthy
  | { expect: string; label: string } // a JS expression that must be truthy now
  | { read: string; label: string } // record a JS expression's value
  | { shot: string; viewport?: boolean } // full-page PNG, or just the visible viewport (use it for menus and popovers)
  | { snapshot: string } // visible text of <main>, the URL and the page title
  | { fetch: string; label: string; expectStatus?: number }; // a plain HTTP request, no browser

type Journey = { name: string; steps: Step[] };

const freePort = () =>
  new Promise<number>((res, rej) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      s.close(() => (typeof a === 'object' && a ? res(a.port) : rej(new Error('no port'))));
    });
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async <T>(what: string, probe: () => Promise<T | undefined> | T | undefined, ms = 60000): Promise<T> => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const v = await probe();
    if (v !== undefined) return v;
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${what}`);
};

const readPids = (): { pid: number; what: string }[] => (existsSync(PIDS) ? JSON.parse(readFileSync(PIDS, 'utf8')) : []);
const writePids = (p: { pid: number; what: string }[]) => (mkdirSync(EVIDENCE, { recursive: true }), writeFileSync(PIDS, JSON.stringify(p)));
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
// Every child is spawned detached, so its pid is its process group; killing the group takes workerd and Chrome helpers.
const killGroup = (pid: number) => {
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {}
};

// Waits asynchronously so Node can reap its own children; a blocked event loop leaves them as zombies that look alive.
async function cleanup() {
  const pids = readPids();
  for (const { pid } of pids) killGroup(pid);
  const until = Date.now() + 8000;
  while (pids.some(({ pid }) => alive(pid)) && Date.now() < until) await sleep(200);
  for (const { pid } of pids) {
    if (!alive(pid)) continue;
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {}
  }
  await sleep(300);
  const left = pids.filter(({ pid }) => alive(pid));
  rmSync(PIDS, { force: true });
  for (const d of readdirSync(tmpdir()).filter((d) => d.startsWith('verify-longevity-'))) rmSync(join(tmpdir(), d), { recursive: true, force: true });
  console.log(pids.length ? `stopped ${pids.map((p) => `${p.what} ${p.pid}`).join(', ')}${left.length ? `; STILL RUNNING ${left.map((p) => p.pid)}` : ''}` : 'nothing of ours was running');
  if (left.length) process.exitCode = 1;
}

function newestMtime(dir: string): number {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) t = Math.max(t, statSync(join(e.parentPath, e.name)).mtimeMs);
  }
  return t;
}

function doctor(): boolean {
  const checks: [string, boolean, string][] = [];
  const dist = existsSync('dist/index.html');
  checks.push(['dist/ built', dist, dist ? 'dist/index.html exists' : 'run `npm run build`']);
  if (dist) {
    const built = statSync('dist/index.html').mtimeMs;
    const source = Math.max(...['src', 'content', 'data', 'scripts'].map(newestMtime));
    checks.push(['dist/ is current', built >= source, built >= source ? 'newer than src/, content/, data/, scripts/' : 'sources changed after the last build: run `npm run build`']);
    const commit = JSON.parse(readFileSync('data/upstream/SOURCE.json', 'utf8')).commit.slice(0, 7);
    const inDist = readFileSync('dist/zh/about/index.html', 'utf8').includes(commit);
    checks.push(['dist/ matches data/upstream', inDist, `upstream ${commit} ${inDist ? 'named' : 'NOT named'} on the about page`]);
  }
  checks.push(['Chrome', existsSync(CHROME), CHROME]);
  const ours = readPids().filter(({ pid }) => alive(pid));
  checks.push(['no leftover instance of ours', !ours.length, ours.length ? `running: ${ours.map((p) => `${p.what} ${p.pid}`).join(', ')}; run cleanup` : 'none']);
  let others = '';
  try {
    others = execFileSync('pgrep', ['-fl', 'wrangler|workerd'], { encoding: 'utf8' }).trim();
  } catch {}
  // npm exec, the bin shim and the CLI each match per server; the CLI process is one per server.
  const count = others ? others.split('\n').filter((l) => l.includes('wrangler-dist/cli.js dev')).length : 0;
  checks.push(['dev servers on this Mac < 3', count < 3, `${count} wrangler dev running (other sessions' are not ours to stop)`]);
  for (const [name, ok, detail] of checks) console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${detail}`);
  return checks.every(([, ok]) => ok);
}

async function run(file: string, keepGoing: boolean) {
  const journey = JSON.parse(readFileSync(file, 'utf8')) as Journey;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = join(EVIDENCE, `${stamp}-${journey.name}`);
  mkdirSync(out, { recursive: true });
  const log = (entry: object) => appendFileSync(join(out, 'log.jsonl'), `${JSON.stringify(entry)}\n`);

  const children: ChildProcess[] = [];
  const start = (what: string, cmd: string, args: string[]) => {
    const child = spawn(cmd, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    writePids([...readPids(), { pid: child.pid!, what }]);
    return child;
  };

  let serverLog = '';
  try {
    const port = await freePort();
    const t0 = Date.now();
    const server = start('wrangler dev', 'npx', ['wrangler@4', 'dev', '--ip', '127.0.0.1', '--port', String(port), '--log-level', 'info']);
    server.stdout!.on('data', (d) => (serverLog += d));
    server.stderr!.on('data', (d) => (serverLog += d));
    const base = `http://127.0.0.1:${port}`;
    // "Ready on" is printed before assets answer, so ready means the home page returns 200.
    await waitFor('wrangler dev to serve /', async () => {
      if (server.exitCode !== null) throw new Error(`wrangler dev exited:\n${serverLog}`);
      if (!serverLog.includes('Ready on')) return undefined;
      return (await fetch(`${base}/zh/`).catch(() => null))?.status === 200 ? true : undefined;
    }, 120000);
    console.log(`wrangler dev pid ${server.pid} ready on ${base} in ${Date.now() - t0} ms`);

    const profile = mkdtempSync(join(tmpdir(), 'verify-longevity-'));
    const chrome = start('chrome', CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank']);
    const devtools = await waitFor('Chrome DevTools port', () => {
      const f = join(profile, 'DevToolsActivePort');
      return existsSync(f) ? readFileSync(f, 'utf8').split('\n')[0] || undefined : undefined;
    });
    console.log(`headless Chrome pid ${chrome.pid}`);
    const target = (await (await fetch(`http://127.0.0.1:${devtools}/json/new?about:blank`, { method: 'PUT' })).json()) as { webSocketDebuggerUrl: string };
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((r, j) => ((ws.onopen = r), (ws.onerror = j)));
    let id = 0;
    const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
    const events: { method: string; params: any }[] = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id !== undefined) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        m.error ? p?.rej(new Error(m.error.message)) : p?.res(m.result);
      } else events.push(m);
    };
    const send = (method: string, params: object = {}): Promise<any> =>
      new Promise((res, rej) => {
        const n = ++id;
        const timer = setTimeout(() => rej(new Error(`${method} timed out`)), 30000);
        pending.set(n, { res: (v) => (clearTimeout(timer), res(v)), rej: (e) => (clearTimeout(timer), rej(e)) });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    const evaluate = async (expression: string) => {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(`${expression}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
      return r.result.value;
    };
    const loaded = async (since: number) => {
      await waitFor('page load', () => (events.slice(since).some((e) => e.method === 'Page.loadEventFired') ? true : undefined), 30000);
      await evaluate('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 250)))').catch(() => {});
    };
    const centre = async (selector: string, text?: string) => {
      const box = await evaluate(`(() => {
        const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => ${text === undefined ? 'true' : `e.innerText.trim() === ${JSON.stringify(text)}`});
        if (!el) return 'missing';
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        // A wrapped inline link's bounding box can be centred on a neighbour, so aim at its first line box.
        const r = el.getClientRects()[0] ?? el.getBoundingClientRect();
        return r.width && r.height ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : 'hidden';
      })()`);
      if (box === 'missing') throw new Error(`no element matches ${selector}${text === undefined ? '' : ` with text "${text}"`}`);
      if (box === 'hidden') throw new Error(`${selector} is not visible`);
      return box as { x: number; y: number };
    };
    const KEYS: Record<string, [string, number]> = { Escape: ['Escape', 27], Enter: ['Enter', 13], Tab: ['Tab', 9], ArrowDown: ['ArrowDown', 40], ArrowUp: ['ArrowUp', 38], Space: ['Space', 32] };

    await send('Page.enable');
    await send('Network.enable');
    const { userAgent } = await send('Browser.getVersion');
    let failures = 0;

    for (const [i, step] of journey.steps.entries()) {
      const n = String(i + 1).padStart(2, '0');
      const entry: Record<string, unknown> = { n, step };
      try {
        if ('go' in step) {
          const mobile = (step.width ?? 390) < 600;
          await send('Emulation.setDeviceMetricsOverride', { width: step.width ?? 390, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile });
          await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
          await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: step.scheme ?? 'light' }] });
          await send('Emulation.setScriptExecutionDisabled', { value: step.noScript === true });
          await send('Emulation.setUserAgentOverride', { userAgent, acceptLanguage: step.acceptLanguage ?? 'zh-CN,zh;q=0.9' });
          const since = events.length;
          await send('Page.navigate', { url: base + step.go });
          await loaded(since);
          const doc = events.slice(since).find((e) => e.method === 'Network.responseReceived' && e.params.type === 'Document');
          entry.status = doc?.params.response.status;
          if (step.expectStatus !== undefined && entry.status !== step.expectStatus) throw new Error(`status ${entry.status}, expected ${step.expectStatus}`);
        } else if ('click' in step) {
          const { x, y } = await centre(step.click, step.text);
          const since = events.length;
          for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
          if (step.nav) await loaded(since);
          else await sleep(300);
        } else if ('type' in step) {
          await evaluate(`(() => { const f = document.querySelector(${JSON.stringify(step.type)}); f.focus(); f.select(); })()`);
          await send('Input.insertText', { text: step.text });
          await sleep(200);
        } else if ('choose' in step) {
          const ok = await evaluate(
            `(() => { const s = document.querySelector(${JSON.stringify(step.choose)}); if (![...s.options].some((o) => o.value === ${JSON.stringify(step.value)})) return false; s.focus(); s.value = ${JSON.stringify(step.value)}; s.dispatchEvent(new Event('input', {bubbles: true})); s.dispatchEvent(new Event('change', {bubbles: true})); return true })()`,
          );
          if (!ok) throw new Error(`${step.choose} has no option ${step.value}`);
          await sleep(200);
        } else if ('press' in step) {
          const [key, code] = KEYS[step.press]!;
          for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: key === 'Space' ? ' ' : key, code: key, windowsVirtualKeyCode: code });
          await sleep(200);
        } else if ('waitFor' in step) {
          await waitFor(step.waitFor, async () => ((await evaluate(step.waitFor)) ? true : undefined), step.timeout ?? 5000);
        } else if ('expect' in step) {
          const v = await evaluate(step.expect);
          entry.value = v;
          if (!v) throw new Error(`expected ${step.label}`);
        } else if ('read' in step) {
          entry.value = await evaluate(step.read);
        } else if ('shot' in step) {
          const m = await send('Page.getLayoutMetrics');
          const png = step.viewport
            ? await send('Page.captureScreenshot', { format: 'png' })
            : await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: Math.ceil(m.cssContentSize.height), scale: 1 } });
          const path = join(out, `${n}-${step.shot}.png`);
          writeFileSync(path, Buffer.from(png.data, 'base64'));
          entry.file = path;
          entry.overflowX = Math.ceil(m.cssContentSize.width - m.cssLayoutViewport.clientWidth);
        } else if ('snapshot' in step) {
          const s = await evaluate(`({url: location.pathname + location.search, title: document.title, lang: document.documentElement.lang, dir: document.documentElement.dir, theme: document.documentElement.dataset.theme ?? null, text: (document.querySelector('main') ?? document.body).innerText})`);
          const path = join(out, `${n}-${step.snapshot}.txt`);
          writeFileSync(path, `url: ${s.url}\ntitle: ${s.title}\nlang: ${s.lang}  dir: ${s.dir || 'ltr'}  theme: ${s.theme}\n\n${s.text}\n`);
          entry.file = path;
        } else if ('fetch' in step) {
          const r = await fetch(base + step.fetch, { redirect: 'manual' });
          entry.status = r.status;
          entry.location = r.headers.get('location');
          entry.contentType = r.headers.get('content-type');
          entry.body = (await r.text()).slice(0, 400);
          if (step.expectStatus !== undefined && r.status !== step.expectStatus) throw new Error(`status ${r.status}, expected ${step.expectStatus}`);
        }
        const url = await evaluate('location.pathname + location.search').catch(() => null);
        entry.at = url;
        entry.ok = true;
        console.log(`${n} ok   ${describe(step)}${entry.value !== undefined ? ` → ${JSON.stringify(entry.value).slice(0, 120)}` : ''}${entry.status ? ` [${entry.status}]` : ''}`);
      } catch (e) {
        failures++;
        entry.ok = false;
        entry.error = (e as Error).message;
        console.log(`${n} FAIL ${describe(step)}: ${entry.error}`);
        const png = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
        if (png) writeFileSync(join(out, `${n}-failure.png`), Buffer.from(png.data, 'base64'));
        log(entry);
        if (!keepGoing) break;
        continue;
      }
      log(entry);
    }
    ws.close();
    const summary = `${journey.name}: ${failures ? `${failures} step(s) failed` : `all ${journey.steps.length} steps passed`}`;
    writeFileSync(join(out, 'summary.txt'), `${summary}\njourney: ${file}\nbuild: dist/index.html ${statSync('dist/index.html').mtime.toISOString()}\n`);
    console.log(`${summary}\nevidence: ${out}/`);
    if (failures) process.exitCode = 1;
  } catch (e) {
    // A launch or protocol failure is evidence too: keep the reason and the server's own log.
    const summary = `${journey.name}: did not run to the end: ${(e as Error).message.split('\n')[0]}`;
    writeFileSync(join(out, 'summary.txt'), `${summary}\njourney: ${file}\n`);
    writeFileSync(join(out, 'server.log'), serverLog);
    console.log(`${summary}\nevidence: ${out}/`);
    process.exitCode = 1;
  } finally {
    await cleanup();
  }
}

function describe(s: Step): string {
  const [k, v] = Object.entries(s)[0]!;
  return 'label' in s ? `${k} ${s.label}` : `${k} ${typeof v === 'string' ? v : JSON.stringify(v)}`;
}

const [cmd, arg] = process.argv.slice(2);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(sig, () => void cleanup().then(() => process.exit(130)));
if (cmd === 'doctor') process.exitCode = doctor() ? 0 : 1;
else if (cmd === 'cleanup') await cleanup();
else if (cmd === 'run' && arg) {
  if (!doctor()) {
    console.error('doctor failed; fix the FAIL lines before driving');
    process.exit(1);
  }
  await run(arg, process.argv.includes('--keep-going'));
} else {
  console.error(`Usage: node ${basename(import.meta.filename)} doctor | run <journey.json> [--keep-going] | cleanup`);
  process.exit(1);
}

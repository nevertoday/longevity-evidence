// Screenshot dist/ in headless Chrome at phone and desktop widths, light and dark.
// Starts one `python3 -m http.server` and one headless Chrome, and stops both before it exits.
// Usage: npm run build && npm run screenshots [-- name-filter]   (CHROME_EXE overrides the Chrome path)
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const CHROME = process.env.CHROME_EXE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = '.screenshots';
const TILE_HEIGHT = 1800;

// `action` runs in the page before the capture, for example to open a popover.
type Shot = { name: string; path: string; width: 390 | 1440; scheme: 'light' | 'dark'; action?: string };
const both = (name: string, path: string, schemes: Shot['scheme'][] = ['light']): Shot[] =>
  ([390, 1440] as const).flatMap((width) => schemes.map((scheme) => ({ name: `${name}-${width}-${scheme}`, path, width, scheme })));

const SHOTS: Shot[] = [
  ...both('zh-home', 'zh/', ['light', 'dark']),
  ...both('en-home', 'en/', ['light', 'dark']),
  ...both('zh-study-alcohol', 'zh/studies/alcohol/'),
  ...both('en-study-spermidine', 'en/studies/spermidine-diet/'),
  ...both('zh-myths', 'zh/myths/'),
  ...both('en-myths', 'en/myths/'),
  ...both('zh-studies-filtered', 'zh/studies/?topic=drinking&grade=B'),
  ...both('en-studies-filtered', 'en/studies/?q=coffee'),
  ...both('en-topic-eating', 'en/topics/eating/'),
  ...both('zh-about', 'zh/about/'),
  ...both('zh-appearance-open', 'zh/').map((s) => ({ ...s, action: "document.querySelector('.xxd-appearance-btn').click()" })),
  // Picking dark in the popover must survive navigation while the system stays light. Keep these last.
  {
    name: 'zh-appearance-pick-dark-390-light',
    path: 'zh/',
    width: 390,
    scheme: 'light',
    action:
      "document.querySelector('.xxd-appearance-btn').click(), [...document.querySelectorAll('#appearance-pop button')].find((b) => b.textContent.trim() === '暗').click()",
  },
  { name: 'en-after-pick-dark-390-light', path: 'en/about/', width: 390, scheme: 'light' },
];

const children: ChildProcess[] = [];
const stopAll = () => {
  for (const child of children) {
    if (child.exitCode === null && child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
    }
  }
};
process.on('exit', stopAll);
process.on('SIGINT', () => process.exit(130));

const start = (cmd: string, args: string[]) => {
  const child = spawn(cmd, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return child;
};

const waitFor = async <T>(what: string, probe: () => T | undefined, ms = 15000): Promise<T> => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = probe();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${what}`);
};

async function main() {
  if (!existsSync('dist/index.html')) throw new Error('dist/ is missing. Run `npm run build` first.');
  mkdirSync(join(OUT, 'tiles'), { recursive: true });

  const server = start('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', 'dist']);
  let serverLog = '';
  server.stdout?.on('data', (d) => (serverLog += d));
  const port = await waitFor('http.server', () => /port (\d+)/.exec(serverLog)?.[1]);
  console.log(`http.server pid ${server.pid} on port ${port}`);

  const profile = mkdtempSync(join(tmpdir(), 'healthy-shots-'));
  const chrome = start(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    'about:blank',
  ]);
  const devtoolsPort = await waitFor('Chrome DevTools port', () => {
    const file = join(profile, 'DevToolsActivePort');
    return existsSync(file) ? readFileSync(file, 'utf8').split('\n')[0] || undefined : undefined;
  });
  console.log(`headless Chrome pid ${chrome.pid}, profile ${profile}`);

  const target = (await (await fetch(`http://127.0.0.1:${devtoolsPort}/json/new?about:blank`, { method: 'PUT' })).json()) as {
    webSocketDebuggerUrl: string;
  };
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let nextId = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  const waiters: { method: string; resolve: () => void }[] = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id !== undefined) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(`${msg.error.message}`));
      else p?.resolve(msg.result);
    } else {
      for (const w of waiters.filter((w) => w.method === msg.method)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve();
      }
    }
  };
  const send = (method: string, params: object = {}): Promise<any> =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const next = (method: string) => new Promise<void>((resolve) => waiters.push({ method, resolve }));
  const evaluate = async (expression: string) =>
    (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;

  await send('Page.enable');
  const only = process.argv[2];
  for (const shot of SHOTS.filter((s) => !only || s.name.includes(only))) {
    const mobile = shot.width < 600;
    const viewport = { width: shot.width, height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile };
    await send('Emulation.setDeviceMetricsOverride', viewport);
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: shot.scheme }] });
    const loaded = next('Page.loadEventFired');
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/${shot.path}` });
    await loaded;
    await evaluate('document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300)))');
    if (shot.action) await evaluate(`(${shot.action}, new Promise((r) => setTimeout(r, 400)))`);
    const height: number = await evaluate('document.documentElement.scrollHeight');
    const overflow: number = await evaluate('document.documentElement.scrollWidth - window.innerWidth');
    const theme: string = await evaluate(
      'document.documentElement.dataset.theme + " (system dark: " + matchMedia("(prefers-color-scheme: dark)").matches + ")"',
    );

    const capture = async (y: number, h: number) =>
      Buffer.from(
        (await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: shot.width, height: h, scale: 1 } })).data,
        'base64',
      );
    writeFileSync(join(OUT, `${shot.name}.png`), await capture(0, height));
    const tiles = Math.ceil(height / TILE_HEIGHT);
    for (let i = 0; i < tiles; i++) {
      writeFileSync(join(OUT, 'tiles', `${shot.name}-${i + 1}.png`), await capture(i * TILE_HEIGHT, Math.min(TILE_HEIGHT, height - i * TILE_HEIGHT)));
    }
    console.log(`${shot.name}.png  ${shot.width}x${height}  theme=${theme}  horizontal overflow ${overflow}px  ${tiles} tiles`);
  }
  ws.close();
  stopAll();
  await waitFor('processes to exit', () => (children.every((c) => c.exitCode !== null || c.signalCode !== null) ? true : undefined));
  rmSync(profile, { recursive: true, force: true });
  console.log('stopped http.server and Chrome');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

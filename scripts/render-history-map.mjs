// Render tools/history-map.html to vector PDF (+ SVG, + optional PNG preview).
// Usage: node scripts/render-history-map.mjs [outDir] [--size 60x20,72x24] [--cats biblical,scrolls,church,secular] [--no-prophecy] [--preview]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(new URL('..', import.meta.url).pathname);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : join(root, 'print'));
const sizes = arg('--size', '60x20,72x24').split(',').map(z => z.split('x').map(Number));
const cats = arg('--cats', 'biblical,scrolls,church,secular');
const prophecy = !process.argv.includes('--no-prophecy');
const preview = process.argv.includes('--preview');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = createServer(async (req, res) => {
  try { const p = join(root, decodeURIComponent(req.url.split('?')[0])); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
await mkdir(out, { recursive: true });
const b = await chromium.launch();
for (const [w, h] of sizes) {
  const pg = await b.newPage({ viewport: { width: w * 96, height: h * 96 } });
  pg.on('pageerror', e => console.error('page error:', e.message));
  await pg.goto(`http://localhost:${srv.address().port}/tools/history-map.html?w=${w}&h=${h}&cats=${cats}&prophecy=${prophecy ? 1 : 0}`);
  await pg.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
  console.log(w + 'x' + h, await pg.evaluate(() => window.__map));
  const name = `history-map-${w}x${h}`;
  await pg.pdf({ path: join(out, name + '.pdf'), width: w + 'in', height: h + 'in', printBackground: true, pageRanges: '1' });
  await writeFile(join(out, name + '.svg'), await pg.evaluate(() => document.querySelector('#out svg').outerHTML));
  if (preview) await pg.screenshot({ path: join(out, name + '-preview.png'), clip: { x: 0, y: 0, width: w * 96, height: h * 96 } });
  await pg.close();
}
await b.close(); srv.close();

// Render tools/prophecy-poster.html to a 48 × 12 in vector PDF (and SVG + PNG preview).
// Usage: node scripts/render-prophecy-poster.mjs [outDir] [--no-others] [--size 48x12,72x24] [--preview]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = resolve(new URL('..', import.meta.url).pathname);
const out = resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : join(root, 'print'));
const others = !process.argv.includes('--no-others');
const si = process.argv.indexOf('--size');
const sizes = (si > 0 ? process.argv[si + 1] : '48x12').split(',').map(z => z.split('x').map(Number));
const preview = process.argv.includes('--preview');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.css': 'text/css' };
const srv = createServer(async (req, res) => {
  try { const p = join(root, decodeURIComponent(req.url.split('?')[0])); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p)); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = srv.address().port;
await mkdir(out, { recursive: true });
const b = await chromium.launch();
for (const [w, h] of sizes) {
  const pg = await b.newPage({ viewport: { width: w * 96, height: h * 96 } });
  pg.on('pageerror', e => console.error('page error:', e.message));
  await pg.goto(`http://localhost:${port}/tools/prophecy-poster.html?others=${others ? 1 : 0}&w=${w}&h=${h}`);
  await pg.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  console.log(await pg.evaluate(() => window.__poster));
  const name = `prophecy-map-${w}x${h}`;
  await pg.pdf({ path: join(out, name + '.pdf'), width: w + 'in', height: h + 'in', printBackground: true, pageRanges: '1' });
  const svg = await pg.evaluate(() => document.getElementById('poster').outerHTML);
  await writeFile(join(out, name + '.svg'), svg.replace(/<svg ([^>]*?)style="[^"]*"/, `<svg width="${w}in" height="${h}in" $1`));
  if (preview) await pg.screenshot({ path: join(out, name + '-preview.png'), clip: { x: 0, y: 0, width: w * 96, height: h * 96 } });
  await pg.close();
  console.log('wrote', join(out, name + '.pdf'));
}
await b.close(); srv.close();

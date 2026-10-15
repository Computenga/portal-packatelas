// Mi ruta (repartidor) y Rutas y reporte (patrón) en modo demo. Uso: node test/ui-rutas.test.js <carpeta>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'shots';
fs.mkdirSync(OUT, { recursive: true });
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(f);
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/json' }[ext] || 'text/plain' });
  fs.createReadStream(f).pipe(r);
}).listen(8766);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/tile|favicon|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  let n = 0;
  const shot = async (name, full = true) => { await p.waitForTimeout(900); await p.screenshot({ path: `${OUT}/r${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
  const click = async (sel) => { await p.locator(sel).first().click(); await p.waitForTimeout(400); };
  const pin = async (digits) => { for (const d of digits) await p.locator(`.key:text-is("${d}")`).click(); await p.waitForTimeout(700); };

  await p.goto('http://localhost:8766/?demo');
  await p.fill('input.input', 'LOAS950505H12'); await click('text=Continuar'); await pin('482915');
  await p.waitForSelector('.ruta-card');
  await shot('emp-inicio-ruta', false);
  await click('.ruta-card');
  await p.waitForSelector('.ruta-map .map-pin', { timeout: 15000 });
  await shot('emp-mi-ruta');
  await click('.parada >> nth=2'); await shot('emp-mi-ruta-enfoque', false);
  // patrón
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto('http://localhost:8766/?demo');
  await p.fill('input.input', 'GUPC900101AB1'); await click('text=Continuar'); await pin('482915');
  await click('.tabbar button:has-text("Más")');
  await click('.mi:has-text("Rutas y reporte")');
  await p.waitForSelector('details.card');
  await shot('pat-rutas-vivo');
  await click('.ruta-live >> nth=1'); await p.waitForSelector('.kpis'); await shot('pat-ruta-detalle');
  await click('.icon-btn[aria-label="Regresar"]'); await click('.icon-btn[aria-label="Regresar"]');
  await click('.mi:has-text("Repartidores en Shipday")'); await p.waitForSelector('select.input'); await shot('pat-shipday-vincular');
  console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'Sin errores de consola');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

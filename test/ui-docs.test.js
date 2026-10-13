// Recorre alta + documentos + vista no repartidor. Uso: node test/ui-docs.test.js <carpeta>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'shots';
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(8767);
const IMG = path.join(root, 'icons/icon-192.png');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let n = 0;
  const shot = async (name, full = true) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/d${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
  const click = async sel => { await p.locator(sel).first().click(); await p.waitForTimeout(350); };
  const pin = async d => { for (const x of d) await p.locator(`.key:text-is("${x}")`).click(); await p.waitForTimeout(700); };
  const upload = async rowText => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator(`.doc-row:has-text("${rowText}") .btn`).first().click()]);
    await fc.setFiles(IMG); await p.waitForTimeout(900);
  };
  await p.goto('http://localhost:8767/?demo');
  await shot('login');
  await click('.soy-nuevo'); await shot('alta-form');
  const inputs = p.locator('.login .card input');
  await inputs.nth(0).fill('María López Torres'); await inputs.nth(1).fill('LOTM980202MX3'); await inputs.nth(2).fill('5511223344');
  await click('button:has-text("Otro puesto")'); await click('.login .card .btn.primary:has-text("Continuar")');
  await shot('alta-docs');
  await upload('INE (frente)'); await upload('CURP');
  await shot('alta-docs-subiendo');
  await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8767/?demo');
  await p.fill('input.input', 'GUPC900101AB1'); await click('text=Continuar'); await pin('482915');
  await shot('patron-panel');
  await click('.banner:has-text("alta")'); await shot('patron-altas');
  await click('.alta-card:has-text("Juan") .btn.primary'); await p.locator('.modal input.big').fill('120'); await shot('patron-aprobar', false);
  await click('.modal .btn.primary'); await shot('patron-altas-despues');
  await click('.topbar .icon-btn'); await click('.card.person:has-text("Saidd")'); await shot('patron-expediente-docs');
  await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8767/?demo');
  await p.fill('input.input', 'LOAS950505H12'); await click('text=Continuar'); await pin('482915');
  await click('.welcome'); await shot('rep-bienvenida');
  await click('button:has-text("Subir mis documentos")'); await shot('rep-mis-docs');
  await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8767/?demo');
  await p.fill('input.input', 'RUCA990909MX1'); await click('text=Continuar');
  await p.locator('.login input').fill('5'); await click('text=Continuar'); await pin('852147'); await pin('852147');
  await shot('oficina-inicio');
  await click('.tabbar button:has-text("Más")'); await shot('oficina-mas');
  await click('.mi:has-text("Mi bienvenida")'); await shot('oficina-bienvenida');
  console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'Sin errores de consola');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

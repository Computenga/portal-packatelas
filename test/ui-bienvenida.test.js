// Recorre bienvenida/apps/accesos en modo demo. Uso: node test/ui-bienvenida.test.js <carpeta>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'shots';
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(8766);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let n = 0;
  const shot = async (name, full = true) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/b${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
  const click = async sel => { await p.locator(sel).first().click(); await p.waitForTimeout(350); };
  const pin = async d => { for (const x of d) await p.locator(`.key:text-is("${x}")`).click(); await p.waitForTimeout(700); };
  await p.goto('http://localhost:8766/?demo');
  await p.fill('input.input', 'XAXX010101000'); await click('text=Continuar'); await shot('login-nuevo');
  await click('text=Ya tengo acceso'); await p.fill('input.input', 'SAMI000312HD5'); await click('text=Continuar'); await pin('1');
  // Michell PIN es '1' en el mock -> no 6 dígitos; usamos Saidd
  await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8766/?demo');
  await p.fill('input.input', 'LOAS950505H12'); await click('text=Continuar'); await pin('482915');
  await shot('inicio');
  await click('.welcome'); await shot('bienvenida');
  await click('text=Ver apps'); await shot('apps-instalar');
  await click('.app-row:has-text("Packatelas") .btn.primary'); await shot('apk-instrucciones', false); await click('.modal .btn:has-text("Cancelar")');
  await click('.app-row:has-text("My Driver") .chk'); await click('.app-row:has-text("Envíos Flex") .chk'); await click('.app-row:has-text("Packatelas") .chk');
  await click('.seg button:has-text("Accesos")'); await shot('apps-accesos');
  await click('.topbar .icon-btn'); await shot('bienvenida-avance');
  await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8766/?demo');
  await p.fill('input.input', 'GUPC900101AB1'); await click('text=Continuar'); await pin('482915');
  await shot('patron-panel');
  await click('.tabbar button:has-text("Personal")'); await click('.chip:has-text("Bienvenida")'); await shot('patron-personal-bienvenida');
  await click('.card.person'); await shot('patron-expediente');
  await click('.tabbar button:has-text("Más")'); await click('.mi:has-text("Apps y accesos")'); await shot('patron-apps');
  await click('.app-row'); await shot('patron-editar-app', false);
  console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'Sin errores de consola');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

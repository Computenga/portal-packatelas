// Recorre la app en modo demo con Chromium y toma capturas. Uso: node test/ui.test.js <carpeta>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'shots';
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  const ext = path.extname(f);
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/json' }[ext] || 'text/plain' });
  fs.createReadStream(f).pipe(r);
}).listen(8765);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  let n = 0;
  const shot = async (name, full = true) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
  const click = async (sel) => { await p.locator(sel).first().click(); await p.waitForTimeout(350); };
  const tab = async (label) => click(`.tabbar button:has-text("${label}")`);
  const pin = async (digits) => { for (const d of digits) await p.locator(`.key:text-is("${d}")`).click(); await p.waitForTimeout(700); };

  await p.goto('http://localhost:8765/?demo');
  await p.fill('input.input', 'LOAS950505H12'); await shot('login');
  await click('text=Continuar'); await pin('482915');
  await shot('emp-inicio');
  await tab('Asistencia'); await shot('emp-asistencia');
  await tab('Nómina'); await shot('emp-recibos');
  await click('.card.rec'); await shot('emp-recibo');
  await tab('Nómina'); await click('.seg button:has-text("Depósitos")'); await shot('emp-depositos');
  await tab('Solicitudes'); await shot('emp-solicitudes');
  await click('.q:has-text("Justificar")'); await shot('emp-nueva-solicitud');
  await p.fill('textarea', 'Cita en el IMSS'); await click('text=Enviar solicitud'); await shot('emp-solicitud-enviada');
  await tab('Más'); await shot('emp-mas');
  await click('.mi:has-text("Adeudos")'); await shot('emp-adeudos');
  await click('.bell'); await shot('emp-bandeja');
  // patrón
  await p.evaluate(() => { localStorage.clear(); });
  await p.goto('http://localhost:8765/?demo');
  await p.fill('input.input', 'GUPC900101AB1'); await click('text=Continuar'); await pin('482915');
  await shot('pat-panel');
  await tab('Asistencia'); await shot('pat-asistencia');
  await click('tr.tap'); await shot('pat-asistencia-detalle');
  await tab('Nómina'); await shot('pat-prenomina');
  await click('.card.pre details summary'); await p.locator('.card.pre .pgrid input').nth(1).fill('500'); await shot('pat-prenomina-edit');
  await click('.sticky-total button'); await shot('pat-emitir-confirm', false);
  await click('.modal .btn.primary'); await p.waitForTimeout(600); await shot('pat-recibos');
  await click('.seg button:has-text("Pagos")'); await shot('pat-pagos');
  await tab('Personal'); await shot('pat-personal');
  await click('.card.person'); await shot('pat-expediente');
  await tab('Más'); await click('.mi:has-text("Solicitudes")'); await shot('pat-solicitudes');
  await click('.sol .btn.primary'); await shot('pat-aprobar', false); await click('.modal .btn.primary');
  await tab('Más'); await click('.mi:has-text("Avisos")'); await shot('pat-avisos');
  await tab('Más'); await click('.switch'); await shot('pat-modo-empleado');
  // escritorio + oscuro
  await p.setViewportSize({ width: 1100, height: 900 }); await p.emulateMedia({ colorScheme: 'dark' });
  await tab('Más'); await click('.switch'); await shot('pat-panel-dark-desktop');
  console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'Sin errores de consola');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

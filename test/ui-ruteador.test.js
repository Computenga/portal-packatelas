// Ruteador con API del portal, OSRM y TomTom simulados. Uso: node test/ui-ruteador.test.js <carpeta> <excel>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'shots', XLSX_FILE = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'text/plain' });
  fs.createReadStream(f).pipe(r);
}).listen(8767);
const hav = (a, b) => { const R = 6371000, t = Math.PI / 180; const x = Math.sin((b[1] - a[1]) * t / 2) ** 2 + Math.cos(a[1] * t) * Math.cos(b[1] * t) * Math.sin((b[0] - a[0]) * t / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const p = await ctx.newPage();
  const errors = [], calls = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => { calls.push('dialog: ' + d.message()); d.accept(); });
  // OSRM simulado (línea recta × 1.4 a 25 km/h)
  await p.route('**/router.project-osrm.org/**', route => {
    const u = new URL(route.request().url());
    const coords = u.pathname.split('/driving/')[1].split(';').map(c => c.split(',').map(Number));
    const src = u.searchParams.get('sources').split(';').map(Number), dst = u.searchParams.get('destinations').split(';').map(Number);
    const dist = src.map(i => dst.map(j => hav(coords[i], coords[j]) * 1.4));
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 'Ok', distances: dist, durations: dist.map(r => r.map(d => d / (25 / 3.6))) }) });
  });
  // altitud simulada: al norte (lat > 19.55) son cerros
  await p.route('**/api.open-meteo.com/**', route => { const u = new URL(route.request().url()); const la = u.searchParams.get('latitude').split(',').map(Number);
    route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ elevation: la.map(x => x > 19.55 ? 2450 : 2240) }) }); });
  // API del portal simulada
  await p.route('**/script.google.com/**', async route => {
    const req = JSON.parse(route.request().postData());
    calls.push(req.action);
    let data;
    if (req.action === 'rutasConfig') data = { tomtom: true, shipday: false, empleados: [
      { no_empleado: '4', nombre: 'Saidd Argenis López', telefono: '5511112222', repartidor: true },
      { no_empleado: '92', nombre: 'Jonatan Ortega', telefono: '5533334444', repartidor: true },
      { no_empleado: '75', nombre: 'Michell Saucedo', telefono: '', repartidor: true },
      { no_empleado: '5', nombre: 'Casandra Ruiz', telefono: '', repartidor: false }] };
    else if (req.action === 'tomtomRutas') data = { rutas: req.rutas.map(r => ({ legs: r.locs.slice(1).map((pt, i) => { const d = hav([r.locs[i][1], r.locs[i][0]], [pt[1], pt[0]]) * 1.35; return { sec: d / (22 / 3.6), m: d, pts: [r.locs[i], pt] }; }) })) };
    else if (req.action === 'alcanceMotoChica') data = { consultas: req.puntos.length * 2, puntos: req.puntos.map(pt => pt[1] < -99.22 ? { ok: false, motivo: 'solo_por_autopista', min_normal: 30, min_sin: 60 } : { ok: true }) };
    else if (req.action === 'publicarRutas') { fs.writeFileSync(OUT + '/publicar.json', JSON.stringify(req, null, 1)); data = { publicadas: req.rutas.length, con_push: req.rutas.length }; }
    else return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'acción no simulada ' + req.action }) });
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data }) });
  });
  await p.goto('http://localhost:8767/ruteador.html');
  await p.evaluate(() => { localStorage.setItem('pp_token', 'tok'); localStorage.setItem('pp_user', JSON.stringify({ no_empleado: '1', nombre: 'Cristhian Guevara', rol: 'admin' })); localStorage.setItem('rutasPK.f.quality', '"1500"'); });
  await p.reload();
  await p.waitForFunction(() => /configurado/.test(document.getElementById('keysState').textContent));
  await p.setInputFiles('#file', XLSX_FILE);
  await p.waitForTimeout(800);
  await p.fill('#drivers', '4'); await p.dispatchEvent('#drivers', 'change');
  await p.fill('#small', '2'); await p.dispatchEvent('#small', 'change');
  await p.fill('#tStart', '15:00'); await p.fill('#tEnd', '21:00');
  await p.click('#run');
  await p.waitForSelector('select[data-emp]', { timeout: 120000 });
  const sels = await p.locator('select[data-emp]').count();
  const emps = ['4', '92', '75', '5'];
  for (let i = 0; i < sels; i++) await p.locator('select[data-emp]').nth(i).selectOption(emps[i % emps.length]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT + '/t01-ruteador.png', fullPage: false });
  const info = await p.evaluate(() => { const R = window.__ruteador; const sc = R.currentSched(); const bad = new Set(R.S.result.restrList.map(x => x.st));
    return { chicas: sc.filter(r => r.chica).length, restr: bad.size, viol: sc.filter(r => r.chica).reduce((a, r) => a + r.stops.filter(o => bad.has(o.st)).length, 0), rutas: sc.length }; });
  console.log('motos chicas:', JSON.stringify(info));
  await p.click('#pubBtn');
  await p.waitForTimeout(1500);
  // ticket impreso (80 mm ≈ 302 px)
  const html = await p.evaluate(() => { const R = window.__ruteador; const s = R.currentSched()[0]; return `<style>body{width:72mm;margin-left:4mm;font-family:Arial;font-size:10.9pt;line-height:1.25}.c{text-align:center}.b{font-weight:700}hr{border:0;border-top:1px solid #000}hr.thick{border-top:2px solid #000}.row{display:flex;justify-content:space-between}.tag{border:1.5px solid #000;padding:0 3px;font-weight:700;font-size:8pt}</style>` + R.ticketHTML(R.conRepartidor(s), R.printCfg()); });
  const wa = await p.evaluate(() => window.__ruteador.routeText(window.__ruteador.currentSched()[0]));
  fs.writeFileSync(OUT + '/whatsapp.txt', wa);
  const t = await ctx.newPage(); await t.setViewportSize({ width: 302, height: 800 }); await t.setContent(html);
  await t.screenshot({ path: OUT + '/t02-ticket.png', fullPage: true });
  console.log('acciones:', calls.join(' | '));
  console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'Sin errores de página');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

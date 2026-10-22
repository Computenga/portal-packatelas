// Recorre domicilio, contactos, desempeño, emergencias y apps en modo demo. Uso: node test/ui-datos.test.js <carpeta>
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const OUT = process.argv[2] || 'shots';
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(8768);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'es-MX', timezoneId: 'America/Mexico_City',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36' });
  let p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text());  });
  let n = 0;
  const shot = async (name, full = true) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/d${String(++n).padStart(2, '0')}-${name}.png`, fullPage: full }); };
  const click = async sel => { await p.locator(sel).first().click(); await p.waitForTimeout(350); };
  const pin = async d => { for (const x of d) await p.locator(`.key:text-is("${x}")`).click(); await p.waitForTimeout(700); };
  await p.goto('http://localhost:8768/?demo');
  await p.route('**/tile.openstreetmap.org/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64') }));
  const nom = [];
  await p.route('**/nominatim.openstreetmap.org/**', r => { const u = r.request().url(); nom.push(u);
    if (/reverse/.test(u)) return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ address: { road: 'Calle Norte 54', house_number: '3831', neighbourhood: 'Gertrudis Sánchez', city_district: 'Gustavo A. Madero', state: 'Ciudad de México', postcode: '07830' } }) });
    return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ lat: '19.4612', lon: '-99.1158' }]) }); });
  await p.goto('http://localhost:8768/?demo');
  await p.fill('input.input', 'OEJO010101H11'); await click('text=Continuar');
  if (await p.locator('.key').count()) { await pin('1'); }
  // Jonatan (#92) no tiene PIN de 6 en el mock: entra Saidd y luego se prueba el editor como Jonatan desde el patrón
  await p.evaluate(() => localStorage.clear()); await p.goto('http://localhost:8768/?demo');
  await p.fill('input.input', 'LOAS950505H12'); await click('text=Continuar'); await pin('482915');
  await shot('inicio-entregas');
  await click('.card.tap:has-text("Tus entregas")'); await p.waitForSelector('.barras'); await shot('mis-entregas');
  await click('.icon-btn[aria-label="Regresar"]');
  await click('.tabbar button:has-text("Más")'); await click('.mi:has-text("Mis datos")'); await p.waitForSelector('text=Contactos de emergencia'); await shot('mis-datos');
  await click('.card:has-text("Domicilio") .btn'); await p.waitForSelector('.leaflet-container'); await p.waitForTimeout(1200); await shot('domicilio');
  await p.fill('input[autocomplete="postal-code"]', '07839');
  await click('text=Buscar en el mapa'); await p.waitForTimeout(2500); await shot('domicilio-buscado');
  await click('text=Guardar domicilio'); await p.waitForTimeout(800);
  await click('.card:has-text("Contactos de emergencia") .btn'); await shot('contactos');
  await p.locator('input[type="tel"]').nth(1).fill('55 1234 0001'); await click('text=Guardar contactos'); await p.waitForTimeout(400); await shot('contactos-error', false);
  await p.locator('input[type="tel"]').nth(1).fill('55 1234 0009'); await click('text=Guardar contactos'); await p.waitForTimeout(800);
  // Apps: "Abrir" comprueba la instalación; si Chrome regresa con #app-no-<id> la marca como no instalada
  await click('.tabbar button:has-text("Más")'); await click('.mi:has-text("Apps y accesos")');

  await click('.app-row:has-text("WhatsApp") .app-act .btn');
  await p.evaluate(() => { location.hash = '#app-no-whatsapp'; });
  await p.waitForSelector('.modal:has-text("no está instalada")', { timeout: 6000 }); await shot('app-no-instalada', false);

  (await p.evaluate(async () => { document.querySelector('.modal .btn').click(); await new Promise(r => setTimeout(r, 300)); return document.querySelectorAll('.modal').length; }));



  const btnWa = await p.locator('.app-row:has-text("WhatsApp") .app-act .btn').first().innerText();
  console.log('WhatsApp después de comprobar:', btnWa);
  if (btnWa !== 'Instalar') throw new Error('debía cambiar a Instalar');
  // patrón (pestaña nueva: el intent: de Android deja colgada la pestaña en Chromium de escritorio)
  await p.close(); p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
  await p.route('**/tile.openstreetmap.org/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64') }));
  await p.goto('http://localhost:8768/?demo'); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.fill('input.input', 'GUPC900101AB1'); await click('text=Continuar'); await pin('482915');
  await click('.tabbar button:has-text("Más")'); await click('.mi:has-text("Desempeño de repartidores")'); await p.waitForSelector('details.card'); await click('details.card summary'); await shot('pat-desempeno');
  await click('.seg button:has-text("Mes")'); await p.waitForTimeout(400); await shot('pat-desempeno-mes', false);
  await click('.icon-btn[aria-label="Regresar"]');
  await click('.mi:has-text("Emergencias")'); await p.waitForSelector('text=WhatsApp'); await shot('pat-emergencias');
  await click('.icon-btn[aria-label="Regresar"]');
  await click('.mi:has-text("GPS y alertas")'); await p.waitForSelector('text=Fuera de ruta'); await shot('pat-gps');
  await click('.icon-btn[aria-label="Regresar"]');
  await click('.tabbar button:has-text("Personal")'); await click('.card:has-text("Jonatan")'); await p.waitForSelector('text=Domicilio y emergencias'); await shot('pat-expediente');
  console.log('nominatim:', nom.length, 'consultas');
  console.log(errors.length ? 'ERRORES:\n' + errors.join('\n') : 'Sin errores de consola');
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

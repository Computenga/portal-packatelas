// Prueba de punta a punta del backend con hojas simuladas. Correr: node test/backend.test.js
const assert = require('assert');
const { makeEnv, Sheet, Spreadsheet } = require('./gas-mock');

const D = s => new Date(s + 'T00:00:00-06:00');
function clabe(prefix17) { const w = [3, 7, 1]; let s = 0; for (let i = 0; i < 17; i++) s += (Number(prefix17[i]) * w[i % 3]) % 10; return prefix17 + ((10 - (s % 10)) % 10); }
const CLABE4 = clabe('01218001523775234'), CLABE5 = clabe('12718001755028448');

const EMP_H = ['No. empleado', 'Nombre', 'Checadas', 'Celular ID', 'Llave pública', 'Alg', 'Contador', 'Celular registrado', 'Actualizado', 'Hora de entrada', 'Días laborales', 'Minutos de comida', 'Fecha de ingreso'];
const emp = (no, nombre, hora, dias, ing) => [no, nombre, 'ENTRADA,SALIDA_COMIDA,REGRESO_COMIDA,SALIDA', '', '', '', 0, '', '', hora, dias, hora ? 60 : '', ing ? D(ing) : ''];
const empleados = new Sheet('Empleados', [EMP_H,
  emp('1', 'Cristhian Michel Guevara Padilla', '', '', '2026-10-11'),
  emp('4', 'Saidd Argenis López', '9:00', 'L,M,Mi,J,V,S', ''),
  emp('5', 'casandra Alicia Ruiz', '9:00', 'L,M,Mi,J,V,S', '2025-08-01'),
  emp('92', 'jonatan ortega', '10:00', 'L,M,Mi,J,V,S', ''),
  emp('43', 'Natividad', '', '', ''),
]);
const CHK_H = ['UUID', 'Fecha', 'Hora', 'No. empleado', 'Nombre', 'Tipo', 'Similitud', 'Dispositivo', 'Recibido (servidor)', 'Foto', 'Método', 'Ubicación'];
const chk = (f, h, no, tipo) => ['u', D(f), h, no, '', tipo, '', 'Ipad', '', '', 'Huella + QR', ''];
const checadas = new Sheet('Checadas', [CHK_H,
  // Saidd (#4, 9:00): 01 a tiempo; 02 7 min tarde; 03 falta; 05 a tiempo + comida 75 min (15 extra); 06-08 a tiempo; 09 festivo; 10 a tiempo; 12 entra 9:05:29
  chk('2026-10-01', '08:58:00', '4', 'ENTRADA'),
  chk('2026-10-02', '09:07:10', '4', 'ENTRADA'),
  chk('2026-10-05', '08:59:00', '4', 'ENTRADA'), chk('2026-10-05', '14:00:00', '4', 'SALIDA A COMER'), chk('2026-10-05', '15:15:00', '4', 'REGRESO DE COMER'),
  chk('2026-10-06', '08:50:00', '4', 'ENTRADA'), chk('2026-10-07', '09:00:40', '4', 'ENTRADA'), chk('2026-10-08', '08:55:00', '4', 'ENTRADA'),
  chk('2026-10-10', '08:55:00', '4', 'ENTRADA'), chk('2026-10-12', '09:05:29', '4', 'ENTRADA'),
  // Casandra (#5): solo el 12, 8:52
  chk('2026-10-12', '08:52:19', '5', 'ENTRADA'),
]);
const justificadas = new Sheet('Justificadas', [['Fecha', 'No. empleado (vacío = todos)', 'Motivo', 'Nota', '', 'Cómo usar esta pestaña'],
  [D('2026-10-09'), '', 'Día festivo', '', '', '• Un renglón por día'],
  [D('2026-10-05'), '5', 'Vacaciones', '', '', '• Sin número = todos']]);
const maestro = new Spreadsheet({ Empleados: empleados, Checadas: checadas, Justificadas: justificadas, Dashboard: new Sheet('Dashboard') });

const flotilla = new Spreadsheet({
  Reparaciones: new Sheet('Reparaciones', [['rep_id', 'falla_id', 'vehiculo_id', 'mecanico_id', 'fecha_inicio', 'fecha_cierre', 'horas_respuesta', 'horas_reparacion', 'descripcion', 'foto_1', 'foto_2', 'foto_3', 'foto_4', 'costo_refacciones', 'costo_mano_obra', 'costo_total', 'causa', 'responsable_id', 'monto_empleado', 'monto_empresa', 'notificado_repartidor'],
    ['R-000001', 'F-000001', 'M-02', 'U-3', D('2026-10-09'), D('2026-10-10'), 2, 5, 'Cambio de espejo', '', '', '', '', 350, 0, 350, 'mal_uso', 'U-5', 350, 0, 'SI'],
    ['R-000002', 'F-000002', 'M-03', 'U-3', D('2026-10-09'), D('2026-10-10'), 2, 5, 'Balatas', '', '', '', '', 500, 0, 500, 'desgaste', 'U-5', 0, 500, '']]),
  Fallas: new Sheet('Fallas', [['falla_id', 'tipo', 'check_id', 'fecha_reporte', 'reportada_por', 'responsable_id', 'vehiculo_id', 'descripcion'],
    ['F-000001', 'no_reportado', '', D('2026-10-09'), 'U-5', 'U-5', 'M-02', 'Espejo izquierdo roto']]),
});

const gmail = [];
const env = makeEnv({ now: '2026-10-12T16:00:00-06:00', maestro, flotilla, gmail });
const { call, run, pushes, mails } = env;
const ok = (r, msg) => { if (!r.ok) throw new Error((msg || '') + ' → ' + r.error); return r.data; };
const fail = (r, re) => { assert(!r.ok, 'debía fallar'); assert(re.test(r.error), 'error inesperado: ' + r.error); };
let passed = 0; const t = (name, fn) => { fn(); passed++; console.log('✓', name); };

// ── Instalación
t('setup crea pestañas y Personal desde el checador', () => {
  run('setup');
  const per = maestro.getSheetByName('Personal');
  assert.strictEqual(per.getLastRow(), 6);
  assert.strictEqual(maestro.getSheetByName('Personal').data[1][7], 'patron'); // #1 es patrón
  // Para la prueba contamos asistencia desde el día 1
  const cfg = maestro.getSheetByName('ConfigPortal');
  cfg.data.find(r => r[0] === 'ASISTENCIA_DESDE')[1] = '2026-10-01';
  // El admin pone su RFC a mano en la hoja (paso de instalación)
  per.data[1][2] = 'GUPC900101AB1';
  run('setup'); // idempotente
  assert.strictEqual(per.getLastRow(), 6);
});

// ── Login
let admin, tok4, tok5;
t('primer acceso: RFC + No. de empleado y crear PIN', () => {
  assert.strictEqual(ok(call('estadoRfc', { rfc: 'gupc900101ab1' })).estado, 'nuevo');
  fail(call('estadoRfc', { rfc: 'XXXX' }), /formato/);
  fail(call('primerAcceso', { rfc: 'GUPC900101AB1', no_empleado: '4', pin: '482915' }), /no coinciden/);
  fail(call('primerAcceso', { rfc: 'GUPC900101AB1', no_empleado: '1', pin: '111111' }), /fácil/);
  const s = ok(call('primerAcceso', { rfc: 'GUPC900101AB1', no_empleado: '1', pin: '482915' }));
  assert.strictEqual(s.usuario.rol, 'patron');
  admin = s.token;
  fail(call('primerAcceso', { rfc: 'GUPC900101AB1', no_empleado: '1', pin: '482915' }), /ya tiene PIN/);
  assert.strictEqual(ok(call('estadoRfc', { rfc: 'GUPC900101AB1' })).estado, 'activo');
  admin = ok(call('login', { rfc: 'GUPC-900101-AB1', pin: '482915' })).token;
});

t('patrón edita expedientes; valida CLABE y RFC', () => {
  fail(call('guardarPersona', { persona: { no_empleado: '4', clabe: '012180015237752340' } }, admin), CLABE4.endsWith('0') ? /x^/ : /CLABE/);
  ok(call('guardarPersona', { persona: { no_empleado: '4', rfc: 'LOAS950505H12', clabe: CLABE4, salario_diario: 320, puesto: 'Repartidor' } }, admin));
  ok(call('guardarPersona', { persona: { no_empleado: '5', rfc: 'RUCA990909MX1', clabe: CLABE5, salario_diario: 300, flotilla_id: 'U-5', puesto: 'Repartidora' } }, admin));
  fail(call('guardarPersona', { persona: { no_empleado: '92', rfc: 'LOAS950505H12' } }, admin), /ya es de/);
  fail(call('guardarPersona', { persona: { no_empleado: '1', rol: 'empleado' } }, admin), /a ti mismo/);
  tok4 = ok(call('primerAcceso', { rfc: 'LOAS950505H12', no_empleado: '4', pin: '204060' })).token;
  tok5 = ok(call('primerAcceso', { rfc: 'RUCA990909MX1', no_empleado: '5', pin: '305070' })).token;
  fail(call('panel', {}, tok4), /Sin permiso/);
});

// ── Asistencia
t('asistencia de Saidd con las reglas del checador', () => {
  const a = ok(call('asistencia', { periodo: '2026-10-1' }, tok4));
  const byF = Object.fromEntries(a.dias.map(d => [d.fecha, d]));
  assert.strictEqual(byF['2026-10-01'].estado, 'A_TIEMPO');
  assert.strictEqual(byF['2026-10-02'].min_tarde, 7);
  assert.strictEqual(byF['2026-10-03'].estado, 'FALTA');
  assert.strictEqual(byF['2026-10-04'].estado, 'DESCANSO');
  assert.strictEqual(byF['2026-10-05'].min_comida_extra, 15);
  assert.strictEqual(byF['2026-10-07'].min_tarde, 0, '40 segundos no cuentan como minuto');
  assert.strictEqual(byF['2026-10-09'].estado, 'JUSTIFICADA');
  assert.strictEqual(byF['2026-10-12'].min_tarde, 5);
  assert.strictEqual(byF['2026-10-13'].estado, 'FUTURO');
  const x = a.totales;
  assert.deepStrictEqual([x.dias_laborales, x.asistencias, x.faltas, x.justificadas, x.retardos, x.min_tarde, x.min_comida_extra, x.min_total],
    [10, 8, 1, 1, 2, 12, 15, 27]);
  assert.strictEqual(x.horas_retraso, 0.45);
  assert.strictEqual(x.horas_descuento, 8.45);
  // Casandra: entra desde 2025, solo checó el 12; el 5 tiene vacaciones justificadas
  const c = ok(call('asistencia', { periodo: '2026-10-1' }, tok5)).totales;
  assert.deepStrictEqual([c.dias_laborales, c.asistencias, c.faltas, c.justificadas], [10, 1, 7, 2]);
});

t('asistencia general y panel del patrón', () => {
  const g = ok(call('asistenciaGeneral', { periodo: '2026-10-1' }, admin));
  const sa = g.empleados.find(e => e.no_empleado === '4');
  assert.strictEqual(sa.hoy.entrada, '9:05');
  assert(g.empleados.find(e => e.no_empleado === '43').sin_horario);
  const p = ok(call('panel', {}, admin));
  assert.strictEqual(p.hoy_resumen.esperados, 3); // 4, 5, 92
  assert.strictEqual(p.hoy_resumen.presentes, 2);
  assert.strictEqual(p.hoy_resumen.faltan[0].nombre, 'jonatan ortega');
  assert.strictEqual(p.datos_faltantes.sin_clabe, 3);
});

// ── Nómina
let pre;
t('adeudo + prenómina con faltas, retardos, cargo de flotilla y abono', () => {
  ok(call('guardarAdeudo', { no_empleado: '5', concepto: 'Préstamo', monto_total: 1000, cuota: 250 }, admin));
  pre = ok(call('prenomina', { periodo: '2026-10-1' }, admin));
  const s = pre.filas.find(f => f.no_empleado === '4');
  assert.strictEqual(s.sueldo, 4800);
  assert.strictEqual(s.desc_faltas, 320);
  assert.strictEqual(s.desc_retardos, 18); // 0.45 h × 40 $/h
  assert.strictEqual(s.neto, 4462);
  const c = pre.filas.find(f => f.no_empleado === '5');
  assert.strictEqual(c.desc_cargos, 350, 'solo el cargo con monto_empleado');
  assert.strictEqual(c.cargos[0].descripcion, 'Espejo izquierdo roto');
  assert.strictEqual(c.desc_adeudos, 250);
  assert.strictEqual(c.desc_faltas, 2100);
  assert.strictEqual(c.neto, 4500 - 2100 - 350 - 250);
  assert(pre.filas.find(f => f.no_empleado === '92').sin_salario);
});

let rec4, rec5;
t('emitir recibos: PDF, bandeja y abono al adeudo', () => {
  const filas = pre.filas.filter(f => ['4', '5'].includes(f.no_empleado));
  filas.find(f => f.no_empleado === '4').bonos = 200;
  const r = ok(call('emitirRecibos', { periodo: '2026-10-1', filas }, admin));
  assert.strictEqual(r.emitidos, 2);
  rec4 = r.recibos.find(x => x.no_empleado === '4');
  rec5 = r.recibos.find(x => x.no_empleado === '5');
  assert.strictEqual(rec4.neto, 4662);
  fail(call('emitirRecibos', { periodo: '2026-10-1', filas }, admin), /ya tiene recibo/);
  const ad = ok(call('adeudos', {}, tok5));
  assert.strictEqual(ad.saldo_total, 750);
  assert.strictEqual(ad.cargos[0].estatus, 'descontado');
  // la prenómina ya no vuelve a cobrar el cargo
  assert.strictEqual(ok(call('prenomina', { periodo: '2026-10-2' }, admin)).filas.find(f => f.no_empleado === '5').desc_cargos, 0);
  const b = ok(call('bandeja', {}, tok4));
  assert(/recibo/i.test(b[0].titulo));
  assert(env.files.file1 && /NETO A PAGAR/.test(env.files.file1.data));
});

t('el empleado ve y firma su recibo con PIN; no ve recibos ajenos', () => {
  const l = ok(call('recibos', {}, tok4));
  assert.strictEqual(l.length, 1);
  fail(call('recibo', { recibo_id: rec5.recibo_id }, tok4), /no encontrado/);
  fail(call('firmarRecibo', { recibo_id: rec4.recibo_id, pin: '000000' }, tok4), /PIN incorrecto/);
  const f = ok(call('firmarRecibo', { recibo_id: rec4.recibo_id, pin: '204060', dispositivo: 'test' }, tok4));
  assert(f.firma_fecha);
  assert(ok(call('reciboPdf', { recibo_id: rec4.recibo_id }, tok4)).base64);
});

// ── Pagos Fondeadora
t('correo de Fondeadora: match por CLABE, cuadra con el recibo y avisa por push', () => {
  ok(call('registerDevice', { fcm_token: 'tok-saidd', plataforma: 'android' }, tok4));
  ok(call('registerDevice', { fcm_token: 'tok-admin' }, admin));
  const body = (m, c, con, cr) => `Transferencia exitosa\n\nRealizaste una transferencia de $${m} a ${c} por el concepto de ${con}. Clave de rastreo: ${cr}. Consulta el detalle de este movimiento desde tu app.`;
  gmail.push([
    { id: 'g1', subject: 'Transferencia exitosa', date: '2026-10-15T18:00:00Z', body: body('4,662.00', CLABE4, 'nomina', 'FN455589T1') },
    { id: 'g2', subject: 'Transferencia exitosa', date: '2026-10-15T18:01:00Z', body: body('23376.51', '646180242300027032', 'clara tdc', 'FN455589T2') },
    { id: 'g3', subject: 'Transferencia exitosa', date: '2026-10-15T18:02:00Z', body: body('1500.00', CLABE5, 'nomina', 'FN455589T3') },
    { id: 'g4', subject: 'Transferencia exitosa', date: '2026-10-15T18:03:00Z', body: body('1000.00', CLABE5, 'bono tiempo extra', 'FN455589T4') },
  ]);
  pushes.length = 0;
  run('tareaFondeadora');
  const p4 = ok(call('pagos', {}, tok4));
  assert.strictEqual(p4.length, 1);
  assert.strictEqual(p4[0].cuadra, 'SI');
  assert.strictEqual(p4[0].recibo_id, rec4.recibo_id);
  assert.strictEqual(ok(call('recibo', { recibo_id: rec4.recibo_id }, tok4)).estatus, 'pagado');
  assert(pushes.some(m => m.token === 'tok-saidd' && /4,662\.00/.test(m.notification.title)));
  const p5 = ok(call('pagos', {}, tok5));
  assert.deepStrictEqual(p5.map(p => p.cuadra).sort(), ['NO', 'SIN RECIBO']);
  assert(pushes.some(m => m.token === 'tok-admin' && /no cuadra/.test(m.notification.title)));
  assert.strictEqual(mails.length, 1);
  // no duplica al volver a correr
  run('tareaFondeadora');
  assert.strictEqual(ok(call('pagosAdmin', { desde: '2026-10-01' }, admin)).length, 3);
  // el patrón liga a mano el pago que no cuadró
  const pg = ok(call('pagos', {}, tok5)).find(p => p.cuadra === 'NO');
  ok(call('asignarPago', { pago_id: pg.pago_id, recibo_id: rec5.recibo_id }, admin));
  assert.strictEqual(ok(call('recibo', { recibo_id: rec5.recibo_id }, tok5)).estatus, 'pagado');
});

t('parser tolera variantes del correo', () => {
  const x = env.ctx.parseFondeadora_('Realizaste una transferencia de $801.00 a 012180015459572590 por el concepto de Transferencia desde Fondeadora Negocios. Clave de rastreo: FN455589T1791077558. Consulta');
  assert.deepStrictEqual([x.monto, x.clabe, x.concepto, x.clave_rastreo], [801, '012180015459572590', 'Transferencia desde Fondeadora Negocios', 'FN455589T1791077558']);
  assert.strictEqual(env.ctx.parseFondeadora_('Recibiste un depósito de $10'), null);
  const real = 'Transferencia exitosa\n\nRealizaste una transferencia de $4,426.25 a 012180015237752341 por el concepto de nomina.\n\nClave de rastreo: FN455589T1790877971.\n\nConsulta el detalle de este movimiento desde tu aplicación.';
  const y = env.ctx.parseFondeadora_(real);
  assert.deepStrictEqual([y.monto, y.clabe, y.concepto, y.clave_rastreo], [4426.25, '012180015237752341', 'nomina', 'FN455589T1790877971']);
});

// ── Solicitudes
t('justificante: el patrón aprueba y se escribe en Justificadas del checador', () => {
  fail(call('crearSolicitud', { tipo: 'justificante', fecha_desde: '2026-10-13', motivo: '' }, tok4), /motivo/);
  const id = ok(call('crearSolicitud', { tipo: 'justificante', fecha_desde: '2026-10-13', fecha_hasta: '2026-10-14', motivo: 'Cita IMSS' }, tok4));
  assert.strictEqual(ok(call('solicitudesAdmin', { estatus: 'pendiente' }, admin)).length, 1);
  ok(call('resolverSolicitud', { sol_id: id, aprobar: true, comentario: 'Trae el comprobante' }, admin));
  const filas = justificadas.data.filter(r => r[1] === '4');
  assert.strictEqual(filas.length, 2);
  assert.strictEqual(justificadas.data[0][5], 'Cómo usar esta pestaña', 'no toca las instrucciones');
  fail(call('resolverSolicitud', { sol_id: id, aprobar: false }, admin), /ya fue resuelta/);
  assert(/Aprobada/.test(ok(call('bandeja', {}, tok4))[0].titulo));
});

t('vacaciones según LFT y anticipo que se vuelve adeudo', () => {
  const pf = ok(call('perfil', {}, tok5));
  assert.strictEqual(pf.vacaciones.anios, 1);
  assert.strictEqual(pf.vacaciones.derecho, 12);
  fail(call('crearSolicitud', { tipo: 'vacaciones', fecha_desde: '2026-10-19', fecha_hasta: '2026-11-07' }, tok5), /Solo tienes/);
  ok(call('crearSolicitud', { tipo: 'vacaciones', fecha_desde: '2026-10-19', fecha_hasta: '2026-10-21' }, tok5));
  assert.strictEqual(ok(call('perfil', {}, tok5)).vacaciones.disponibles, 9);
  const aid = ok(call('crearSolicitud', { tipo: 'anticipo', monto: 800, motivo: 'Emergencia' }, tok4));
  ok(call('resolverSolicitud', { sol_id: aid, aprobar: true, cuota: 400 }, admin));
  const ad = ok(call('adeudos', {}, tok4));
  assert.strictEqual(ad.saldo_total, 800);
  assert.strictEqual(ad.adeudos[0].cuota, 400);
});

t('cancelar recibo regresa el abono y libera el pago', () => {
  ok(call('cancelarRecibo', { recibo_id: rec5.recibo_id }, admin));
  assert.strictEqual(ok(call('adeudos', {}, tok5)).saldo_total, 1000);
  assert.strictEqual(ok(call('recibos', {}, tok5)).length, 0);
  assert(ok(call('pagos', {}, tok5)).every(p => !p.recibo_id));
});

t('avisos a todos y bandeja', () => {
  const r = ok(call('enviarAviso', { titulo: 'Junta', mensaje: 'Mañana 9am', destinatarios: 'todos' }, admin));
  assert.strictEqual(r.enviados, 5);
  ok(call('marcarLeido', { todos: true }, tok4));
  assert(ok(call('bandeja', {}, tok4)).every(n => n.leido));
  assert.strictEqual(ok(call('avisosEnviados', {}, admin))[0].leidos, 1);
});

t('inicio del empleado', () => {
  const i = ok(call('inicio', {}, tok4));
  assert.strictEqual(i.hoy_detalle.min_tarde, 5);
  assert.strictEqual(i.recibos_sin_firmar, 0);
  assert.strictEqual(i.ultimo_pago.monto, 4662);
});

t('bloqueo tras 5 PIN incorrectos y reinicio por el patrón', () => {
  for (let i = 0; i < 4; i++) fail(call('login', { rfc: 'RUCA990909MX1', pin: '999999' }), /Te quedan/);
  fail(call('login', { rfc: 'RUCA990909MX1', pin: '999999' }), /bloqueado/);
  fail(call('login', { rfc: 'RUCA990909MX1', pin: '305070' }), /bloqueado/);
  fail(call('inicio', {}, tok5), /inactivo/);
  ok(call('resetPin', { no_empleado: '5' }, admin));
  assert.strictEqual(ok(call('estadoRfc', { rfc: 'RUCA990909MX1' })).estado, 'nuevo');
  tok5 = ok(call('primerAcceso', { rfc: 'RUCA990909MX1', no_empleado: '5', pin: '708090' })).token;
  fail(call('cambiarPin', { actual: '000000', nuevo: '135791' }, tok5), /actual/);
  const s = ok(call('cambiarPin', { actual: '708090', nuevo: '135791' }, tok5));
  fail(call('inicio', {}, tok5), /expirada/); // el token viejo deja de servir
  ok(call('inicio', {}, s.token));
});

t('sincroniza empleados nuevos del checador', () => {
  empleados.data.push(emp('100', 'Nuevo Empleado', '9:00', 'L,M,Mi,J,V', ''));
  assert.strictEqual(run('sincronizarPersonal').nuevos, 1);
});

t('bienvenida: pasos automáticos, docs, apps de repartidor y accesos', () => {
  // Saidd es repartidor (puesto); Casandra es repartidora con flotilla_id; empleado 92 sin puesto
  let b = ok(call('bienvenida', {}, tok4));
  assert.strictEqual(b.rol, 'repartidor');
  assert.deepStrictEqual(b.pasos.map(x => x.id), ['acceso', 'documentos', 'apps', 'checador', 'notificaciones', 'datos']);
  assert.deepStrictEqual(b.pasos.map(x => x.hecho), [true, false, false, false, true, false]); // ya registró push antes
  b = ok(call('docsRecibidos', { no_empleado: '4', recibidos: true }, admin));
  assert(b.pasos[1].hecho);
  const apps = ok(call('apps', {}, tok4));
  assert(apps.find(a => a.app_id === 'packatelas' && a.tipo === 'apk'));
  for (const a of apps.filter(a => a.requerida)) b = ok(call('marcarApp', { app_id: a.app_id }, tok4));
  assert(b.pasos[2].hecho);
  b = ok(call('marcarApp', { app_id: 'zello', lista: false }, tok4));
  assert(!b.pasos[2].hecho && b.pasos[2].faltan[0] === 'Zello');
  // checador: el paso se marca solo con su primera checada del ZKTeco (no con el celular del kiosco viejo)
  empleados.data.find(r => r[0] === '4')[3] = 'cred-xyz';
  ok(call('marcarApp', { app_id: 'zello' }, tok4));
  b = ok(call('bienvenida', {}, tok4));
  assert(!b.pasos[3].hecho, 'un celular del kiosco ya no cuenta');
  checadas.data.push(['ZK-1', D('2026-10-15'), '09:00:00', '4', '', 'ENTRADA', '', 'ZKTeco A3B7214760517', '', '', 'Huella (checador ZKTeco)', '']);
  b = ok(call('bienvenida', {}, tok4));
  assert(!b.completa && b.pasos[5].id === 'datos' && !b.pasos[5].hecho);
  assert.strictEqual(ok(call('inicio', {}, tok4)).datos_pendientes, true);
  // Domicilio con pin y 2 contactos de emergencia (validados)
  const dom = { calle: 'Av. Siempre Viva 742', colonia: 'Obrera', cp: '06800', municipio: 'Cuauhtémoc', estado: 'Ciudad de México', lat: 19.4201, lng: -99.1402, dist_m: 35 };
  fail(call('guardarMisDatos', { domicilio: Object.assign({}, dom, { calle: 'Av. Siempre Viva' }) }, tok4), /número exterior/);
  fail(call('guardarMisDatos', { domicilio: Object.assign({}, dom, { cp: '0680' }) }, tok4), /5 dígitos/);
  fail(call('guardarMisDatos', { domicilio: Object.assign({}, dom, { cp: '54000' }) }, tok4), /no es de la Ciudad de México/);
  fail(call('guardarMisDatos', { domicilio: Object.assign({}, dom, { lat: '', lng: '' }) }, tok4), /pin/);
  fail(call('guardarMisDatos', { domicilio: Object.assign({}, dom, { lat: 25.6, lng: -100.3 }) }, tok4), /lejos/);
  let pf = ok(call('guardarMisDatos', { domicilio: dom }, tok4));
  assert.strictEqual(pf.domicilio.lat, 19.4201); assert(/Col\. Obrera/.test(pf.domicilio.texto)); assert.strictEqual(pf.completos.domicilio, true);
  const c1 = { nombre: 'María López', telefono: '55 1234 0001', parentesco: 'Mamá' }, c2 = { nombre: 'Pedro López', telefono: '+52 1 55 1234 0002', parentesco: 'Hermano' };
  fail(call('guardarMisDatos', { contactos: [c1] }, tok4), /2 contactos/);
  fail(call('guardarMisDatos', { contactos: [{ nombre: 'María', telefono: '5512340001', parentesco: 'Mamá' }, c2] }, tok4), /nombre y apellido/);
  fail(call('guardarMisDatos', { contactos: [c1, Object.assign({}, c2, { telefono: '5512340001' })] }, tok4), /mismo teléfono/);
  fail(call('guardarMisDatos', { contactos: [c1, Object.assign({}, c2, { telefono: '1111111111' })] }, tok4), /no parece real/);
  fail(call('guardarMisDatos', { contactos: [c1, Object.assign({}, c2, { parentesco: '' })] }, tok4), /parentesco/);
  pf = ok(call('guardarMisDatos', { contactos: [c1, c2] }, tok4));
  assert.deepStrictEqual(pf.contactos.map(c => c.telefono), ['5512340001', '5512340002']);
  const em = ok(call('emergencias', {}, admin)).find(x => x.no_empleado === '4');
  assert.strictEqual(em.contactos[1].parentesco, 'Hermano'); assert.strictEqual(em.domicilio.cp, '06800');
  fail(call('emergencias', {}, tok4), /Sin permiso/);
  assert.strictEqual(ok(call('personal', {}, admin)).find(p => p.no_empleado === '4').contactos[0].nombre, 'María López');
  b = ok(call('bienvenida', {}, tok4));
  assert(b.completa, JSON.stringify(b.pasos.map(x => x.hecho)));
  const i = ok(call('inicio', {}, tok4));
  assert(i.bienvenida.completa && i.accesos.length >= 5 && i.accesos.every(a => a.acceso_directo));
  // Oficina: sin paso de apps ni apps de repartidor
  ok(call('guardarPersona', { persona: { no_empleado: '92', rfc: 'OEJO010101H11', puesto: 'Almacén' } }, admin));
  const t92 = ok(call('primerAcceso', { rfc: 'OEJO010101H11', no_empleado: '92', pin: '246813' })).token;
  b = ok(call('bienvenida', {}, t92));
  assert.strictEqual(b.rol, 'otro');
  assert(!b.pasos.find(x => x.id === 'apps'));
  assert.strictEqual(ok(call('apps', {}, t92)).length, 0);
  fail(call('elegirRol', { rol: 'repartidor' }, t92), /RH/);
  // Patrón: avance en Personal, recordatorio, editar apps
  const per = ok(call('personal', {}, admin));
  assert.strictEqual(per.find(p => p.no_empleado === '4').bienvenida.completa, true);
  ok(call('recordarBienvenida', { no_empleado: '92' }, admin));
  assert(/bienvenida/.test(ok(call('bandeja', {}, t92))[0].titulo));
  ok(call('guardarApp', { app: { app_id: 'Shipday', nombre: 'Shipday Drive', tipo: 'playstore', url_instalar: 'https://play.google.com/x', puestos: 'todos', requerida: true, acceso_directo: true, orden: 5 } }, admin));
  assert.strictEqual(ok(call('apps', {}, t92))[0].app_id, 'shipday');
  assert(ok(call('panel', {}, admin)).bienvenida_pendiente >= 1);
});

t('alta pública con documentos, revisión y aprobación', () => {
  const img = Buffer.from('foto').toString('base64');
  fail(call('altaIniciar', { nombre: 'Juan', rfc: 'PEJJ900101AB1', telefono: '5512345678', rol: 'repartidor' }), /nombre completo/);
  fail(call('altaIniciar', { nombre: 'Juan Pérez', rfc: 'LOAS950505H12', telefono: '5512345678', rol: 'repartidor' }), /Ya estás dado de alta/);
  const r = ok(call('altaIniciar', { nombre: 'Juan Pérez', rfc: 'pejj900101ab1', telefono: '55 1234 5678', rol: 'repartidor' }));
  assert(r.alta_token && r.alta.docs.documentos.some(d => d.doc_id === 'licencia'));
  const tok = r.alta_token;
  fail(call('altaSubir', { alta_token: tok, doc_id: 'curp', base64: img, mime: 'text/plain' }), /fotos o PDF/);
  fail(call('altaSubir', { alta_token: 'xxx', doc_id: 'curp', base64: img, mime: 'image/jpeg' }), /no encontrado/);
  let e;
  for (const d of r.alta.docs.documentos) e = ok(call('altaSubir', { alta_token: tok, doc_id: d.doc_id, base64: img, mime: 'image/jpeg' }));
  assert.strictEqual(e.estatus, 'completa');
  assert(mails.some(m => /Alta lista/.test(m.s)));
  // reemplazar un documento deja solo el último
  e = ok(call('altaSubir', { alta_token: tok, doc_id: 'curp', base64: img, mime: 'application/pdf' }));
  assert.strictEqual(e.docs.documentos.find(d => d.doc_id === 'curp').mime, 'application/pdf');
  // retomar desde otro celular con el mismo teléfono
  fail(call('altaIniciar', { nombre: 'Juan Pérez', rfc: 'PEJJ900101AB1', telefono: '5500000000', rol: 'repartidor' }), /otro celular/);
  const r2 = ok(call('altaIniciar', { nombre: 'Juan Pérez', rfc: 'PEJJ900101AB1', telefono: '5512345678', rol: 'repartidor' }));
  fail(call('altaEstado', { alta_token: tok }), /no encontrado/);
  // patrón
  const altas = ok(call('altasAdmin', {}, admin));
  assert.strictEqual(altas[0].nombre, 'Juan Pérez');
  const arch = altas[0].docs.documentos[0];
  ok(call('revisarDocumento', { archivo_id: arch.archivo_id, estatus: 'aprobado' }, admin));
  assert(ok(call('archivo', { archivo_id: arch.archivo_id }, admin)).base64);
  fail(call('resolverAlta', { alta_id: altas[0].alta_id, aprobar: true, no_empleado: '4' }, admin), /ya es de/);
  ok(call('resolverAlta', { alta_id: altas[0].alta_id, aprobar: true, no_empleado: '120', puesto: 'Repartidor' }, admin));
  const est = ok(call('altaEstado', { alta_token: r2.alta_token }));
  assert.strictEqual(est.estatus, 'aprobada'); assert.strictEqual(est.no_empleado, '120');
  // entra con su RFC y número, y sus documentos ya están en su expediente
  const t120 = ok(call('primerAcceso', { rfc: 'PEJJ900101AB1', no_empleado: '120', pin: '159357' })).token;
  const md = ok(call('misDocumentos', {}, t120));
  assert(md.completos && md.aprobados === 1);
  const b = ok(call('bienvenida', {}, t120));
  assert(b.pasos.find(x => x.id === 'documentos').hecho);
  assert.strictEqual(ok(call('inicio', {}, t120)).repartidor, true);
  // rechazo de un documento: notificación y el paso vuelve a pendiente
  const doc = md.documentos.find(d => d.doc_id === 'domicilio');
  fail(call('revisarDocumento', { archivo_id: doc.archivo_id, estatus: 'rechazado' }, admin), /qué debe corregir/);
  ok(call('revisarDocumento', { archivo_id: doc.archivo_id, estatus: 'rechazado', comentario: 'Tiene más de 3 meses' }, admin));
  assert(/Corrige/.test(ok(call('bandeja', {}, t120))[0].titulo));
  assert(!ok(call('bienvenida', {}, t120)).pasos.find(x => x.id === 'documentos').hecho);
  ok(call('subirMiDocumento', { doc_id: 'domicilio', base64: img, mime: 'image/jpeg' }, t120));
  assert(ok(call('bienvenida', {}, t120)).pasos.find(x => x.id === 'documentos').hecho);
  fail(call('archivo', { archivo_id: doc.archivo_id }, tok4), /no encontrado/);
  // oficina: sin licencia
  const tipos92 = ok(call('misDocumentos', {}, ok(call('login', { rfc: 'OEJO010101H11', pin: '246813' })).token));
  assert(!tipos92.documentos.some(d => d.doc_id === 'licencia'));
  assert(ok(call('panel', {}, admin)).docs_por_revisar >= 1);
});


// ── Rutas: claves, TomTom, publicar, Mi ruta y reporte Shipday
t('rutas: claves en servidor, proxy TomTom, publicar, Mi ruta y reporte Shipday', () => {
  const { ctx } = env;
  const calls = [];
  const resp = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj) });
  const SD = {
    'ML-111': [{ orderId: 9, orderNumber: 'ML-111', orderStatus: { orderState: 'ALREADY_DELIVERED' }, activityLog: { deliveryTime: '2026-10-12T16:40:00Z' }, assignedCarrier: { id: 11, name: 'Saidd Lopez' } }],
    'ML-222': [{ orderId: 8, orderNumber: 'ML-222', orderStatus: { orderState: 'ALREADY_DELIVERED' }, activityLog: { deliveryTime: '2026-10-12 16:20:00' }, assignedCarrier: { id: 11, name: 'Saidd Lopez' } }],
    'ML-333': [{ orderId: 7, orderNumber: 'ML-333', orderStatus: { orderState: 'FAILED_DELIVERY' }, activityLog: {}, assignedCarrier: { id: 22, name: 'Angel Campos' } }],
  };
  const fetchOne = (url, o) => {
    calls.push(url);
    if (/fcm\.googleapis/.test(url)) { env.pushes.push(JSON.parse(o.payload).message); return resp(200, {}); }
    if (/tomtom/.test(url)) {
      if (/key=MALA/.test(url)) return resp(403, { detailedError: { message: 'bad key' } });
      const n = url.split('/calculateRoute/')[1].split('/json')[0].split(':').length;
      return resp(200, { routes: [{ legs: Array.from({ length: n - 1 }, (_, i) => ({ summary: { travelTimeInSeconds: 600 + i, lengthInMeters: 3000 }, points: Array.from({ length: 200 }, (_, k) => ({ latitude: 19.4 + k / 1e4, longitude: -99.1 })) })) }] });
    }
    if (/shipday\.com\/carriers/.test(url)) return resp(o.headers.Authorization === 'Basic SDKEY' ? 200 : 401, [{ id: 11, name: 'Saidd A. Lopez', phoneNumber: '+52 55 1111 2222' }, { id: 22, name: 'Angel Campos' }]);
    if (/shipday\.com\/orders\//.test(url)) { const num = decodeURIComponent(url.split('/orders/')[1]); return SD[num] ? resp(200, SD[num]) : resp(404, { message: 'not found' }); }
    return resp(404, {});
  };
  ctx.UrlFetchApp = { fetch: fetchOne, fetchAll: reqs => reqs.map(r => fetchOne(r.url, r)) };

  // sin key: error claro; con key mala no se guarda; con buena sí y nunca se devuelve
  fail(call('tomtomRutas', { rutas: [{ locs: [[19.4, -99.1], [19.5, -99.2]] }] }, admin), /Falta la key de TomTom/);
  fail(call('guardarClaves', { tomtom: 'MALA' }, admin), /TomTom rechazó/);
  fail(call('guardarClaves', { tomtom: 'BUENA' }, tok4), /Sin permiso/);
  assert.deepStrictEqual(ok(call('guardarClaves', { tomtom: 'BUENA' }, admin)), { tomtom: true });
  fail(call('guardarClaves', { shipday: 'OTRA' }, admin), /Shipday rechazó/);
  ok(call('guardarClaves', { shipday: 'SDKEY' }, admin));
  const cfg = ok(call('rutasConfig', {}, admin));
  assert(cfg.tomtom && cfg.shipday && !JSON.stringify(cfg).includes('BUENA') && !JSON.stringify(cfg).includes('SDKEY'));
  assert(cfg.empleados.some(e => e.no_empleado === '4'));

  // proxy TomTom: una ruta de 3 paradas → 3 tramos con geometría reducida
  const tt = ok(call('tomtomRutas', { rutas: [{ locs: [[19.41, -99.13], [19.5, -99.2], [19.52, -99.21], [19.53, -99.22]] }], departAt: '2026-10-12T17:00:00-06:00', mode: 'motorcycle' }, admin));
  assert.strictEqual(tt.rutas[0].legs.length, 3);
  assert(tt.rutas[0].legs[0].pts.length <= 61);
  assert(calls.some(u => /travelMode=motorcycle/.test(u) && /traffic=true/.test(u) && /departAt=2026-10-12T17%3A00%3A00-06%3A00/.test(u)));

  // publicar: valida duplicados, guarda y avisa al repartidor
  const ruta = { no_empleado: '4', num: 1, total: 1, salida: '10:00', fin: '11:20', km: 12.3, color: '#e4572e', deposito: [19.4182, -99.1369],
    paradas: [
      { orden: 1, eta: '10:15', envios: ['222'], dir: 'Calle 1, Coyoacán', ref: 'Ana', lat: 19.5, lng: -99.2, espera: 10 },
      { orden: 2, eta: '10:35', envios: ['111'], dir: 'Calle 2', ref: 'Luis', lat: 19.52, lng: -99.21, espera: 10 },
      { orden: 3, eta: '10:55', envios: ['333', '444'], dir: 'Calle 3', ref: '', lat: 19.53, lng: -99.22, espera: 12 }],
    geom: Array.from({ length: 3000 }, (_, k) => [19.4 + k / 1e5, -99.1]) };
  fail(call('publicarRutas', { fecha: '2026-10-12', rutas: [ruta, Object.assign({}, ruta, { num: 2 })] }, admin), /más de una ruta/);
  const pub = ok(call('publicarRutas', { fecha: '2026-10-12', rutas: [ruta] }, admin));
  assert.strictEqual(pub.publicadas, 1);
  assert(/Tu ruta de hoy/.test(ok(call('bandeja', {}, tok4))[0].titulo));
  // el empleado la ve en Inicio y en Mi ruta (con paradas y geometría)
  assert.strictEqual(ok(call('inicio', {}, tok4)).ruta.paradas, 3);
  const mi = ok(call('miRuta', {}, tok4));
  assert.strictEqual(mi.paradas.length, 3);
  assert.strictEqual(mi.salida, '10:00');
  assert(mi.geom.length > 10);
  assert.strictEqual(ok(call('miRuta', {}, ok(call('login', { rfc: 'RUCA990909MX1', pin: '135791' })).token)), null);
  // volver a publicar reemplaza la anterior
  ok(call('publicarRutas', { fecha: '2026-10-12', rutas: [ruta] }, admin));
  assert.strictEqual(ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).rutas.length, 1);

  // sin vincular: no se adivina por nombre, se avisa
  let r0 = ok(call('reporteRutas', { fecha: '2026-10-12' }, admin)).reporte[0];
  assert(/sin vincular en Shipday/.test(r0.otros_repartidores), r0.otros_repartidores);
  // vincular por ID: la sugerencia sale por teléfono, pero solo se guarda al confirmar
  ok(call('guardarPersona', { persona: { no_empleado: '4', telefono: '5511112222' } }, admin));
  const sr = ok(call('shipdayRepartidores', {}, admin));
  assert.strictEqual(sr.repartidores.find(x => x.id === '11').sugerido, '4');
  assert.strictEqual(sr.repartidores.find(x => x.id === '11').no_empleado, '');
  fail(call('vincularShipday', { shipday_id: '11', no_empleado: '4' }, tok4), /Sin permiso/);
  ok(call('vincularShipday', { shipday_id: '11', no_empleado: '4' }, admin));
  assert.strictEqual(ok(call('shipdayRepartidores', {}, admin)).repartidores.find(x => x.id === '11').no_empleado, '4');
  // dos cuentas de Shipday para el mismo empleado: vincular la segunda no borra la primera
  ok(call('vincularShipday', { shipday_id: '33', no_empleado: '4' }, admin));
  ok(call('vincularShipday', { shipday_id: '11', no_empleado: '4' }, admin));
  assert.strictEqual(ok(call('personal', {}, admin)).find(p => p.no_empleado === '4').shipday_id, '11, 33');
  ok(call('vincularShipday', { shipday_id: '33', no_empleado: '' }, admin));
  assert.strictEqual(ok(call('personal', {}, admin)).find(p => p.no_empleado === '4').shipday_id, '11');
  // reporte Shipday: 222 entregado 10:20 (antes que 111 a 10:40 → orden correcto), 333 fallido, 444 no existe
  const rep = ok(call('reporteRutas', { fecha: '2026-10-12' }, admin));
  const r = rep.reporte[0];
  assert.strictEqual(r.envios, 4);
  assert.strictEqual(r.entregados, 2);
  assert.strictEqual(r.no_entregados, 2);
  assert.strictEqual(r.en_orden, 2);
  assert.strictEqual(r.fuera_orden, 0);
  assert.strictEqual(r.fin_real, '10:40');
  assert.strictEqual(r.otros_repartidores, 'Angel Campos');
  assert.strictEqual(r.calificacion, 'Mal');
  assert.strictEqual(r.detalle[0].real, '10:20');
  assert.strictEqual(r.detalle[2].estado, 'fallido');
  assert(calls.some(u => /orders\/ML-111/.test(u)));
  assert.strictEqual(ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).reporte.length, 1);
  // orden invertido cuenta como fuera de orden
  SD['ML-222'][0].activityLog.deliveryTime = '2026-10-12T17:00:00Z';
  const r2 = ok(call('reporteRutas', { fecha: '2026-10-12' }, admin)).reporte[0];
  assert.strictEqual(r2.fuera_orden, 1);
  assert.strictEqual(ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).reporte[0].fuera_orden, 1);
  // la tarea automática no corre antes de la hora configurada
  const antes = env.mails.length;
  run('tareaReporteRutas');
  assert.strictEqual(env.mails.length, antes);
  maestro.getSheetByName('ConfigPortal').data.find(r => r[0] === 'RUTA_REPORTE_HORA')[1] = '0';
  run('tareaReporteRutas');
  assert.strictEqual(env.mails.length, antes + 1);
  assert(/Reporte de rutas 2026-10-12/.test(env.mails[env.mails.length - 1].s));
  run('tareaReporteRutas');
  assert.strictEqual(env.mails.length, antes + 1, 'solo una vez al día');
  const muestra = ok(call('shipdayMuestra', { shipment: 'ML-111' }, admin));
  assert(muestra.info.entregado && /ALREADY_DELIVERED/.test(muestra.crudo));
});


t('roles: patrón (super admin) ve todo; admin solo rutas y reporte; migración del No. 1', () => {
  ok(call('guardarPersona', { persona: { no_empleado: '4', rol: 'admin' } }, admin));
  const t4 = ok(call('login', { rfc: 'LOAS950505H12', pin: '204060' }));
  assert.strictEqual(t4.usuario.rol, 'admin');
  assert.strictEqual(ok(call('yo', {}, t4.token)).rol, 'admin');
  ok(call('rutasAdmin', { fecha: '2026-10-12' }, t4.token));
  ok(call('rutasConfig', {}, t4.token));
  fail(call('panel', {}, t4.token), /Sin permiso/);
  fail(call('prenomina', { periodo: '2026-10-1' }, t4.token), /Sin permiso/);
  fail(call('guardarClaves', { tomtom: 'BUENA' }, t4.token), /Sin permiso/);
  fail(call('guardarPersona', { persona: { no_empleado: '4', rol: 'patron' } }, t4.token), /Sin permiso/);
  fail(call('guardarPersona', { persona: { no_empleado: '1', rol: 'admin' } }, admin), /quitarte el rol de patrón/);
  ok(call('panel', {}, admin));
  // instalación anterior: nadie es patrón y el No. 1 tiene 'admin' → al entrar pasa a patrón
  const per = maestro.getSheetByName('Personal');
  const h = per.data[0], ci = h.indexOf('rol');
  const fila1 = per.data.find((r, i) => i > 0 && String(r[0]) === '1');
  fila1[ci] = 'admin';
  const s1 = ok(call('login', { rfc: 'GUPC900101AB1', pin: '482915' }));
  assert.strictEqual(s1.usuario.rol, 'patron');
  assert.strictEqual(fila1[ci], 'patron');
  ok(call('guardarPersona', { persona: { no_empleado: '4', rol: 'empleado' } }, s1.token));
});


t('seguimiento en vivo: Shipday cada 10 min, push a admins y recálculo de si acaban a tiempo', () => {
  const { ctx } = env;
  const calls = [];
  const resp = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj) });
  const SD = { 'ML-901': [{ orderId: 1, orderStatus: { orderState: 'STARTED' }, activityLog: {}, assignedCarrier: { name: 'Saidd Lopez' } }],
    'ML-902': [{ orderId: 2, orderStatus: { orderState: 'STARTED' }, activityLog: {} }], 'ML-903': [{ orderId: 3, orderStatus: { orderState: 'STARTED' }, activityLog: {} }] };
  let ttSec = 600;
  const fetchOne = (url, o) => {
    calls.push(url);
    if (/fcm\.googleapis/.test(url)) { env.pushes.push(JSON.parse(o.payload).message); return resp(200, {}); }
    if (/tomtom/.test(url)) return resp(200, { routes: [{ summary: { travelTimeInSeconds: ttSec, lengthInMeters: 5000 } }] });
    if (/shipday\.com\/orders\//.test(url)) { const n = decodeURIComponent(url.split('/orders/')[1]); return SD[n] ? resp(200, SD[n]) : resp(404, {}); }
    return resp(404, {});
  };
  ctx.UrlFetchApp = { fetch: fetchOne, fetchAll: reqs => reqs.map(r => fetchOne(r.url, r)) };
  ok(call('guardarPersona', { persona: { no_empleado: '5', rol: 'admin' } }, admin));
  const ruta = { no_empleado: '92', num: 1, total: 1, salida: '15:00', fin: '16:30', limite: '17:00', km: 10, deposito: [19.4182, -99.1369],
    paradas: [{ eta: '15:20', envios: ['901'], lat: 19.43, lng: -99.14, espera: 10 }, { eta: '15:50', envios: ['902'], lat: 19.45, lng: -99.15, espera: 10 },
      { eta: '16:20', envios: ['903'], lat: 19.47, lng: -99.16, espera: 10 }], geom: [] };
  ok(call('publicarRutas', { fecha: '2026-10-12', rutas: [ruta] }, admin));
  const rid = ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).rutas.find(r => r.no_empleado === '92').ruta_id;
  // 16:00: nada entregado aún, recálculo inicial desde la base (3 paradas: 10 min viaje + 30 min espera → 16:40, a tiempo)
  let r = ok(call('seguimientoAhora', {}, admin));
  let sg = ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).rutas.find(x => x.ruta_id === rid).seguimiento;
  assert.strictEqual(sg.pendientes, 3); assert.strictEqual(sg.estado, 'a_tiempo'); assert.strictEqual(sg.fin_estimado, '16:40'); assert.strictEqual(sg.limite, '17:00');
  // se entrega una y falla otra → un push con resumen a patrón y admin (#5)
  SD['ML-901'][0].orderStatus.orderState = 'ALREADY_DELIVERED'; SD['ML-901'][0].activityLog.deliveryTime = '2026-10-12T21:55:00Z';
  SD['ML-902'][0].orderStatus.orderState = 'FAILED_DELIVERY';
  const antes = env.pushes.length;
  ok(call('seguimientoAhora', {}, admin));
  const b5 = ok(call('bandeja', {}, ok(call('login', { rfc: 'RUCA990909MX1', pin: '135791' })).token));
  assert(/Ruta 1 · Jonatan: ✅ Entregó 901 \(parada 1\) · ❌ Fallido 902 \(parada 2\)/.test(b5[0].titulo), b5[0].titulo);
  assert(/Quedan 1 de 3/.test(b5[0].mensaje), b5[0].mensaje);
  sg = ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).rutas.find(x => x.ruta_id === rid).seguimiento;
  assert.strictEqual(sg.entregados, 1); assert.strictEqual(sg.fallidos, 1); assert.strictEqual(sg.pendientes, 1);
  // recálculo desde la parada 1 a las 16:00: 10 min + 10 espera = 16:20
  assert.strictEqual(sg.fin_estimado, '16:20');
  assert(calls.some(u => /calculateRoute\/19\.450000,-99\.150000:19\.470000,-99\.160000\//.test(u)), 'parte de la última parada visitada (el intento fallido)');
  // sin cambios: no hay push nuevo
  const n = env.pushes.length;
  ok(call('seguimientoAhora', {}, admin));
  assert.strictEqual(env.pushes.length, n);
  // con tráfico pesado ya no alcanza → alerta una sola vez
  ttSec = 3600 * 2;
  SD['ML-901'][0].activityLog.deliveryTime = '2026-10-12T21:55:00Z';
  ok(call('seguimientoAhora', {}, admin));
  sg = ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).rutas.find(x => x.ruta_id === rid).seguimiento;
  assert.strictEqual(sg.estado, 'tarde'); assert.strictEqual(sg.retraso_min, 70);
  const bP = ok(call('bandeja', {}, admin));
  assert(bP.some(x => /Ruta 1 \(Jonatan\) ya no alcanza/.test(x.titulo)));
  const det = ok(call('seguimientoRuta', { ruta_id: rid }, admin));
  assert.deepStrictEqual(det.paradas.map(p => p.envios[0].estado), ['entregado', 'fallido', 'pendiente']);
  assert.strictEqual(det.paradas[0].envios[0].hora, '15:55');
  // el trigger respeta el intervalo: recién revisado → no consulta Shipday
  const c0 = calls.filter(u => /shipday/.test(u)).length;
  run('tareaSeguimientoRutas');
  assert.strictEqual(calls.filter(u => /shipday/.test(u)).length, c0);
  // termina la ruta
  SD['ML-903'][0].orderStatus.orderState = 'ALREADY_DELIVERED'; SD['ML-903'][0].activityLog.deliveryTime = '2026-10-12T22:30:00Z';
  ok(call('seguimientoAhora', {}, admin));
  sg = ok(call('rutasAdmin', { fecha: '2026-10-12' }, admin)).rutas.find(x => x.ruta_id === rid).seguimiento;
  assert.strictEqual(sg.estado, 'terminada'); assert.strictEqual(sg.pendientes, 0); assert.strictEqual(sg.fin_estimado, '16:30');
  fail(call('seguimientoAhora', {}, tok4), /Sin permiso/);
  ok(call('guardarPersona', { persona: { no_empleado: '5', rol: 'empleado' } }, admin));
});

t('base única: Personal manda y Empleados del checador se llena solo', () => {
  const E = () => { const h = empleados.data[0]; return no => { const r = empleados.data.find(x => String(x[0]) === no); return r && Object.fromEntries(h.map((k, i) => [k, r[i] instanceof Date ? r[i].toISOString().slice(0, 10) : String(r[i] ?? '')])); }; };
  const per = () => maestro.getSheetByName('Personal');
  const P = no => { const h = per().data[0]; const r = per().data.find(x => String(x[0]) === no); return Object.fromEntries(h.map((k, i) => [k, r[i]])); };
  // 1) migración: horario del kiosco pasa a Personal
  run('sincronizarPersonal');
  assert.strictEqual(P('92').hora_entrada, '10:00');
  assert.strictEqual(P('92').dias_laborales, 'L,M,Mi,J,V,S');
  // 2) cambio en el portal → Empleados al momento
  ok(call('guardarPersona', { persona: { no_empleado: '92', hora_entrada: '9:30', dias_laborales: 'L,M,MI,J,V', minutos_comida: 45, checadas: 'ENTRADA,SALIDA' } }, admin));
  let e = E()('92');
  assert.deepStrictEqual([e['Hora de entrada'], e['Días laborales'], e['Minutos de comida'], e['Checadas']], ['9:30', 'L,M,Mi,J,V', '45', 'ENTRADA,SALIDA']);
  assert(e['Actualizado']);
  fail(call('guardarPersona', { persona: { no_empleado: '92', hora_entrada: '25:99' } }, admin), /Hora/);
  fail(call('guardarPersona', { persona: { no_empleado: '92', checadas: '' } }, admin), /checadas/);
  // el cálculo de asistencia usa el horario nuevo
  const a = ok(call('asistenciaDe', { no_empleado: '92', periodo: '2026-10-1' }, admin));
  assert.strictEqual(a.horario.entrada, '9:30');
  // la sincronización no regresa el valor viejo
  run('sincronizarPersonal');
  assert.strictEqual(E()('92')['Hora de entrada'], '9:30');
  // 3) alta desde el portal → aparece en el kiosco con checadas según puesto
  const n = ok(call('siguienteNumero', {}, admin));
  ok(call('guardarPersona', { persona: { no_empleado: n, nombre: 'Pedro Nuevo Ruiz', puesto: 'Repartidor', hora_entrada: '8:00', dias_laborales: 'L,M,Mi,J,V,S' } }, admin));
  e = E()(n);
  assert(e, 'se creó en Empleados');
  assert.strictEqual(e['Nombre'], 'Pedro Nuevo Ruiz');
  assert.strictEqual(e['Checadas'], 'ENTRADA,SALIDA_COMIDA,REGRESO_COMIDA');
  // 4) alguien cambia el nombre en el kiosco después → gana el kiosco
  const row = empleados.data.find(x => String(x[0]) === n);
  row[1] = 'Pedro Nuevo Ruiz Hernández';
  row[empleados.data[0].indexOf('Actualizado')] = '2099-01-01 10:00:00';
  run('sincronizarPersonal');
  assert.strictEqual(P(n).nombre, 'Pedro Nuevo Ruiz Hernández');
  // 5) baja en el kiosco (renglón borrado) no se vuelve a crear
  empleados.data.splice(empleados.data.indexOf(row), 1);
  run('sincronizarPersonal');
  assert(!E()(n));
});


t('operación: GPS de Shipday en prueba, recolecciones con aprobación y alcance de motos chicas', () => {
  const { ctx } = env;
  const calls = [];
  const resp = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj) });
  const hoyISO = '2026-10-12T15:00:00Z', ayerISO = '2026-10-11T15:00:00Z';
  let ORD = [
    { orderId: 101, orderNumber: 'RECOLECCION-1', restaurant: { name: 'Casfa', address: 'Calle A 1', latitude: 19.43, longitude: -99.14 }, assignedCarrierId: -1, activityLog: { placementTime: hoyISO } },
    { orderId: 102, orderNumber: '7788', restaurant: { name: 'Photurax Recolección', address: 'Calle B 2' }, assignedCarrierId: -1, activityLog: { placementTime: hoyISO } },
    { orderId: 103, orderNumber: 'ML-555', restaurant: { name: 'Tienda' }, assignedCarrierId: -1, activityLog: { placementTime: hoyISO } },
    { orderId: 104, orderNumber: 'RECOLECCION-4', restaurant: { name: 'Otro' }, assignedCarrierId: 11, activityLog: { placementTime: hoyISO } },
    { orderId: 105, orderNumber: 'RECOLECCION-5', restaurant: { name: 'Viejo' }, assignedCarrierId: -1, activityLog: { placementTime: ayerISO } },
  ];
  const fetchOne = (url, o = {}) => {
    calls.push((o.method || 'get') + ' ' + url);
    if (/fcm\.googleapis/.test(url)) { env.pushes.push(JSON.parse(o.payload).message); return resp(200, {}); }
    if (/shipday\.com\/carriers/.test(url)) return resp(200, [{ id: 11, name: 'Saidd', isOnShift: true, isActive: true, carrrierLocationLat: 19.44, carrrierLocationLng: -99.13 },
      { id: 44, name: 'Casandra', isOnShift: false, isActive: true, carrrierLocationLat: null, carrrierLocationLng: null }]);
    if (/shipday\.com\/orders\/assign\//.test(url)) return resp(204, {});
    if (/shipday\.com\/orders$/.test(url)) return resp(200, ORD);
    if (/tomtom/.test(url)) { const lejos = /19\.600000/.test(url); const avoid = /avoid=motorways/.test(url);
      return resp(200, { routes: [{ summary: { travelTimeInSeconds: (lejos ? (avoid ? 3600 : 1500) : (avoid ? 900 : 800)) }, sections: [] }] }); }
    return resp(404, {});
  };
  ctx.UrlFetchApp = { fetch: fetchOne, fetchAll: reqs => reqs.map(r => fetchOne(r.url, r)) };
  ctx.Maps = { newGeocoder: () => { const g = { setRegion: () => g, setLanguage: () => g, geocode: () => ({ results: [{ geometry: { location: { lat: 19.5, lng: -99.2 } } }] }) }; return g; } };
  ok(call('vincularShipday', { shipday_id: '11', no_empleado: '4' }, admin));
  ok(call('vincularShipday', { shipday_id: '44', no_empleado: '5' }, admin));
  ok(call('guardarPersona', { persona: { no_empleado: '5', puesto: 'Repartidora' } }, admin));

  // GPS: una muestra real y un análisis con paradas
  assert.strictEqual(ok(call('gpsAhora', {}, admin)).muestras, 1);
  const gl = maestro.getSheetByName('GpsLog');
  const T0 = new Date('2026-10-12T10:00:00-06:00').getTime();
  [[0, 19.4300, -99.1500], [5, 19.43001, -99.15002], [10, 19.43003, -99.14999], [20, 19.43002, -99.15001], [25, 19.45, -99.16], [30, 19.47, -99.17], [35, 19.47, -99.17], [40, 19.47, -99.17], [55, 19.47, -99.17]]
    .forEach(([m, la, lo]) => gl.appendRow([new Date(T0 + m * 60000), '77', '', 'Prueba', la, lo, 'SI']));
  const gp = ok(call('gpsPrueba', { fecha: '2026-10-12' }, admin));
  const pr = gp.repartidores.find(x => x.carrier_id === '77');
  assert.strictEqual(pr.paradas.length, 2);
  assert.deepStrictEqual(pr.paradas.map(x => [x.desde, x.min, x.tipo]), [['10:00', 20, 'detenido'], ['10:30', 25, 'sin_senal']]);
  assert.strictEqual(pr.max_congelado_min, 25);
  fail(call('gpsPrueba', {}, tok4), /Sin permiso/);

  // Recolecciones: solo las de hoy, sin asignar y con el texto
  const r1 = ok(call('recoleccionesBuscar', {}, admin));
  assert.strictEqual(r1.nuevas, 2); assert.strictEqual(r1.propuestas, 2); assert.strictEqual(r1.disponibles, 2);
  let v = ok(call('recolecciones', {}, admin));
  assert.strictEqual(v.recolecciones.length, 2);
  const ph = v.recolecciones.find(x => x.cliente === 'Photurax Recolección');
  assert.deepStrictEqual([ph.lat, ph.lng], [19.5, -99.2], 'geocodifica si Shipday no trae coordenadas');
  assert(v.clientes.some(c => c.cliente === 'Casfa' && c.volumen === ''));
  assert(env.pushes.length || ok(call('bandeja', {}, admin)).some(n => /por aprobar/.test(n.titulo)));
  // clasificar volumen actualiza la propuesta
  ok(call('clienteVolumen', { cliente: 'Casfa', volumen: 'alto' }, admin));
  v = ok(call('recolecciones', {}, admin));
  assert.strictEqual(v.recolecciones.find(x => x.cliente === 'Casfa').puntos, 3);
  // no se repite
  assert.strictEqual(ok(call('recoleccionesBuscar', {}, admin)).nuevas, 0);
  // cambiar a mano y aprobar todas → PUT en Shipday
  const casfa = v.recolecciones.find(x => x.cliente === 'Casfa');
  ok(call('recoleccionCambiar', { rec_id: casfa.rec_id, no_empleado: '5' }, admin));
  const ap = ok(call('recoleccionAprobar', { todas: true }, admin));
  assert.strictEqual(ap.asignadas, 2);
  assert(calls.some(c => c === 'put https://api.shipday.com/orders/assign/101/44'), calls.filter(c => /assign/.test(c)).join(' | '));
  v = ok(call('recolecciones', {}, admin));
  assert(v.recolecciones.every(x => x.estado === 'asignada'));
  assert.strictEqual(v.disponibles.find(d => d.no_empleado === '5').puntos, 3);
  // capacidad: nadie puede con otro volumen alto si el tope es 3
  maestro.getSheetByName('ConfigPortal').data.find(r => r[0] === 'RECOLECCION_CAPACIDAD')[1] = '3';
  ORD = ORD.concat([{ orderId: 106, orderNumber: 'RECOLECCION-6', restaurant: { name: 'Casfa', address: 'Calle A 1', latitude: 19.43, longitude: -99.14 }, assignedCarrierId: -1, activityLog: { placementTime: hoyISO } }]);
  ORD[0].assignedCarrierId = 44; ORD[1].assignedCarrierId = 11;
  const r3 = ok(call('recoleccionesBuscar', {}, admin));
  assert.strictEqual(r3.nuevas, 1); assert.strictEqual(r3.problemas, 1);
  assert.strictEqual(ok(call('recolecciones', {}, admin)).recolecciones.find(x => x.order_number === 'RECOLECCION-6').estado, 'sin_capacidad');
  maestro.getSheetByName('ConfigPortal').data.find(r => r[0] === 'RECOLECCION_CAPACIDAD')[1] = '6';

  // Motos chicas: punto cercano OK, punto lejano solo por autopista → no apto; segunda vez sale de la caché
  const al = ok(call('alcanceMotoChica', { puntos: [[19.43, -99.14], [19.6, -99.05]] }, admin));
  assert.deepStrictEqual(al.puntos.map(x => x.ok), [true, false]);
  assert.strictEqual(al.puntos[1].motivo, 'rodeo_sin_autopista');
  assert.strictEqual(ok(call('alcanceMotoChica', { puntos: [[19.43, -99.14], [19.6, -99.05]] }, admin)).consultas, 0);
  // proxy TomTom evita autopistas en rutas de moto chica
  ok(call('guardarClaves', { tomtom: '-' }, admin));
});

t('historial de entregas, jerarquía, asistencia para el ruteador y alertas de GPS e inactividad', () => {
  const { ctx } = env;
  const calls = [];
  const resp = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj) });
  const ord = (id, st, car, t, extra) => Object.assign({ orderId: id, orderNumber: 'ML-' + id, assignedCarrier: car ? { id: car, name: 'C' + car } : null, assignedCarrierId: car || -1,
    orderStatus: { orderState: st }, activityLog: st === 'ALREADY_DELIVERED' ? { placementTime: '2026-10-01T10:00:00Z', deliveryTime: t } : { placementTime: '2026-10-01T10:00:00Z' }, failedDeliveryTime: st !== 'ALREADY_DELIVERED' ? t : undefined }, extra || {});
  const Q = { ALREADY_DELIVERED: [], FAILED_DELIVERY: [], INCOMPLETE: [] };
  let id = 1000;
  for (let i = 0; i < 30; i++) Q.ALREADY_DELIVERED.push(ord(id++, 'ALREADY_DELIVERED', 11, '2026-10-12T17:00:00Z'));
  for (let i = 0; i < 2; i++) Q.FAILED_DELIVERY.push(ord(id++, 'FAILED_DELIVERY', 11, '2026-10-12T18:00:00Z'));
  for (let i = 0; i < 10; i++) Q.ALREADY_DELIVERED.push(ord(id++, 'ALREADY_DELIVERED', 44, '2026-10-12T19:00:00Z'));
  for (let i = 0; i < 50; i++) Q.ALREADY_DELIVERED.push(ord(id++, 'ALREADY_DELIVERED', 44, '2026-10-05T19:00:00Z'));
  for (let i = 0; i < 10; i++) Q.ALREADY_DELIVERED.push(ord(id++, 'ALREADY_DELIVERED', 44, '2026-10-06T19:00:00Z'));
  for (let i = 0; i < 5; i++) Q.ALREADY_DELIVERED.push(ord(id++, 'ALREADY_DELIVERED', 99, '2026-10-12T19:00:00Z'));
  Q.ALREADY_DELIVERED.push(ord(id++, 'ALREADY_DELIVERED', 11, '2026-10-12T19:00:00Z', { orderNumber: 'RECOLECCION-77' }));
  Q.ALREADY_DELIVERED.push(ord(id++, 'ALREADY_DELIVERED', 11, '2026-09-20T19:00:00Z')); // fuera del rango pedido
  Q.INCOMPLETE.push(ord(id++, 'INCOMPLETE', 44, '2026-10-12T20:00:00Z'));
  let pos = { 11: [19.4300, -99.1400], 44: [19.4182, -99.1369] };
  const fetchOne = (url, o = {}) => {
    calls.push(url);
    if (/fcm\.googleapis/.test(url)) { env.pushes.push(JSON.parse(o.payload).message); return resp(200, {}); }
    if (/shipday\.com\/orders\/query/.test(url)) { const b = JSON.parse(o.payload); assert(/Z$/.test(b.startTime)); const l = Q[b.orderStatus] || []; return resp(200, l.slice(b.startCursor - 1, b.endCursor)); }
    if (/shipday\.com\/carriers/.test(url)) return resp(200, Object.keys(pos).map(k => ({ id: +k, name: 'C' + k, isOnShift: true, isActive: true, carrrierLocationLat: pos[k][0], carrrierLocationLng: pos[k][1] })));
    if (/shipday\.com\/orders\//.test(url)) return resp(200, [{ orderId: 1, orderStatus: { orderState: 'STARTED' }, activityLog: {} }]);
    if (/tomtom/.test(url)) return resp(200, { routes: [{ summary: { travelTimeInSeconds: 600 } }] });
    return resp(404, {});
  };
  ctx.UrlFetchApp = { fetch: fetchOne, fetchAll: reqs => reqs.map(r => fetchOne(r.url, r)) };
  // 1) Historial desde Shipday
  fail(call('historialActualizar', { desde: '2026-09-01', hasta: '2026-10-12' }, admin), /31 días/);
  const h = ok(call('historialActualizar', { desde: '2026-10-01', hasta: '2026-10-12' }, admin));
  assert.strictEqual(h.entregados, 105, JSON.stringify(h)); assert.strictEqual(h.sin_vincular, 1);
  assert(calls.filter(u => /orders\/query/.test(u)).length >= 4, 'pagina de 100 en 100');
  // recalcular no duplica
  ok(call('historialActualizar', { desde: '2026-10-12', hasta: '2026-10-12' }, admin));
  const v = ok(call('historialEntregas', { fecha: '2026-10-12' }, admin));
  const r4 = v.repartidores.find(x => x.no_empleado === '4'), r5 = v.repartidores.find(x => x.no_empleado === '5');
  assert.deepStrictEqual([r4.dia.ent, r4.dia.fal, r4.dia.pct], [30, 2, 93.8]);
  assert.deepStrictEqual([r5.dia.ent, r5.dia.fal, r5.semana.ent, r5.mes.ent], [10, 1, 10, 70]);
  assert.deepStrictEqual(v.semana, ['2026-10-12', '2026-10-18']); assert.deepStrictEqual(v.mes, ['2026-10-01', '2026-10-31']);
  assert(v.repartidores.some(x => !x.vinculado && x.carrier_ids === '99' && x.dia.ent === 5));
  // jerarquía: Casandra (60 entregas, 98%) arriba de Saidd (30, 94%)
  assert.strictEqual(r5.jerarquia.rank, 1); assert.strictEqual(r4.jerarquia.rank, 2);
  assert(v.repartidores.indexOf(r5) < v.repartidores.indexOf(r4));
  const yo = ok(call('desempeno', { fecha: '2026-10-12' }, tok4));
  assert.deepStrictEqual([yo.dia.ent, yo.jerarquia.rank, yo.jerarquia.de], [30, 2, 2]);
  fail(call('historialEntregas', {}, tok4), /Sin permiso/);
  // trigger: a las 16:00 cierra ayer una sola vez
  const n0 = calls.length; run('tareaReporteRutas'); assert(calls.length > n0); const n1 = calls.length; run('tareaReporteRutas');
  assert.strictEqual(calls.filter((u, i) => i >= n1 && /orders\/query/.test(u)).length, 0);
  // 2) Ruteador: asistencia del checador, casa, moto y jerarquía
  ok(call('guardarPersona', { persona: { no_empleado: '4', moto_tipo: 'chica' } }, admin));
  fail(call('guardarPersona', { persona: { no_empleado: '4', moto_tipo: 'mediana' } }, admin), /moto/);
  let rc = ok(call('rutasConfig', { fecha: '2026-10-12' }, admin));
  const e4 = rc.empleados.find(x => x.no_empleado === '4');
  assert.deepStrictEqual(e4.asistencia, { estado: 'presente', entrada: '9:05' });
  assert.deepStrictEqual(e4.casa, [19.4201, -99.1402]); assert.strictEqual(e4.moto_tipo, 'chica'); assert.strictEqual(e4.rango.rank, 2);
  assert.strictEqual(rc.empleados.find(x => x.no_empleado === '92').asistencia.estado, 'sin_checar');
  rc = ok(call('rutasConfig', { fecha: '2026-10-13' }, admin));
  assert.strictEqual(rc.empleados.find(x => x.no_empleado === '4').asistencia.estado, 'programado');
  assert.strictEqual(rc.empleados.find(x => x.no_empleado === '4').casa[0], 19.4201);
  // 3) Producción: fuera de ruta (2 muestras seguidas a más de 800 m) y 1 h sin entregar
  const ruta = { no_empleado: '4', sugerido: '5', num: 1, total: 1, salida: '14:30', fin: '17:30', limite: '19:00', km: 12, deposito: [19.4182, -99.1369],
    geom: [[19.4182, -99.1369], [19.4300, -99.1400], [19.4500, -99.1500]],
    paradas: [{ eta: '14:50', envios: ['7001'], lat: 19.43, lng: -99.14, espera: 10 }, { eta: '15:30', envios: ['7002'], lat: 19.45, lng: -99.15, espera: 10 }] };
  ok(call('publicarRutas', { fecha: '2026-10-12', rutas: [ruta] }, admin));
  const filaR = () => { const sh = maestro.getSheetByName('Rutas'); const hh = sh.data[0]; const r = sh.data.filter(x => x[hh.indexOf('estatus')] === 'activa').pop(); return Object.fromEntries(hh.map((k, i) => [k, r[i]])); };
  assert.strictEqual(filaR().sugerido, '5'); assert.strictEqual(filaR().aprobado_por, '1');
  const alertas = () => ok(call('bandeja', {}, admin)).filter(x => /se salió de su ruta/.test(x.titulo));
  let g = ok(call('gpsAhora', {}, admin));
  assert.strictEqual(g.desvios, 0); assert.strictEqual(JSON.parse(filaR().gps_json).d, 0);
  pos[11] = [19.4800, -99.2000];   // ~6 km fuera
  assert.strictEqual(ok(call('gpsAhora', {}, admin)).desvios, 0, 'una sola muestra no basta');
  assert.strictEqual(ok(call('gpsAhora', {}, admin)).desvios, 1);
  assert.strictEqual(ok(call('gpsAhora', {}, admin)).desvios, 0, 'no se repite');
  const al = alertas();
  assert.strictEqual(al.length, 1); assert(/Ruta 1 · Saidd se salió/.test(al[0].titulo)); assert(/km del recorrido/.test(al[0].mensaje) && /maps\.google\.com/.test(al[0].mensaje), al[0].mensaje);
  // regresa a la ruta y vuelve a salirse → nuevo aviso
  pos[11] = [19.4400, -99.1450]; ok(call('gpsAhora', {}, admin));
  assert.strictEqual(JSON.parse(filaR().gps_json).a, 0);
  // en la comida no cuenta
  checadas.data.push(['u', D('2026-10-12'), '15:50:00', '4', '', 'SALIDA A COMER', '', 'Ipad', '', '', '', '']);
  pos[11] = [19.4800, -99.2000]; ok(call('gpsAhora', {}, admin)); ok(call('gpsAhora', {}, admin));
  assert.strictEqual(alertas().length, 1);
  checadas.data.pop();
  const gp = ok(call('gpsPrueba', { fecha: '2026-10-12' }, admin));
  assert.strictEqual(gp.modo, 'produccion'); assert(gp.alertas.find(a => a.num === 1));
  // inactividad: 1ª parada ~14:50 y son las 16:00 sin entregas → aviso una vez
  ok(call('seguimientoAhora', {}, admin));
  const ina = ok(call('bandeja', {}, admin)).filter(x => /sin entregar/.test(x.titulo));
  assert.strictEqual(ina.length, 1, JSON.stringify(ina)); assert(/Ruta 1 · Saidd lleva 1:10 h sin entregar/.test(ina[0].titulo), ina[0].titulo);
  assert(/No ha entregado nada/.test(ina[0].mensaje) && /GPS:/.test(ina[0].mensaje), ina[0].mensaje);
  ok(call('seguimientoAhora', {}, admin));
  assert.strictEqual(ok(call('bandeja', {}, admin)).filter(x => /sin entregar/.test(x.titulo)).length, 1);
  // apagado: no muestrea ni avisa
  maestro.getSheetByName('ConfigPortal').data.find(r => r[0] === 'GPS_MODO')[1] = 'apagado';
  const c0 = calls.filter(u => /carriers/.test(u)).length; run('tareaOperacion5');
  assert.strictEqual(calls.filter(u => /carriers/.test(u)).length, c0);
  maestro.getSheetByName('ConfigPortal').data.find(r => r[0] === 'GPS_MODO')[1] = 'produccion';
});

t('nómina histórica: sin firma, sin duplicados, ex-empleados como baja', () => {
  const recPer = ok(call('recibo', { recibo_id: rec4.recibo_id }, tok4)).periodo;
  const pushes0 = env.pushes.length;
  const d = {
    personas: [{ no: '4', nombre: 'Saidd' }, { no: '77', nombre: 'Ex Empleado' }],
    salarios: { '77': 314.75, '4': 999 }, config: { DIAS_QUINCENA: 15.25 },
    recibos: [
      { no: '4', periodo: '2024-03-1', etiqueta: '1ª quincena de marzo 2024', desde: '2024-03-01', hasta: '2024-03-15', neto: 5500 },
      { no: '4', periodo: recPer, etiqueta: 'x', desde: '2026-01-01', hasta: '2026-01-15', neto: 1 },
      { no: '4', periodo: 'AGU-2024', etiqueta: 'Aguinaldo 2024', desde: '2024-12-01', hasta: '2024-12-20', neto: 3000, tipo: 'aguinaldo' },
      { no: '77', periodo: '2023-01-2', etiqueta: '2ª quincena de enero 2023', desde: '2023-01-16', hasta: '2023-01-31', neto: 4800 },
      { no: '999', periodo: '2023-01-2', etiqueta: 'y', desde: '2023-01-16', hasta: '2023-01-31', neto: 1 },
    ],
  };
  const r = run('importarHistorico_', d);
  assert.strictEqual(r.recibos, 3); assert.strictEqual(r.personas_nuevas, 1);
  assert.strictEqual(r.duplicados.length, 1); assert.strictEqual(JSON.stringify(r.sin_persona), '["999|2023-01-2"]');
  assert.strictEqual(r.salarios, 1, 'no pisa salario existente');
  assert.strictEqual(run('importarHistorico_', d).recibos, 0, 'segunda corrida no duplica');
  const c = run('expandirHistorico_', { q: { '4': { '2024-03-2': 10, 'AGU-2023': 5 } } });
  assert.strictEqual(c.recibos[0].hasta, '2024-03-31'); assert.strictEqual(c.recibos[1].etiqueta, 'Aguinaldo 2023');
  assert.strictEqual(env.pushes.length, pushes0, 'sin push');
  const l = ok(call('recibos', {}, tok4));
  const h = l.find(x => x.periodo === '2024-03-1');
  assert(h.historico && h.estatus === 'historico' && h.neto === 5500);
  assert.strictEqual(l.find(x => x.periodo === 'AGU-2024').etiqueta, 'Aguinaldo 2024');
  fail(call('firmarRecibo', { recibo_id: h.recibo_id, pin: '204060' }, tok4), /históricos no se firman/);
  assert.strictEqual(ok(call('inicio', {}, tok4)).recibos_sin_firmar, 0);
  const p77 = ok(call('personal', {}, admin)).find(p => p.no_empleado === '77');
  assert.strictEqual(p77.estatus, 'baja');
  fail(call('login', { rfc: '', no_empleado: '77' }), /./);
});

console.log(`\n${passed} pruebas OK`);

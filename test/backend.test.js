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
    ['R-000001', 'F-000001', 'M-02', 'U-003', D('2026-10-09'), D('2026-10-10'), 2, 5, 'Cambio de espejo', '', '', '', '', 350, 0, 350, 'mal_uso', 'U-005', 350, 0, 'SI'],
    ['R-000002', 'F-000002', 'M-03', 'U-003', D('2026-10-09'), D('2026-10-10'), 2, 5, 'Balatas', '', '', '', '', 500, 0, 500, 'desgaste', 'U-005', 0, 500, '']]),
  Fallas: new Sheet('Fallas', [['falla_id', 'tipo', 'check_id', 'fecha_reporte', 'reportada_por', 'responsable_id', 'vehiculo_id', 'descripcion'],
    ['F-000001', 'no_reportado', '', D('2026-10-09'), 'U-005', 'U-005', 'M-02', 'Espejo izquierdo roto']]),
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
  assert.strictEqual(maestro.getSheetByName('Personal').data[1][7], 'admin'); // #1 es admin
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
  assert.strictEqual(s.usuario.rol, 'admin');
  admin = s.token;
  fail(call('primerAcceso', { rfc: 'GUPC900101AB1', no_empleado: '1', pin: '482915' }), /ya tiene PIN/);
  assert.strictEqual(ok(call('estadoRfc', { rfc: 'GUPC900101AB1' })).estado, 'activo');
  admin = ok(call('login', { rfc: 'GUPC-900101-AB1', pin: '482915' })).token;
});

t('patrón edita expedientes; valida CLABE y RFC', () => {
  fail(call('guardarPersona', { persona: { no_empleado: '4', clabe: '012180015237752340' } }, admin), CLABE4.endsWith('0') ? /x^/ : /CLABE/);
  ok(call('guardarPersona', { persona: { no_empleado: '4', rfc: 'LOAS950505H12', clabe: CLABE4, salario_diario: 320, puesto: 'Repartidor' } }, admin));
  ok(call('guardarPersona', { persona: { no_empleado: '5', rfc: 'RUCA990909MX1', clabe: CLABE5, salario_diario: 300, flotilla_id: 'U-005', puesto: 'Repartidora' } }, admin));
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
  assert.deepStrictEqual(b.pasos.map(x => x.id), ['acceso', 'documentos', 'apps', 'checador', 'notificaciones']);
  assert.deepStrictEqual(b.pasos.map(x => x.hecho), [true, false, false, false, true]); // ya registró push antes
  b = ok(call('marcarDocs', {}, tok4));
  assert(b.pasos[1].hecho);
  const apps = ok(call('apps', {}, tok4));
  assert(apps.find(a => a.app_id === 'packatelas' && a.tipo === 'apk'));
  for (const a of apps.filter(a => a.requerida)) b = ok(call('marcarApp', { app_id: a.app_id }, tok4));
  assert(b.pasos[2].hecho);
  b = ok(call('marcarApp', { app_id: 'zello', lista: false }, tok4));
  assert(!b.pasos[2].hecho && b.pasos[2].faltan[0] === 'Zello');
  // checador: registrar celular en Empleados
  empleados.data.find(r => r[0] === '4')[3] = 'cred-xyz';
  ok(call('marcarApp', { app_id: 'zello' }, tok4));
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
  assert(/forms\.gle/.test(ok(call('configPublica', {})).form_documentos));
});

console.log(`\n${passed} pruebas OK`);

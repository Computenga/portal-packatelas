// Datos simulados para ver la app sin backend: abre index.html?demo
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = new Date();
const hoy = iso(HOY);
const ahora = () => `${hoy} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function periodo(id) {
  const [y, m, q] = id.split('-').map(Number);
  const ult = new Date(y, m, 0).getDate();
  return { id, desde: `${y}-${pad(m)}-${q === 1 ? '01' : '16'}`, hasta: `${y}-${pad(m)}-${q === 1 ? '15' : ult}`, etiqueta: `${q === 1 ? '1ª' : '2ª'} quincena de ${MESES[m - 1]} ${y}` };
}
const perDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${d.getDate() <= 15 ? 1 : 2}`;
const PER = perDe(HOY);
const ANT = (() => { const p = periodo(PER); const d = new Date(p.desde + 'T12:00'); d.setDate(d.getDate() - 1); return perDe(d); })();


const RUTA_DEMO = { ruta_id: 'RT-000001', fecha: hoy, num: 1, total: 2, salida: '10:00', fin: '13:05', km: 31.4, envios: 7, color: '#e4572e', deposito: [19.4182, -99.1369], estatus: 'activa',
  paradas: [
    { orden: 1, eta: '10:22', envios: ['48243897333'], ref: 'Norma Cruz', dir: 'Calle Norte 54 3831, Gustavo A. Madero, CP 07858', lat: 19.46311, lng: -99.116743, espera: 10, tipo: 'same_day' },
    { orden: 2, eta: '10:51', envios: ['48244095998'], ref: 'Carlos Ramirez', dir: 'Calle Grupo de Los Cien Lt 1377, Tlalnepantla de Baz, CP 54189', lat: 19.540453, lng: -99.116717, espera: 10, tipo: 'same_day' },
    { orden: 3, eta: '11:14', envios: ['48240481351', '48240481352'], ref: 'Karla Paola Reyes', dir: 'Avenida Benito Juárez 77, Tlalnepantla de Baz, CP 54100', lat: 19.53435, lng: -99.158847, espera: 12, tipo: 'next_day' },
    { orden: 4, eta: '11:58', envios: ['48243469169'], ref: 'Luis Fernando Arriaga', dir: 'Calle Vía José López Portillo 41, Coacalco, CP 55700', lat: 19.636277, lng: -99.107174, espera: 10, tipo: 'next_day' },
    { orden: 5, eta: '12:31', envios: ['48243941372'], ref: 'Miguel Morales', dir: 'Calle Colina de Mocuzari 55, Naucalpan, CP 53140', lat: 19.495185, lng: -99.244847, espera: 10, tipo: 'next_day' },
    { orden: 6, eta: '12:55', envios: ['48239696517'], ref: 'María Concepción Bautista', dir: 'Calle Ignacio López Rayón Mz4 Lt32, Chimalhuacán, CP 56340', lat: 19.403525, lng: -98.973793, espera: 10, tipo: 'next_day' },
  ], geom: [] };
const REPORTE_DEMO = [
  { ruta_id: 'RT-000001', no_empleado: '4', nombre: 'Saidd Argenis López', envios: 7, entregados: 7, no_entregados: 0, en_orden: 6, fuera_orden: 0, pct_orden: 100, tarde: 0, retraso_prom: 3, fin_plan: '13:05', fin_real: '12:58', otros_repartidores: '', calificacion: 'Bien', generado: hoy + ' 22:00',
    detalle: [{ o: 1, eta: '10:22', real: '10:25', dif: 3, estado: 'entregado', envios: 1, entregados: 1 }, { o: 2, eta: '10:51', real: '10:49', dif: -2, estado: 'entregado', envios: 1, entregados: 1 }, { o: 3, eta: '11:14', real: '11:20', dif: 6, estado: 'entregado', envios: 2, entregados: 2 }] },
  { ruta_id: 'RT-000002', no_empleado: '92', nombre: 'Jonatan Ortega', envios: 7, entregados: 5, no_entregados: 2, en_orden: 3, fuera_orden: 2, pct_orden: 60, tarde: 2, retraso_prom: 28, fin_plan: '13:30', fin_real: '14:45', otros_repartidores: 'Angel Campos', calificacion: 'Mal', generado: hoy + ' 22:00',
    detalle: [{ o: 1, eta: '10:30', real: '11:40', dif: 70, estado: 'entregado', envios: 1, entregados: 1 }, { o: 2, eta: '10:55', real: '10:41', dif: -14, estado: 'entregado', envios: 1, entregados: 1 }, { o: 3, eta: '11:20', real: '', dif: null, estado: 'fallido', envios: 1, entregados: 0 }] },
];

const personal = [
  { no_empleado: '1', nombre: 'Cristhian Michel Guevara Padilla', rfc: 'GUPC900101AB1', puesto: 'Director', rol: 'patron', salario_diario: 0, clabe: '', entrada: '', dias: '', pin: '482915' },
  { no_empleado: '4', nombre: 'Saidd Argenis López', rfc: 'LOAS950505H12', puesto: 'Repartidor', rol: 'empleado', salario_diario: 320, clabe: '012180015237752341', entrada: '9:00', dias: 'L,M,Mi,J,V,S', flotilla_id: 'U-004', ingreso: '2025-03-10', pin: '482915' },
  { no_empleado: '5', nombre: 'Casandra Alicia Ruiz', rfc: 'RUCA990909MX1', puesto: 'Almacén', rol: 'empleado', salario_diario: 300, clabe: '127180017550284489', entrada: '9:00', dias: 'L,M,Mi,J,V,S', ingreso: '2024-08-01', pin: '' },
  { no_empleado: '52', nombre: 'Diego Mendoza', rfc: '', puesto: 'Repartidor', rol: 'empleado', salario_diario: 300, clabe: '', entrada: '10:00', dias: 'L,M,Mi,J,V,S', flotilla_id: 'U-004' },
  { no_empleado: '75', nombre: 'Michell Saucedo', rfc: 'SAMI000312HD5', puesto: 'Repartidor', rol: 'empleado', salario_diario: 300, clabe: '012180015246296076', entrada: '10:00', dias: 'L,M,Mi,J,V,S', flotilla_id: 'U-005', pin: '1' },
  { no_empleado: '92', nombre: 'Jonatan Ortega', rfc: 'OEJO010101H11', puesto: 'Repartidor', rol: 'empleado', salario_diario: 300, clabe: '012180015039708386', entrada: '10:00', dias: 'L,M,Mi,J,V,S', pin: '1' },
  { no_empleado: '43', nombre: 'Natividad', rfc: '', puesto: 'Limpieza', rol: 'empleado', salario_diario: 0, clabe: '', entrada: '', dias: '' },
];

// asistencia sintética determinista
function hash(s) { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; }
function asistencia(no, perId) {
  const p = personal.find(x => x.no_empleado === no);
  const per = periodo(perId);
  const dias = [];
  const t = { dias_laborales: 0, asistencias: 0, faltas: 0, justificadas: 0, retardos: 0, min_tarde: 0, retardos_comida: 0, min_comida_extra: 0, min_total: 0 };
  const sinHorario = !p.entrada;
  for (let d = new Date(per.desde + 'T12:00'); iso(d) <= per.hasta; d.setDate(d.getDate() + 1)) {
    const f = iso(d), dow = d.getDay(), r = hash(no + f) % 100;
    const x = { fecha: f, dia: DIAS[dow], laboral: !sinHorario && dow !== 0, marcas: [], entrada: '', debia: p.entrada, min_tarde: 0, min_comida: null, min_comida_extra: 0, estado: '' };
    if (f > hoy) x.estado = 'FUTURO';
    else if (sinHorario) x.estado = 'SIN_HORARIO';
    else if (dow === 0) x.estado = 'DESCANSO';
    else {
      t.dias_laborales++;
      if (r < 6 && f !== hoy) { x.estado = 'FALTA'; t.faltas++; }
      else if (r < 9 && f !== hoy) { x.estado = 'JUSTIFICADA'; x.motivo = 'Cita médica'; t.justificadas++; }
      else {
        const [hh] = p.entrada.split(':').map(Number);
        const late = r > 78 ? (r % 17) + 1 : 0;
        const em = hh * 60 - 4 + (r % 5) + (late ? 4 + late : 0);
        x.entrada = `${Math.floor(em / 60)}:${pad(em % 60)}`;
        x.marcas.push({ tipo: 'ENTRADA', hora: x.entrada });
        x.min_tarde = late;
        if (f !== hoy || new Date().getHours() > 16) {
          const extra = r % 9 === 0 ? 12 : 0;
          x.min_comida = 60 + extra; x.min_comida_extra = extra;
          x.marcas.push({ tipo: 'SALIDA_COMIDA', hora: '14:00' }, { tipo: 'REGRESO_COMIDA', hora: `15:${pad(extra)}` });
          if (extra) { t.retardos_comida++; t.min_comida_extra += extra; }
        }
        t.asistencias++;
        if (late) { t.retardos++; t.min_tarde += late; }
        x.estado = late || x.min_comida_extra ? 'RETARDO' : 'A_TIEMPO';
      }
    }
    dias.push(x);
  }
  t.min_total = t.min_tarde + t.min_comida_extra;
  t.horas_retraso = Math.round(t.min_total / 60 * 100) / 100;
  t.horas_faltas = t.faltas * 8;
  t.horas_descuento = Math.round((t.horas_retraso + t.horas_faltas) * 100) / 100;
  return { no_empleado: no, nombre: p.nombre, periodo: per, horario: sinHorario ? null : { entrada: p.entrada, dias: p.dias, comida: 60 }, sin_horario: sinHorario, cuenta_desde: per.desde, dias, totales: t };
}

let seq = 100;
const recibos = [];
const pagos = [];
const solicitudes = [
  { sol_id: 'SOL-00003', no_empleado: '92', nombre: 'Jonatan Ortega', tipo: 'justificante', tipo_txt: 'Justificante de falta', fecha_desde: hoy, fecha_hasta: hoy, dias: 1, monto: 0, motivo: 'Me llamaron de la escuela de mi hijo', evidencia: 'x', estatus: 'pendiente', fecha_solicitud: ahora() },
  { sol_id: 'SOL-00002', no_empleado: '4', nombre: 'Saidd Argenis López', tipo: 'vacaciones', tipo_txt: 'Vacaciones', fecha_desde: '2026-12-21', fecha_hasta: '2026-12-24', dias: 4, monto: 0, motivo: 'Viaje familiar', estatus: 'pendiente', fecha_solicitud: ahora() },
  { sol_id: 'SOL-00001', no_empleado: '4', nombre: 'Saidd Argenis López', tipo: 'justificante', tipo_txt: 'Justificante de falta', fecha_desde: periodo(ANT).desde, fecha_hasta: periodo(ANT).desde, dias: 1, monto: 0, motivo: 'Consulta IMSS', estatus: 'aprobada', fecha_solicitud: periodo(ANT).desde + ' 10:12', comentario: 'Ok, trae tu comprobante', fecha_resolucion: periodo(ANT).desde + ' 12:40', resuelta_por: 'Cristhian' },
];
const adeudos = [{ adeudo_id: 'AD-00001', no_empleado: '4', nombre: 'Saidd Argenis López', concepto: 'Préstamo', monto_total: 2000, cuota: 250, saldo: 1250, fecha_alta: '2026-08-15', estatus: 'activo', origen: 'RH' }];
const cargos = [{ rep_id: 'R-000004', vehiculo_id: 'M-02', responsable_id: 'U-004', descripcion: 'Espejo izquierdo roto (no reportado en check matutino)', fecha: hoy, monto: 350, costo_total: 350, causa: 'mal_uso' }];
const bandeja = [];
const dispositivos = new Set(['1', '75']);
function notificar(no, tipo, titulo, mensaje, ref) { bandeja.unshift({ notif_id: 'N-' + (++seq), fecha: ahora(), no_empleado: no, tipo, titulo, mensaje, ref, leido: false }); }

function prenomina(perId) {
  const per = periodo(perId);
  return { periodo: per, filas: personal.map(p => {
    const a = asistencia(p.no_empleado, perId).totales;
    const sd = p.salario_diario;
    const cg = p.flotilla_id ? cargos.filter(c => c.responsable_id === p.flotilla_id && !c.cobrado) : [];
    const ab = adeudos.filter(x => x.no_empleado === p.no_empleado && x.estatus === 'activo').map(x => ({ adeudo_id: x.adeudo_id, concepto: x.concepto, monto: Math.min(x.cuota, x.saldo), saldo: x.saldo }));
    const f = { no_empleado: p.no_empleado, nombre: p.nombre, puesto: p.puesto, salario_diario: sd, dias: 15, sin_salario: !sd, sin_clabe: !p.clabe, sin_horario: !p.entrada, asistencia: a,
      sueldo: sd * 15, bonos: 0, otras_percepciones: 0, desc_faltas: a.faltas * sd, desc_retardos: Math.round(a.horas_retraso * sd / 8 * 100) / 100,
      desc_cargos: cg.reduce((s, c) => s + c.monto, 0), desc_adeudos: ab.reduce((s, x) => s + x.monto, 0), otras_deducciones: 0, cargos: cg, abonos: ab,
      recibo_existente: (r => r ? { recibo_id: r.recibo_id, neto: r.neto, estatus: r.estatus } : null)(recibos.find(r => r.no_empleado === p.no_empleado && r.periodo === perId && r.estatus !== 'cancelado')) };
    return tot(f);
  }) };
}
function tot(f) {
  f.total_percepciones = f.sueldo + f.bonos + f.otras_percepciones;
  f.total_deducciones = f.desc_faltas + f.desc_retardos + f.desc_cargos + f.desc_adeudos + f.otras_deducciones;
  f.neto = Math.max(0, Math.round((f.total_percepciones - f.total_deducciones) * 100) / 100);
  return f;
}
function emitir(perId, filas) {
  const per = periodo(perId);
  return filas.map(f => {
    const r = { ...tot({ ...f }), recibo_id: 'REC-' + String(++seq).padStart(6, '0'), periodo: perId, etiqueta: per.etiqueta, desde: per.desde, hasta: per.hasta,
      detalle: { asistencia: f.asistencia, cargos: f.cargos, abonos: f.abonos, notas: f.notas || '', concepto_bonos: f.concepto_bonos || '' },
      estatus: 'emitido', fecha_emision: ahora(), firma_fecha: '', pago_id: '', fecha_pago: '' };
    recibos.unshift(r);
    (f.cargos || []).forEach(c => { const x = cargos.find(y => y.rep_id === c.rep_id); if (x) x.cobrado = r.recibo_id; });
    notificar(f.no_empleado, 'recibo', '🧾 Tu recibo de nómina está listo', `${per.etiqueta}: neto $${r.neto.toLocaleString('es-MX')}. Ábrelo para revisarlo y firmarlo.`, r.recibo_id);
    return r;
  });
}
// Historial: recibo de la quincena anterior pagado y firmado para Saidd y Michell
(() => {
  const pre = prenomina(ANT).filas.filter(f => ['4', '75', '92'].includes(f.no_empleado));
  emitir(ANT, pre).forEach(r => {
    r.fecha_emision = periodo(ANT).hasta + ' 12:10';
    if (r.no_empleado !== '92') { r.firma_fecha = periodo(ANT).hasta + ' 19:02'; }
    const pid = 'PAG-' + (++seq);
    pagos.unshift({ pago_id: pid, fecha: periodo(ANT).hasta + ' 18:36', no_empleado: r.no_empleado, nombre: r.nombre, monto: r.neto, concepto: 'nomina', clave_rastreo: 'FN455589T17908' + seq, recibo_id: r.recibo_id, cuadra: 'SI', origen: 'fondeadora' });
    r.estatus = 'pagado'; r.pago_id = pid; r.fecha_pago = periodo(ANT).hasta + ' 18:36';
  });
  pagos.unshift({ pago_id: 'PAG-' + (++seq), fecha: periodo(ANT).hasta + ' 21:39', no_empleado: '4', nombre: 'Saidd Argenis López', monto: 1000, concepto: 'bono tiempo extra', clave_rastreo: 'FN455589T1791002381', recibo_id: '', cuadra: 'SIN RECIBO', origen: 'fondeadora' });
  bandeja.length = 0;
  notificar('4', 'pago', '💸 Te depositamos $1,000.00', 'Concepto: bono tiempo extra · Rastreo FN455589T1791002381', '');
  notificar('4', 'aviso', '📢 Junta el sábado', 'Junta general a las 8:30 en la base. Lleguen 10 minutos antes.', 'AV-00001');
  notificar('1', 'solicitud', '📝 Nueva solicitud: Justificante de falta', 'Jonatan Ortega · ' + hoy, 'SOL-00003');
})();

const APPS = [
  ['packatelas', 'Packatelas', 'Escaneo de paquetes', '📦', '#1f3a5f', 'apk', 'apps/packatelas.apk', 'app.packatelas.mx', '', 'repartidor', true, true],
  ['whatsapp', 'WhatsApp Business', 'Comunicación con clientes', '💬', '#25a35a', 'playstore', 'https://play.google.com/store/apps/details?id=com.whatsapp.w4b', 'com.whatsapp.w4b', 'https://wa.me/', 'repartidor', true, true],
  ['zello', 'Zello', 'Radio con el equipo', '📻', '#e8732c', 'playstore', 'https://play.google.com/store/apps/details?id=com.loudtalks', 'com.loudtalks', '', 'repartidor', true, true],
  ['mydriver', 'My Driver', 'Entregas asignadas', '🚚', '#1d4e6b', 'playstore', 'https://play.google.com/store/apps/details?id=com.my.driver', 'com.my.driver', '', 'repartidor', true, true],
  ['flex', 'Envíos Flex', 'Mercado Libre', '🟨', '#e0b800', 'playstore', 'https://play.google.com/store/apps/details?id=com.mercadoenvios.driver', 'com.mercadoenvios.driver', '', 'repartidor', true, true],
  ['waze', 'Waze', 'Navegación', '🧭', '#33ccff', 'playstore', 'https://play.google.com/store/apps/details?id=com.waze', 'com.waze', 'https://waze.com/ul', 'repartidor', true, true],
  ['maps', 'Google Maps', 'Navegación y direcciones', '🗺️', '#34a853', 'playstore', 'https://play.google.com/store/apps/details?id=com.google.android.apps.maps', 'com.google.android.apps.maps', 'https://maps.google.com/', 'repartidor', true, true],
  ['telefono', 'Teléfono de Google', 'Llamadas', '📞', '#1a73e8', 'playstore', 'https://play.google.com/store/apps/details?id=com.google.android.dialer', 'com.google.android.dialer', '', 'repartidor', true, false],
  ['mensajes', 'Mensajes de Google', 'SMS', '✉️', '#1a73e8', 'playstore', 'https://play.google.com/store/apps/details?id=com.google.android.apps.messaging', 'com.google.android.apps.messaging', '', 'repartidor', true, false],
  ['flotilla', 'Flotilla', 'Check de moto, gasolina y fallas', '🛵', '#2b4c78', 'web', 'https://computenga.github.io/flotilla-packatelas/', '', 'https://computenga.github.io/flotilla-packatelas/', 'repartidor', false, true],
].map(([app_id, nombre, descripcion, icono, color, tipo, url_instalar, android_package, url_abrir, puestos, requerida, acceso_directo], i) =>
  ({ app_id, nombre, descripcion, icono, color, tipo, url_instalar, android_package, url_abrir, puestos, requerida, acceso_directo, orden: (i + 1) * 10, activo: true }));
const onb = { '4': { docs: '2026-10-12', apps: ['whatsapp', 'zello', 'waze', 'maps', 'telefono'], celular: true }, '75': { docs: '', apps: [], celular: true }, '5': { docs: '2026-09-01', apps: [], celular: true } };
const TIPOS = [['ine_frente', 'INE (frente)', 'Foto clara, sin reflejos', 'todos'], ['ine_reverso', 'INE (reverso)', '', 'todos'], ['curp', 'CURP', 'Descárgala de gob.mx/curp', 'todos'],
  ['domicilio', 'Comprobante de domicilio', 'Luz, agua o teléfono, máximo 3 meses', 'todos'], ['csf', 'Constancia de situación fiscal (RFC)', 'Del SAT, con tu RFC', 'todos'],
  ['nss', 'Número de Seguro Social', 'Hoja o captura del IMSS con tu NSS', 'todos'], ['clabe', 'Estado de cuenta con CLABE', 'Carátula con tu nombre y CLABE', 'todos'],
  ['foto', 'Foto tuya de frente', 'Fondo claro, sin lentes ni gorra', 'todos'], ['licencia', 'Licencia de conducir vigente', 'Frente y reverso', 'repartidor']];
const archivos = [];
let altas = [];
function docsDe(owner, rol) {
  const docs = TIPOS.filter(t => t[3] === 'todos' || rol !== 'otro').map(([doc_id, nombre, descripcion, puestos]) => {
    const a = archivos.filter(x => x.owner === owner && x.doc_id === doc_id && x.estatus !== 'reemplazado').pop();
    return { doc_id, nombre, descripcion, requerido: true, solo_repartidor: puestos === 'repartidor', ...(a ? { archivo_id: a.archivo_id, estatus: a.estatus, comentario: a.comentario, fecha: a.fecha, mime: a.mime } : { estatus: 'falta' }) };
  });
  const sub = docs.filter(d => ['subido', 'aprobado'].includes(d.estatus)).length;
  return { documentos: docs, requeridos: docs.length, subidos: sub, aprobados: docs.filter(d => d.estatus === 'aprobado').length, rechazados: docs.filter(d => d.estatus === 'rechazado').length, completos: sub === docs.length };
}
function subir(owner, doc_id, mime) { archivos.filter(x => x.owner === owner && x.doc_id === doc_id).forEach(x => x.estatus = 'reemplazado'); archivos.push({ archivo_id: 'DOC-' + (++seq), owner, doc_id, estatus: 'subido', comentario: '', fecha: ahora(), mime }); }
function altaEstado(a) { return { alta_id: a.alta_id, nombre: a.nombre, rfc: a.rfc, rol: a.rol, estatus: a.estatus, no_empleado: a.no_empleado, notas: a.notas, docs: docsDe('A:' + a.alta_id, a.rol) }; }
const esRep = p => /repart/i.test(p.puesto || '') || !!p.flotilla_id;
function appsPara(p) { const o = onb[p.no_empleado] || {}; return APPS.filter(a => a.activo && (a.puestos === 'todos' || (a.puestos === 'repartidor' && esRep(p)))).sort((a, b) => a.orden - b.orden).map(a => ({ ...a, lista: (o.apps || []).includes(a.app_id) })); }
function bienv(p) {
  const o = onb[p.no_empleado] = onb[p.no_empleado] || { docs: '', apps: [], celular: false };
  const rol = p.puesto ? (esRep(p) ? 'repartidor' : 'otro') : (o.rol || '');
  const req = rol === 'repartidor' ? appsPara(p).filter(a => a.requerida) : [];
  const dd = docsDe('E:' + p.no_empleado, rol);
  const pasos = [{ id: 'acceso', titulo: 'Crea tu acceso', detalle: 'RFC y PIN', hecho: !!p.pin, auto: true },
    { id: 'documentos', titulo: 'Sube tus documentos', detalle: `${dd.subidos} de ${dd.requeridos} subidos` + (dd.rechazados ? ` · ${dd.rechazados} por corregir` : ''), hecho: dd.completos, rechazados: dd.rechazados }];
  if (rol === 'repartidor') pasos.push({ id: 'apps', titulo: 'Instala tus apps e inicia sesión', detalle: `${req.filter(a => a.lista).length} de ${req.length} listas`, hecho: req.every(a => a.lista), faltan: req.filter(a => !a.lista).map(a => a.nombre) });
  pasos.push({ id: 'checador', titulo: 'Registra tu huella en el checador', detalle: 'Con RH, en el checador de la base', hecho: !!o.celular, auto: true });
  pasos.push({ id: 'notificaciones', titulo: 'Activa las notificaciones', detalle: 'Para tu recibo y tu depósito', hecho: dispositivos.has(p.no_empleado), auto: true });
  const hechos = pasos.filter(x => x.hecho).length;
  return { rol, pasos, hechos, total: pasos.length, completa: hechos === pasos.length, siguiente: (pasos.find(x => !x.hecho) || {}).titulo || '' };
}
['ine_frente', 'ine_reverso', 'curp', 'csf', 'nss', 'clabe', 'foto', 'licencia'].forEach(d => { subir('E:4', d, 'image/jpeg'); archivos[archivos.length - 1].estatus = 'aprobado'; });
subir('E:4', 'domicilio', 'image/jpeg'); Object.assign(archivos[archivos.length - 1], { estatus: 'rechazado', comentario: 'Tiene más de 3 meses, sube uno reciente' });
subir('E:75', 'ine_frente', 'image/jpeg'); subir('E:75', 'curp', 'application/pdf');
altas.push({ alta_id: 'ALTA-0001', nombre: 'Juan Pérez Gómez', rfc: 'PEGJ900101AB1', telefono: '5512345678', rol: 'repartidor', estatus: 'completa', fecha: ahora(), no_empleado: '', notas: '' });
TIPOS.forEach(t => subir('A:ALTA-0001', t[0], 'image/jpeg'));
altas.push({ alta_id: 'ALTA-0002', nombre: 'Laura Méndez Ruiz', rfc: 'MERL950505MX2', telefono: '5598765432', rol: 'otro', estatus: 'pendiente', fecha: ahora(), no_empleado: '', notas: '' });
['ine_frente', 'curp'].forEach(d => subir('A:ALTA-0002', d, 'image/jpeg'));
const sessions = {};
function me(token) { const no = sessions[token] || (token && token.startsWith('demo-') ? token.slice(5) : null); const p = personal.find(x => x.no_empleado === no); if (!p) throw new Error('Sesión requerida'); return p; }
const user = p => ({ no_empleado: p.no_empleado, nombre: p.nombre, rol: p.rol, puesto: p.puesto, repartidor: esRep(p) });
const pickR = r => ({ ...r });

export function handle(action, d, token) {
  const ADMIN = () => { const p = me(token); if (p.rol !== 'patron') throw new Error('Sin permiso para esta acción'); return p; };
  const OPS = () => { const p = me(token); if (p.rol !== 'patron' && p.rol !== 'admin') throw new Error('Sin permiso para esta acción'); return p; };
  switch (action) {
    case 'estadoRfc': { const p = personal.find(x => x.rfc === d.rfc); if (!p) { if (!d.rfc.startsWith('XAXX') && /^[A-Z]{4}\d{6}/.test(d.rfc)) { personal.find(x => x.no_empleado === '5').rfc = d.rfc; return { estado: 'nuevo' }; } throw new Error('Ese RFC no está dado de alta. Pídele a RH que lo registre.'); } return { estado: p.pin ? 'activo' : 'nuevo' }; }
    case 'primerAcceso': { const p = personal.find(x => x.rfc === d.rfc); if (!p || p.no_empleado !== d.no_empleado) throw new Error('El RFC y el número de empleado no coinciden'); p.pin = d.pin; return { token: 'demo-' + p.no_empleado, usuario: user(p) }; }
    case 'login': { const p = personal.find(x => x.rfc === d.rfc); if (!p || p.pin !== d.pin) throw new Error('RFC o PIN incorrecto. Te quedan 4 intento(s).'); return { token: 'demo-' + p.no_empleado, usuario: user(p) }; }
    case 'inicio': {
      const p = me(token); const a = asistencia(p.no_empleado, PER); const rs = recibos.filter(r => r.no_empleado === p.no_empleado && r.estatus !== 'cancelado');
      return { hoy, periodo: periodo(PER), asistencia: a.totales, hoy_detalle: a.dias.find(x => x.fecha === hoy) || null, horario: a.horario, ultimo_recibo: rs[0] || null,
        recibos_sin_firmar: rs.filter(r => !r.firma_fecha).length, ultimo_pago: pagos.find(x => x.no_empleado === p.no_empleado) || null,
        no_leidos: bandeja.filter(n => n.no_empleado === p.no_empleado && !n.leido).length,
        saldo_adeudos: adeudos.filter(x => x.no_empleado === p.no_empleado && x.estatus === 'activo').reduce((s, x) => s + x.saldo, 0),
        cargos_pendientes: p.flotilla_id ? cargos.filter(c => c.responsable_id === p.flotilla_id && !c.cobrado).reduce((s, c) => s + c.monto, 0) : 0,
        solicitudes_pendientes: solicitudes.filter(s => s.no_empleado === p.no_empleado && s.estatus === 'pendiente').length,
        repartidor: esRep(p), bienvenida: bienv(p), accesos: appsPara(p).filter(a => a.acceso_directo),
        ruta: esRep(p) ? { ruta_id: 'RT-000001', fecha: hoy, paradas: RUTA_DEMO.paradas.length, envios: 7, salida: '10:00', fin: '13:05' } : null };
    }
    case 'perfil': { const p = me(token); const ing = p.ingreso || ''; const anios = ing ? Math.floor((HOY - new Date(ing)) / 3.156e10) : 0;
      return { ...p, fecha_ingreso: ing, antiguedad: ing ? `${anios} año(s)` : '', clabe: p.clabe ? '•••• ' + p.clabe.slice(-4) : '', banco: p.clabe ? 'BBVA' : '', horario: { entrada: p.entrada, dias: p.dias, comida: p.entrada ? 60 : '' }, celular_checador: true,
        vacaciones: ing ? { anios, derecho: anios ? 10 + Math.min(anios, 5) * 2 : 0, tomados: 2, disponibles: anios ? 10 + Math.min(anios, 5) * 2 - 2 : 0, desde: ing.replace(/^\d{4}/, HOY.getFullYear() - (iso(HOY).slice(5) < ing.slice(5) ? 1 : 0)), proximo_aniversario: ing.replace(/^\d{4}/, HOY.getFullYear() + (iso(HOY).slice(5) < ing.slice(5) ? 0 : 1)), dias_proximo: 12 + Math.min(anios, 4) * 2 } : { sin_fecha: true } }; }
    case 'asistencia': return asistencia(me(token).no_empleado, d.periodo);
    case 'asistenciaDe': ADMIN(); return asistencia(d.no_empleado, d.periodo);
    case 'recibos': { const p = me(token); return recibos.filter(r => r.no_empleado === p.no_empleado && r.estatus !== 'cancelado').map(pickR); }
    case 'recibo': { const p = me(token); const r = recibos.find(x => x.recibo_id === d.recibo_id && (x.no_empleado === p.no_empleado || p.rol === 'patron')); if (!r) throw new Error('Recibo no encontrado'); return pickR(r); }
    case 'reciboPdf': throw new Error('En la demostración no hay PDF; con el backend real se descarga el PDF generado en Drive.');
    case 'firmarRecibo': { const p = me(token); if (d.pin !== p.pin) throw new Error('PIN incorrecto'); const r = recibos.find(x => x.recibo_id === d.recibo_id); r.firma_fecha = ahora(); return pickR(r); }
    case 'pagos': { const p = me(token); return pagos.filter(x => x.no_empleado === p.no_empleado); }
    case 'adeudos': { const p = me(token); const ad = adeudos.filter(x => x.no_empleado === p.no_empleado);
      const cg = p.flotilla_id ? cargos.filter(c => c.responsable_id === p.flotilla_id).map(c => ({ ...c, estatus: c.cobrado ? 'descontado' : 'pendiente', recibo_id: c.cobrado || '' })) : [];
      return { adeudos: ad, abonos: [{ adeudo_id: 'AD-00001', fecha: periodo(ANT).hasta, monto: 250, recibo_id: 'REC-000101' }], cargos: cg,
        saldo_total: ad.filter(a => a.estatus === 'activo').reduce((s, a) => s + a.saldo, 0), cargos_pendientes: cg.filter(c => c.estatus === 'pendiente').reduce((s, c) => s + c.monto, 0) }; }
    case 'solicitudes': { const p = me(token); return solicitudes.filter(s => s.no_empleado === p.no_empleado); }
    case 'subirEvidencia': return { id: 'demo' };
    case 'crearSolicitud': { const p = me(token); if (!d.motivo && d.tipo !== 'vacaciones') throw new Error('Escribe el motivo');
      const T = { justificante: 'Justificante de falta', vacaciones: 'Vacaciones', permiso: 'Permiso', anticipo: 'Anticipo de nómina', otro: 'Otro' };
      solicitudes.unshift({ sol_id: 'SOL-' + (++seq), no_empleado: p.no_empleado, nombre: p.nombre, tipo: d.tipo, tipo_txt: T[d.tipo], fecha_desde: d.fecha_desde, fecha_hasta: d.fecha_hasta, dias: d.fecha_desde ? 1 : 0, monto: Number(d.monto || 0), motivo: d.motivo, evidencia: d.evidencia, estatus: 'pendiente', fecha_solicitud: ahora() }); return 'ok'; }
    case 'bandeja': { const p = me(token); return bandeja.filter(n => n.no_empleado === p.no_empleado); }
    case 'marcarLeido': { const p = me(token); bandeja.forEach(n => { if (n.no_empleado === p.no_empleado && (d.todos || (d.ids || []).includes(n.notif_id))) n.leido = true; }); return true; }
    case 'documentos': return [{ id: 'd1', nombre: 'Contrato individual de trabajo.pdf', mime: 'application/pdf', fecha: '2025-03-10', tamano: 182000 }, { id: 'd2', nombre: 'Constancia de situación fiscal.pdf', mime: 'application/pdf', fecha: '2025-03-10', tamano: 96000 }];
    case 'documento': throw new Error('En la demostración no se descargan archivos.');
    case 'bienvenida': return bienv(me(token));
    case 'elegirRol': { const p = me(token); bienv(p); onb[p.no_empleado].rol = d.rol; return bienv(p); }
    case 'marcarApp': { const p = me(token); bienv(p); const o = onb[p.no_empleado]; o.apps = o.apps.filter(x => x !== d.app_id); if (d.lista !== false) o.apps.push(d.app_id); return bienv(p); }
    case 'apps': return appsPara(me(token));
    case 'altaIniciar': {
      if (!d.nombre || d.nombre.trim().split(/\s+/).length < 2) throw new Error('Escribe tu nombre completo');
      if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(d.rfc)) throw new Error('Revisa tu RFC: son 13 caracteres (ej. LOAS950505H12)');
      if (String(d.telefono).replace(/\D/g, '').length !== 10) throw new Error('El celular debe tener 10 dígitos');
      let a = altas.find(x => x.rfc === d.rfc);
      if (!a) altas.push(a = { alta_id: 'ALTA-' + (++seq), nombre: d.nombre, rfc: d.rfc, telefono: d.telefono, rol: d.rol, estatus: 'pendiente', fecha: ahora(), no_empleado: '', notas: '' });
      return { alta_token: 'tok-' + a.alta_id, alta: altaEstado(a) };
    }
    case 'altaEstado': { const a = altas.find(x => 'tok-' + x.alta_id === d.alta_token); if (!a) throw new Error('Registro no encontrado'); return altaEstado(a); }
    case 'altaSubir': { const a = altas.find(x => 'tok-' + x.alta_id === d.alta_token); subir('A:' + a.alta_id, d.doc_id, d.mime); if (docsDe('A:' + a.alta_id, a.rol).completos) a.estatus = 'completa'; return altaEstado(a); }
    case 'misDocumentos': { const p = me(token); return docsDe('E:' + p.no_empleado, esRep(p) ? 'repartidor' : 'otro'); }
    case 'subirMiDocumento': { const p = me(token); subir('E:' + p.no_empleado, d.doc_id, d.mime); return docsDe('E:' + p.no_empleado, esRep(p) ? 'repartidor' : 'otro'); }
    case 'archivo': throw new Error('En la demostración no se descargan archivos.');
    case 'altasAdmin': ADMIN(); return altas.filter(a => d.estatus === 'todas' || (d.estatus === 'abiertas' || !d.estatus ? ['pendiente', 'completa'].includes(a.estatus) : a.estatus === d.estatus)).map(a => ({ ...altaEstado(a), telefono: a.telefono, fecha: a.fecha }));
    case 'resolverAlta': { ADMIN(); const a = altas.find(x => x.alta_id === d.alta_id); if (d.aprobar) { if (!d.no_empleado) throw new Error('Indica el número de empleado'); a.estatus = 'aprobada'; a.no_empleado = d.no_empleado; archivos.filter(x => x.owner === 'A:' + a.alta_id).forEach(x => x.owner = 'E:' + d.no_empleado); personal.push({ no_empleado: d.no_empleado, nombre: a.nombre, rfc: a.rfc, puesto: d.puesto, rol: 'empleado', salario_diario: 0, clabe: '', entrada: '', dias: '' }); } else { a.estatus = 'rechazada'; a.notas = d.comentario; } return { aprobada: !!d.aprobar, no_empleado: d.no_empleado }; }
    case 'revisarDocumento': { ADMIN(); if (d.estatus === 'rechazado' && !d.comentario) throw new Error('Escribe qué debe corregir'); const x = archivos.find(y => y.archivo_id === d.archivo_id); x.estatus = d.estatus; x.comentario = d.comentario || ''; return true; }
    case 'docsDeEmpleado': { ADMIN(); const p = personal.find(x => x.no_empleado === d.no_empleado); return docsDe('E:' + p.no_empleado, esRep(p) ? 'repartidor' : 'otro'); }
    case 'bienvenidaDe': ADMIN(); return bienv(personal.find(p => p.no_empleado === d.no_empleado));
    case 'docsRecibidos': ADMIN(); { const p = personal.find(x => x.no_empleado === d.no_empleado); bienv(p); onb[p.no_empleado].docs = d.recibidos ? hoy : ''; return bienv(p); }
    case 'recordarBienvenida': ADMIN(); notificar(d.no_empleado, 'bienvenida', '👋 Te falta terminar tu bienvenida', 'Siguiente paso: ' + bienv(personal.find(p => p.no_empleado === d.no_empleado)).siguiente, ''); return true;
    case 'appsAdmin': ADMIN(); return APPS;
    case 'guardarApp': ADMIN(); { const x = APPS.find(a => a.app_id === d.app.app_id); if (x) Object.assign(x, d.app, { orden: Number(d.app.orden) }); else APPS.push({ ...d.app, orden: Number(d.app.orden) }); return true; }
    case 'registerDevice': dispositivos.add(me(token).no_empleado); return true;
    case 'cambiarPin': { const p = me(token); if (d.actual !== p.pin) throw new Error('Tu PIN actual no es correcto'); p.pin = d.nuevo; return { token, usuario: user(p) }; }

    case 'panel': {
      ADMIN();
      const ag = handle('asistenciaGeneral', { periodo: PER }, token);
      const L = ag.empleados.filter(e => e.hoy && e.hoy.laboral);
      return { periodo: periodo(PER), periodo_anterior: periodo(ANT), hoy,
        hoy_resumen: { esperados: L.length, presentes: L.filter(e => e.hoy.entrada).length, tarde: L.filter(e => e.hoy.min_tarde > 0).length,
          faltan: L.filter(e => !e.hoy.entrada).map(e => ({ no_empleado: e.no_empleado, nombre: e.nombre, debia: e.hoy.debia })),
          llegadas: L.filter(e => e.hoy.entrada).map(e => ({ nombre: e.nombre, entrada: e.hoy.entrada, min_tarde: e.hoy.min_tarde })) },
        quincena: { retardos: ag.empleados.reduce((s, e) => s + e.totales.retardos + e.totales.retardos_comida, 0), horas_retraso: ag.empleados.reduce((s, e) => s + e.totales.horas_retraso, 0),
          faltas: ag.empleados.reduce((s, e) => s + e.totales.faltas, 0), top: ag.empleados.filter(e => e.totales.horas_descuento > 0).slice(0, 5).map(e => ({ nombre: e.nombre, faltas: e.totales.faltas, min_total: e.totales.min_total })) },
        nomina: { recibos_periodo_anterior: recibos.filter(r => r.periodo === ANT).length, recibos_periodo: recibos.filter(r => r.periodo === PER).length, sin_firmar: recibos.filter(r => !r.firma_fecha && r.estatus !== 'cancelado').length,
          sin_pagar: recibos.filter(r => r.estatus === 'emitido').length, pagos_semana: pagos.reduce((s, p) => s + p.monto, 0), pagos_no_cuadran: pagos.filter(p => p.cuadra === 'NO').length },
        solicitudes_pendientes: solicitudes.filter(s => s.estatus === 'pendiente').length,
        datos_faltantes: { sin_rfc: personal.filter(p => !p.rfc).length, sin_clabe: personal.filter(p => !p.clabe).length, sin_salario: personal.filter(p => !p.salario_diario).length, sin_pin: personal.filter(p => !p.pin).length, sin_horario: personal.filter(p => !p.entrada).length },
        con_push: dispositivos.size, total_personal: personal.length, bienvenida_pendiente: personal.filter(p => !bienv(p).completa).length,
        altas_por_revisar: altas.filter(a => a.estatus === 'completa').length, altas_en_proceso: altas.filter(a => a.estatus === 'pendiente').length,
        docs_por_revisar: archivos.filter(x => x.owner.startsWith('E:') && x.estatus === 'subido').length };
    }
    case 'asistenciaGeneral': ADMIN(); return { periodo: periodo(d.periodo), hoy, empleados: personal.map(p => { const a = asistencia(p.no_empleado, d.periodo); const x = a.dias.find(y => y.fecha === hoy);
      return { no_empleado: p.no_empleado, nombre: p.nombre, puesto: p.puesto, sin_horario: a.sin_horario, totales: a.totales, hoy: x ? { estado: x.estado, entrada: x.entrada, min_tarde: x.min_tarde, debia: x.debia, laboral: x.laboral } : null }; })
      .sort((a, b) => b.totales.horas_descuento - a.totales.horas_descuento) };
    case 'prenomina': ADMIN(); return prenomina(d.periodo);
    case 'emitirRecibos': ADMIN(); { const r = emitir(d.periodo, d.filas); return { emitidos: r.length, recibos: r }; }
    case 'recibosAdmin': ADMIN(); return recibos.filter(r => !d.periodo || r.periodo === d.periodo).map(pickR);
    case 'cancelarRecibo': ADMIN(); recibos.find(r => r.recibo_id === d.recibo_id).estatus = 'cancelado'; return true;
    case 'pagosAdmin': ADMIN(); return pagos;
    case 'asignarPago': ADMIN(); { const p = pagos.find(x => x.pago_id === d.pago_id); p.recibo_id = d.recibo_id; p.cuadra = d.recibo_id ? 'MANUAL' : 'SIN RECIBO'; return true; }
    case 'pagoManual': ADMIN(); { const p = personal.find(x => x.no_empleado === d.no_empleado); pagos.unshift({ pago_id: 'PAG-' + (++seq), fecha: ahora(), no_empleado: p.no_empleado, nombre: p.nombre, monto: Number(d.monto), concepto: d.concepto, clave_rastreo: 'MANUAL', recibo_id: '', cuadra: 'SIN RECIBO', origen: 'manual' }); return 'ok'; }
    case 'revisarAhora': ADMIN(); return { revisados: 37, pagos_nuevos: 0, transferencias_a_otros: 31 };
    case 'siguienteNumero': ADMIN(); return String(Math.max(...personal.map(p => Number(p.no_empleado))) + 1);
    case 'personal': ADMIN(); return personal.map(p => ({ ...p, hora_entrada: p.hora_entrada ?? p.entrada, dias_laborales: p.dias_laborales ?? p.dias, minutos_comida: p.minutos_comida ?? (p.entrada ? 60 : ''), checadas: p.checadas ?? (esRep(p) ? 'ENTRADA,SALIDA_COMIDA,REGRESO_COMIDA' : 'ENTRADA,SALIDA_COMIDA,REGRESO_COMIDA,SALIDA'), docs_por_revisar: archivos.filter(x => x.owner === 'E:' + p.no_empleado && x.estatus === 'subido').length, bienvenida: (b => ({ hechos: b.hechos, total: b.total, completa: b.completa }))(bienv(p)), estatus: 'activo', tiene_pin: !!p.pin, bloqueado: false, push: dispositivos.has(p.no_empleado), horario: p.entrada ? { entrada: p.entrada, dias: p.dias, comida: 60 } : null, celular_checador: true, fecha_ingreso: p.ingreso || '' }));
    case 'guardarPersona': ADMIN(); { const x = personal.find(p => p.no_empleado === d.persona.no_empleado); if (x) Object.assign(x, d.persona, { salario_diario: Number(d.persona.salario_diario || 0), entrada: d.persona.hora_entrada, dias: d.persona.dias_laborales }); else personal.push({ ...d.persona, entrada: '', dias: '' }); return true; }
    case 'resetPin': ADMIN(); personal.find(p => p.no_empleado === d.no_empleado).pin = ''; return true;
    case 'subirDocumento': ADMIN(); return { id: 'x' };
    case 'adeudosAdmin': ADMIN(); return { adeudos, cargos: cargos.map(c => ({ ...c, nombre: personal.find(p => p.flotilla_id === c.responsable_id)?.nombre || c.responsable_id })) };
    case 'guardarAdeudo': ADMIN(); { if (d.adeudo_id) { Object.assign(adeudos.find(a => a.adeudo_id === d.adeudo_id), { cuota: Number(d.cuota), saldo: Number(d.saldo), estatus: d.estatus }); return true; }
      const p = personal.find(x => x.no_empleado === d.no_empleado); adeudos.unshift({ adeudo_id: 'AD-' + (++seq), no_empleado: p.no_empleado, nombre: p.nombre, concepto: d.concepto, monto_total: Number(d.monto_total), cuota: Number(d.cuota || d.monto_total), saldo: Number(d.monto_total), fecha_alta: hoy, estatus: 'activo' }); return true; }
    case 'solicitudesAdmin': ADMIN(); return solicitudes.filter(s => !d.estatus || s.estatus === d.estatus);
    case 'resolverSolicitud': { const a = ADMIN(); const s = solicitudes.find(x => x.sol_id === d.sol_id); Object.assign(s, { estatus: d.aprobar ? 'aprobada' : 'rechazada', comentario: d.comentario, fecha_resolucion: ahora(), resuelta_por: a.nombre });
      notificar(s.no_empleado, 'solicitud', (d.aprobar ? '✅ Aprobada: ' : '❌ Rechazada: ') + s.tipo_txt, d.comentario || '', s.sol_id); return true; }
    case 'enviarAviso': ADMIN(); { const dest = d.destinatarios === 'todos' ? personal.map(p => p.no_empleado) : d.destinatarios; dest.forEach(no => notificar(no, 'aviso', '📢 ' + d.titulo, d.mensaje, 'AV')); return { enviados: dest.length, con_push: dest.filter(x => dispositivos.has(x)).length }; }
    case 'avisosEnviados': ADMIN(); return [{ ref: 'AV-00001', fecha: periodo(ANT).hasta + ' 09:00', titulo: '📢 Junta el sábado', mensaje: 'Junta general a las 8:30 en la base.', total: 7, leidos: 4 }];
    case 'miRuta': { const p = me(token); return esRep(p) ? { ...RUTA_DEMO, nombre: p.nombre } : null; }
    case 'rutasConfig': OPS(); return { tomtom: false, shipday: true, empleados: personal.map(p => ({ no_empleado: p.no_empleado, nombre: p.nombre, telefono: '5512345678', repartidor: esRep(p) })).sort((a, b) => b.repartidor - a.repartidor) };
    case 'guardarClaves': ADMIN(); throw new Error('En la demostración no se guardan claves.');
    case 'tomtomRutas': OPS(); throw new Error('En la demostración no hay TomTom.');
    case 'publicarRutas': OPS(); return { publicadas: (d.rutas || []).filter(r => r.no_empleado).length, con_push: 1 };
    case 'rutasAdmin': OPS(); return { fecha: d.fecha, shipday: true, rutas: [{ ruta_id: 'RT-000001', fecha: d.fecha, no_empleado: '4', nombre: 'Saidd Argenis López', num: 1, total: 2, salida: '10:00', fin: '13:05', km: 31.4, paradas: 6, envios: 7, estatus: 'activa', visto: d.fecha + ' 09:52', seguimiento: { total: 7, entregados: 4, fallidos: 1, pendientes: 2, limite: '21:00', fin_estimado: '13:20', estado: 'a_tiempo', retraso_min: 0, actualizado: '12:10' } }, { ruta_id: 'RT-000002', fecha: d.fecha, no_empleado: '92', nombre: 'Jonatan Ortega', num: 2, total: 2, salida: '10:00', fin: '13:30', km: 28.2, paradas: 7, envios: 7, estatus: 'activa', visto: '', seguimiento: { total: 7, entregados: 1, fallidos: 0, pendientes: 6, limite: '13:30', fin_estimado: '14:15', estado: 'tarde', retraso_min: 45, actualizado: '12:10' } }], reporte: REPORTE_DEMO };
    case 'shipdayRepartidores': ADMIN(); return { repartidores: [{ id: '561122', nombre: 'Angel Campos', telefono: '+52 55 1234 5678', activo: true, no_empleado: '', sugerido: '' }, { id: '470064', nombre: 'Fernando Gallegos', telefono: '', activo: true, no_empleado: '', sugerido: '' }, { id: '300001', nombre: 'Saidd Lopez', telefono: '+52 55 1111 2222', activo: true, no_empleado: '4', sugerido: '' }, { id: '300002', nombre: 'Jonatan O.', telefono: '', activo: true, no_empleado: '', sugerido: '92' }],
      empleados: personal.map(p => ({ no_empleado: p.no_empleado, nombre: p.nombre, repartidor: esRep(p), shipday_id: '' })) };
    case 'vincularShipday': ADMIN(); return true;
    case 'recolecciones': OPS(); return { fecha: hoy, modo: 'aprobacion', hasta: '12:00', capacidad: 6, shipday: true,
      disponibles: [{ no_empleado: '4', nombre: 'Saidd Argenis López', entrada: '08:58', puntos: 4 }, { no_empleado: '92', nombre: 'Jonatan Ortega', entrada: '09:40', puntos: 1 }],
      recolecciones: [{ rec_id: 'REC-1', order_number: 'RECOLECCION-1', cliente: 'Casfa', direccion: 'Calz. de Tlalpan 1234, Portales', lat: 19.37, lng: -99.14, volumen: 'alto', puntos: 3, no_empleado: '4', nombre: 'Saidd Argenis López', estado: 'propuesta', creada: '09:12', nota: '' },
        { rec_id: 'REC-2', order_number: '7788', cliente: 'Photurax', direccion: 'Av. Insurgentes Sur 800, Del Valle', lat: 19.38, lng: -99.17, volumen: 'bajo', puntos: 1, no_empleado: '92', nombre: 'Jonatan Ortega', estado: 'asignada', creada: '09:20', nota: '' },
        { rec_id: 'REC-3', order_number: 'RECOLECCION-3', cliente: 'Nuevo Cliente SA', direccion: 'Calle 5 de Mayo 20, Centro', lat: 19.43, lng: -99.13, volumen: 'sin clasificar', puntos: 2, no_empleado: '4', nombre: 'Saidd Argenis López', estado: 'propuesta', creada: '10:02', nota: '' }],
      clientes: [{ cliente: 'Nuevo Cliente SA', volumen: '' }, { cliente: 'Casfa', volumen: 'alto' }, { cliente: 'Photurax', volumen: 'bajo' }] };
    case 'recoleccionesBuscar': OPS(); return { nuevas: 0 };
    case 'recoleccionAprobar': OPS(); return { asignadas: 2, errores: [] };
    case 'recoleccionCambiar': case 'recoleccionRechazar': case 'clienteVolumen': OPS(); return true;
    case 'gpsPrueba': ADMIN(); return { fecha: d.fecha, activo: true, repartidores: [{ carrier_id: '300001', nombre: 'Saidd Lopez', empleado: 'Saidd Argenis López', muestras: 96, con_gps: 94, en_turno: 90, cambios: 71, pct_cambio: 76, max_congelado_min: 20, primera: '09:00', ultima: '17:00', paradas: [{ desde: '12:10', hasta: '12:35', min: 25, lat: 19.36, lng: -99.08, tipo: 'detenido' }, { desde: '14:00', hasta: '14:50', min: 50, lat: 19.40, lng: -99.10, tipo: 'sin_senal' }] }] };
    case 'gpsAhora': ADMIN(); return { muestras: 7 };
    case 'seguimientoAhora': OPS(); return { rutas: 2, consultados: 8, avisos: 1 };
    case 'seguimientoRuta': OPS(); return { ruta_id: d.ruta_id, nombre: 'Jonatan Ortega', num: 2, seguimiento: { total: 7, entregados: 1, fallidos: 0, pendientes: 6, limite: '13:30', fin_estimado: '14:15', estado: 'tarde', retraso_min: 45, actualizado: '12:10' },
      paradas: RUTA_DEMO.paradas.map((p, i) => ({ orden: i + 1, eta: p.eta, dir: p.dir, ref: p.ref, envios: p.envios.map(n => ({ envio: n, estado: i === 0 ? 'entregado' : 'pendiente', hora: i === 0 ? '10:31' : '' })) })) };
    case 'reporteRutas': OPS(); return { fecha: d.fecha, rutas: 2, reporte: REPORTE_DEMO };
    default: throw new Error('Acción no simulada: ' + action);
  }
}

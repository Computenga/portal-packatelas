/**
 * Portal Packatelas — API (Apps Script Web App)
 *
 * Base maestra: la hoja "checador packatelas" (MAESTRO_ID). El checador sigue escribiendo
 * en sus pestañas (Empleados, Checadas, Justificadas); este script agrega y usa:
 *   Personal, Recibos, Pagos, Adeudos, Abonos, Solicitudes, Bandeja, Dispositivos, Bitacora, ConfigPortal
 * La flotilla sigue en su propia hoja (FLOTILLA_ID); de ahí se leen los cargos al empleado.
 *
 * La PWA llama a doPost con { action, token, ...datos } en texto plano.
 * Respuesta: { ok: true, data } o { ok: false, error }.
 */

const MAESTRO_ID = '1U6RRubCwjpfmOilWSWRY1txh7dwP9d7SdAxXWmpxsf0';
const FLOTILLA_ID = '1T8HpYcqdHRU-ohgFGZGuNMiI3mrPWFdAZr7o37XXPmo';
const FCM_PROJECT = 'flotilla-packatelas';
const TZ = 'America/Mexico_City';
const TOKEN_DAYS = 60;
const MAX_INTENTOS = 5;
const EMPRESA = 'Comercializadora Computenga';
const EMPRESA_DOMICILIO = 'Juan Lucas de Lassaga 54, Piso 1, Col. Obrera, Cuauhtémoc, 06800 Ciudad de México';

// ───────────────────────── Esquema de pestañas nuevas ─────────────────────────

const SCHEMA = {
  Personal: ['no_empleado', 'nombre', 'rfc', 'curp', 'nss', 'puesto', 'area', 'rol', 'estatus', 'fecha_ingreso',
    'fecha_baja', 'salario_diario', 'clabe', 'banco', 'telefono', 'correo', 'flotilla_id', 'carpeta_docs',
    'pin_hash', 'pin_intentos', 'pin_bloqueado', 'ultimo_acceso', 'notas', 'onb_rol', 'onb_docs', 'onb_apps'],
  Recibos: ['recibo_id', 'no_empleado', 'nombre', 'periodo', 'desde', 'hasta', 'dias', 'salario_diario',
    'sueldo', 'bonos', 'otras_percepciones', 'desc_faltas', 'desc_retardos', 'desc_cargos', 'desc_adeudos',
    'otras_deducciones', 'total_percepciones', 'total_deducciones', 'neto', 'detalle_json', 'pdf_id', 'estatus',
    'fecha_emision', 'emitido_por', 'firma_fecha', 'firma_dispositivo', 'pago_id', 'fecha_pago'],
  Pagos: ['pago_id', 'fecha', 'no_empleado', 'nombre', 'monto', 'clabe', 'concepto', 'clave_rastreo', 'gmail_id',
    'recibo_id', 'cuadra', 'origen', 'notificado'],
  Adeudos: ['adeudo_id', 'no_empleado', 'nombre', 'concepto', 'monto_total', 'cuota', 'saldo', 'fecha_alta',
    'estatus', 'origen', 'notas'],
  Abonos: ['abono_id', 'adeudo_id', 'no_empleado', 'fecha', 'monto', 'recibo_id'],
  Solicitudes: ['sol_id', 'no_empleado', 'nombre', 'tipo', 'fecha_desde', 'fecha_hasta', 'dias', 'monto', 'motivo',
    'evidencia', 'estatus', 'fecha_solicitud', 'resuelta_por', 'fecha_resolucion', 'comentario'],
  Bandeja: ['notif_id', 'fecha', 'no_empleado', 'tipo', 'titulo', 'mensaje', 'ref', 'leido', 'push'],
  Dispositivos: ['no_empleado', 'fcm_token', 'plataforma', 'fecha_registro', 'activo'],
  Bitacora: ['fecha', 'no_empleado', 'accion', 'entidad', 'ref', 'detalle'],
  ConfigPortal: ['clave', 'valor', 'descripcion'],
  Apps: ['app_id', 'nombre', 'descripcion', 'icono', 'color', 'tipo', 'url_instalar', 'android_package', 'url_abrir',
    'puestos', 'requerida', 'acceso_directo', 'orden', 'activo'],
};

/** Apps iniciales (se editan después en la pestaña Apps). tipo: playstore | apk | web. puestos: todos | repartidor */
const APPS_DEFAULT = [
  ['packatelas', 'Packatelas', 'Escaneo de paquetes', '📦', '#1f3a5f', 'apk', 'apps/packatelas.apk', 'app.packatelas.mx', '', 'repartidor', 'SI', 'SI'],
  ['whatsapp', 'WhatsApp Business', 'Comunicación con clientes', '💬', '#25a35a', 'playstore', 'https://play.google.com/store/apps/details?id=com.whatsapp.w4b', 'com.whatsapp.w4b', 'https://wa.me/', 'repartidor', 'SI', 'SI'],
  ['zello', 'Zello', 'Radio con el equipo', '📻', '#e8732c', 'playstore', 'https://play.google.com/store/apps/details?id=com.loudtalks', 'com.loudtalks', '', 'repartidor', 'SI', 'SI'],
  ['mydriver', 'My Driver', 'Entregas asignadas', '🚚', '#1d4e6b', 'playstore', 'https://play.google.com/store/apps/details?id=com.my.driver', 'com.my.driver', '', 'repartidor', 'SI', 'SI'],
  ['flex', 'Envíos Flex', 'Mercado Libre', '🟨', '#e0b800', 'playstore', 'https://play.google.com/store/apps/details?id=com.mercadoenvios.driver', 'com.mercadoenvios.driver', '', 'repartidor', 'SI', 'SI'],
  ['waze', 'Waze', 'Navegación', '🧭', '#33ccff', 'playstore', 'https://play.google.com/store/apps/details?id=com.waze', 'com.waze', 'https://waze.com/ul', 'repartidor', 'SI', 'SI'],
  ['maps', 'Google Maps', 'Navegación y direcciones', '🗺️', '#34a853', 'playstore', 'https://play.google.com/store/apps/details?id=com.google.android.apps.maps', 'com.google.android.apps.maps', 'https://maps.google.com/', 'repartidor', 'SI', 'SI'],
  ['telefono', 'Teléfono de Google', 'Llamadas', '📞', '#1a73e8', 'playstore', 'https://play.google.com/store/apps/details?id=com.google.android.dialer', 'com.google.android.dialer', '', 'repartidor', 'SI', 'NO'],
  ['mensajes', 'Mensajes de Google', 'SMS', '✉️', '#1a73e8', 'playstore', 'https://play.google.com/store/apps/details?id=com.google.android.apps.messaging', 'com.google.android.apps.messaging', '', 'repartidor', 'SI', 'NO'],
  ['flotilla', 'Flotilla', 'Check de moto, gasolina y fallas', '🛵', '#2b4c78', 'web', 'https://computenga.github.io/flotilla-packatelas/', '', 'https://computenga.github.io/flotilla-packatelas/', 'repartidor', 'NO', 'SI'],
];

const CONFIG_DEFAULTS = [
  ['APP_URL', 'https://computenga.github.io/portal-packatelas/', 'Dirección de la app (para abrirla desde la notificación)'],
  ['ASISTENCIA_DESDE', '2026-10-12', 'Fecha desde la que se cuentan faltas y retardos (antes no había checador)'],
  ['HORAS_POR_FALTA', '8', 'Horas que vale una falta'],
  ['HORAS_JORNADA', '8', 'Horas de la jornada para calcular el valor de la hora (salario diario / horas)'],
  ['DIAS_QUINCENA', '15', 'Días que se pagan por quincena'],
  ['TOLERANCIA_PAGO', '1', 'Diferencia máxima en pesos para dar por cuadrado un depósito contra el neto del recibo'],
  ['CORREOS_ADMIN', 'cguevara@computenga.com', 'Correos de los admins (alertas de pagos que no cuadran), separados por coma'],
  ['RECIBOS_FOLDER_ID', '', 'Carpeta de Drive de los recibos PDF (se crea sola)'],
  ['EVIDENCIAS_FOLDER_ID', '', 'Carpeta de Drive para justificantes y evidencias (se crea sola)'],
  ['EXPEDIENTES_FOLDER_ID', '', 'Carpeta de Drive con una subcarpeta por empleado (se crea sola)'],
  ['FONDEADORA_REMITENTE', 'info@negocios.fondeadora.com', 'Remitente de los correos de Fondeadora'],
  ['FORM_DOCUMENTOS', 'https://forms.gle/qADGZZbjLRHhwjBo7', 'Formulario de documentos de alta (paso 2 de la bienvenida)'],
];

// ───────────────────────── Entrada HTTP ─────────────────────────

function doGet() {
  return json_({ ok: true, data: { service: 'portal-packatelas', time: now_() } });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'JSON inválido' }); }
  try {
    const action = ACTIONS[req.action];
    if (!action) throw new Error('Acción desconocida: ' + req.action);
    const user = action.public ? null : auth_(req.token, action.admin);
    return json_({ ok: true, data: action.fn(req, user) });
  } catch (err) {
    console.error(req.action, err);
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const ACTIONS = {
  // Sesión (públicas)
  estadoRfc:        { public: true, fn: estadoRfc_ },
  primerAcceso:     { public: true, fn: primerAcceso_ },
  login:            { public: true, fn: login_ },

  // Empleado
  inicio:           { fn: inicio_ },
  perfil:           { fn: (req, u) => perfil_(u.no_empleado) },
  asistencia:       { fn: (req, u) => asistenciaEmpleado_(u.no_empleado, req.periodo) },
  recibos:          { fn: (req, u) => recibosDe_(u.no_empleado) },
  recibo:           { fn: (req, u) => reciboDetalle_(req.recibo_id, u) },
  reciboPdf:        { fn: (req, u) => reciboPdf_(req.recibo_id, u) },
  firmarRecibo:     { fn: firmarRecibo_ },
  pagos:            { fn: (req, u) => pagosDe_(u.no_empleado) },
  adeudos:          { fn: (req, u) => adeudosDe_(u.no_empleado) },
  solicitudes:      { fn: (req, u) => solicitudesDe_(u.no_empleado) },
  crearSolicitud:   { fn: crearSolicitud_ },
  subirEvidencia:   { fn: subirEvidencia_ },
  bandeja:          { fn: (req, u) => bandejaDe_(u.no_empleado) },
  marcarLeido:      { fn: marcarLeido_ },
  documentos:       { fn: (req, u) => documentosDe_(u.no_empleado) },
  documento:        { fn: documento_ },
  registerDevice:   { fn: registerDevice_ },
  bienvenida:       { fn: (req, u) => bienvenida_(u.no_empleado) },
  elegirRol:        { fn: elegirRol_ },
  marcarApp:        { fn: marcarApp_ },
  marcarDocs:       { fn: (req, u) => marcarDocs_(u.no_empleado, req.enviado !== false, u) },
  apps:             { fn: (req, u) => appsPara_(u.no_empleado) },
  configPublica:    { public: true, fn: () => ({ form_documentos: config_('FORM_DOCUMENTOS', '') }) },
  cambiarPin:       { fn: cambiarPin_ },

  // Patrón
  panel:            { admin: true, fn: panel_ },
  personal:         { admin: true, fn: personalAdmin_ },
  guardarPersona:   { admin: true, fn: guardarPersona_ },
  resetPin:         { admin: true, fn: resetPin_ },
  subirDocumento:   { admin: true, fn: subirDocumento_ },
  asistenciaGeneral:{ admin: true, fn: (req) => asistenciaGeneral_(req.periodo) },
  asistenciaDe:     { admin: true, fn: (req) => asistenciaEmpleado_(req.no_empleado, req.periodo) },
  prenomina:        { admin: true, fn: (req) => prenomina_(req.periodo) },
  emitirRecibos:    { admin: true, fn: emitirRecibos_ },
  recibosAdmin:     { admin: true, fn: (req) => recibosAdmin_(req.periodo) },
  cancelarRecibo:   { admin: true, fn: cancelarRecibo_ },
  pagosAdmin:       { admin: true, fn: pagosAdmin_ },
  asignarPago:      { admin: true, fn: asignarPago_ },
  pagoManual:       { admin: true, fn: pagoManual_ },
  revisarAhora:     { admin: true, fn: () => revisarFondeadora_(3, true) },
  adeudosAdmin:     { admin: true, fn: adeudosAdmin_ },
  guardarAdeudo:    { admin: true, fn: guardarAdeudo_ },
  solicitudesAdmin: { admin: true, fn: solicitudesAdmin_ },
  resolverSolicitud:{ admin: true, fn: resolverSolicitud_ },
  enviarAviso:      { admin: true, fn: enviarAviso_ },
  avisosEnviados:   { admin: true, fn: avisosEnviados_ },
  bienvenidaDe:     { admin: true, fn: (req) => bienvenida_(req.no_empleado) },
  docsRecibidos:    { admin: true, fn: (req, u) => marcarDocs_(req.no_empleado, !!req.recibidos, u) },
  recordarBienvenida:{ admin: true, fn: recordarBienvenida_ },
  appsAdmin:        { admin: true, fn: () => rows_('Apps').map(pickApp_).sort((a, b) => a.orden - b.orden) },
  guardarApp:       { admin: true, fn: guardarApp_ },
};

// ───────────────────────── Instalación ─────────────────────────

/** Ejecutar una vez desde el editor: crea pestañas, carpetas y llena Personal con los empleados del checador. */
function setup() {
  Object.keys(SCHEMA).forEach(name => ensureTab_(name, SCHEMA[name]));
  const cfg = rows_('ConfigPortal');
  CONFIG_DEFAULTS.forEach(([k, v, d]) => { if (!cfg.find(r => r.clave === k)) append_('ConfigPortal', { clave: k, valor: v, descripcion: d }); });
  const root = folderByPath_(['Portal Packatelas']);
  if (!config_('RECIBOS_FOLDER_ID')) setConfig_('RECIBOS_FOLDER_ID', subfolder_(root, 'Recibos').getId());
  if (!config_('EVIDENCIAS_FOLDER_ID')) setConfig_('EVIDENCIAS_FOLDER_ID', subfolder_(root, 'Evidencias').getId());
  if (!config_('EXPEDIENTES_FOLDER_ID')) setConfig_('EXPEDIENTES_FOLDER_ID', subfolder_(root, 'Expedientes').getId());
  if (!rows_('Apps').length) APPS_DEFAULT.forEach((a, i) => append_('Apps', appRow_(a, i)));
  const r = sincronizarPersonal();
  instalarTriggers();
  console.log('Listo. Personal: ' + r.nuevos + ' nuevos, ' + r.actualizados + ' nombres actualizados.');
}

function instalarTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('tareaFondeadora').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('sincronizarPersonal').timeBased().everyHours(1).create();
}

function ensureTab_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#1f3a5f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  } else {
    const have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
    const missing = headers.filter(h => have.indexOf(h) < 0);
    if (missing.length) sh.getRange(1, have.filter(String).length + 1, 1, missing.length).setValues([missing]);
  }
  // Textos que Sheets no debe convertir (RFC, CLABE, números de empleado, IDs)
  ['no_empleado', 'clabe', 'rfc', 'curp', 'nss', 'telefono', 'flotilla_id', 'clave_rastreo', 'periodo'].forEach(col => {
    const i = headers.indexOf(col);
    if (i >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  });
  delete _cache['h:' + name];
  return sh;
}

/** Agrega a Personal los empleados nuevos del checador y actualiza nombres. Corre cada hora. */
function sincronizarPersonal() {
  return withLock_(() => {
    const personal = rows_('Personal');
    let nuevos = 0, actualizados = 0;
    empleadosChecador_().forEach(e => {
      const p = personal.find(x => String(x.no_empleado) === e.no);
      if (!p) {
        append_('Personal', { no_empleado: e.no, nombre: e.nombre, rol: e.no === '1' ? 'admin' : 'empleado', estatus: 'activo',
          fecha_ingreso: e.ingreso || '', pin_intentos: 0, pin_bloqueado: 'NO' });
        nuevos++;
      } else if (e.nombre && p.nombre !== e.nombre) {
        update_('Personal', p._row, { nombre: e.nombre });
        actualizados++;
      }
    });
    return { nuevos: nuevos, actualizados: actualizados };
  });
}

// ───────────────────────── Sesión y seguridad ─────────────────────────

function normRfc_(rfc) { return String(rfc || '').toUpperCase().replace(/[\s-]/g, ''); }

function personaPorRfc_(rfc) {
  const r = normRfc_(rfc);
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(r)) throw new Error('RFC con formato inválido');
  return rows_('Personal').find(p => normRfc_(p.rfc) === r && p.estatus !== 'baja');
}

function frenoIntentos_(clave) {
  const c = CacheService.getScriptCache();
  const k = 'rl_' + clave;
  const n = Number(c.get(k) || 0) + 1;
  c.put(k, String(n), 600);
  if (n > 20) throw new Error('Demasiados intentos. Espera 10 minutos.');
}

function estadoRfc_(req) {
  frenoIntentos_('rfc_' + normRfc_(req.rfc));
  const p = personaPorRfc_(req.rfc);
  if (!p) { Utilities.sleep(600); throw new Error('Ese RFC no está dado de alta. Pídele a RH que lo registre.'); }
  if (p.pin_bloqueado === 'SI') return { estado: 'bloqueado' };
  return { estado: p.pin_hash ? 'activo' : 'nuevo' };
}

function primerAcceso_(req) {
  frenoIntentos_('pa_' + normRfc_(req.rfc));
  return withLock_(() => {
    const p = personaPorRfc_(req.rfc);
    if (!p || String(p.no_empleado) !== String(req.no_empleado || '').trim()) {
      Utilities.sleep(800);
      throw new Error('El RFC y el número de empleado no coinciden');
    }
    if (p.pin_hash) throw new Error('Este RFC ya tiene PIN. Entra con tu PIN o pide a RH que lo reinicie.');
    validarPin_(req.pin);
    const hash = hashPin_(p.no_empleado, req.pin);
    update_('Personal', p._row, { pin_hash: hash, pin_intentos: 0, pin_bloqueado: 'NO', ultimo_acceso: new Date() });
    bitacora_(p.no_empleado, 'primer_acceso', 'Personal', p.no_empleado, '');
    return sesion_(Object.assign({}, p, { pin_hash: hash }));
  });
}

function login_(req) {
  frenoIntentos_('lg_' + normRfc_(req.rfc));
  return withLock_(() => {
    const p = personaPorRfc_(req.rfc);
    if (!p || !p.pin_hash) { Utilities.sleep(800); throw new Error('RFC o PIN incorrecto'); }
    if (p.pin_bloqueado === 'SI') throw new Error('Tu acceso está bloqueado por intentos fallidos. Pide a RH que reinicie tu PIN.');
    if (hashPin_(p.no_empleado, String(req.pin || '')) !== p.pin_hash) {
      const n = Number(p.pin_intentos || 0) + 1;
      update_('Personal', p._row, { pin_intentos: n, pin_bloqueado: n >= MAX_INTENTOS ? 'SI' : 'NO' });
      Utilities.sleep(800);
      throw new Error(n >= MAX_INTENTOS ? 'PIN incorrecto. Tu acceso quedó bloqueado; pide a RH que lo reinicie.'
        : 'RFC o PIN incorrecto. Te quedan ' + (MAX_INTENTOS - n) + ' intento(s).');
    }
    update_('Personal', p._row, { pin_intentos: 0, ultimo_acceso: new Date() });
    bitacora_(p.no_empleado, 'login', 'Personal', p.no_empleado, '');
    return sesion_(p);
  });
}

function sesion_(p) {
  const exp = Date.now() + TOKEN_DAYS * 864e5;
  const payload = [p.no_empleado, exp, String(p.pin_hash).slice(0, 10)].join('|');
  const token = Utilities.base64EncodeWebSafe(payload) + '.' + sign_(payload);
  return { token: token, usuario: pickUsuario_(p) };
}

function pickUsuario_(p) {
  return { no_empleado: String(p.no_empleado), nombre: p.nombre, rol: p.rol === 'admin' ? 'admin' : 'empleado', puesto: p.puesto || '' };
}

function auth_(token, adminOnly) {
  if (!token) throw new Error('Sesión requerida');
  const parts = String(token).split('.');
  let payload;
  try { payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(); } catch (e) { throw new Error('Sesión inválida'); }
  if (sign_(payload) !== parts[1]) throw new Error('Sesión inválida');
  const [no, exp, ph] = payload.split('|');
  if (Date.now() > Number(exp)) throw new Error('Sesión expirada');
  const p = rows_('Personal').find(x => String(x.no_empleado) === no);
  if (!p || p.estatus === 'baja' || p.pin_bloqueado === 'SI') throw new Error('Usuario inactivo');
  if (String(p.pin_hash).slice(0, 10) !== ph) throw new Error('Sesión expirada');
  if (adminOnly && p.rol !== 'admin') throw new Error('Sin permiso para esta acción');
  return pickUsuario_(p);
}

function validarPin_(pin) { if (!/^\d{6}$/.test(String(pin || ''))) throw new Error('El PIN debe tener 6 dígitos'); if (/^(\d)\1{5}$|^123456$|^654321$/.test(String(pin))) throw new Error('Ese PIN es muy fácil de adivinar, elige otro'); }

function secret_(key) {
  const p = PropertiesService.getScriptProperties();
  let v = p.getProperty(key);
  if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty(key, v); }
  return v;
}
function sign_(payload) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret_('TOKEN_SECRET'))); }
function hashPin_(no, pin) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(no) + ':' + pin + ':' + secret_('PIN_PEPPER'));
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function cambiarPin_(req, u) {
  return withLock_(() => {
    const p = persona_(u.no_empleado);
    if (hashPin_(p.no_empleado, String(req.actual || '')) !== p.pin_hash) throw new Error('Tu PIN actual no es correcto');
    validarPin_(req.nuevo);
    const hash = hashPin_(p.no_empleado, req.nuevo);
    update_('Personal', p._row, { pin_hash: hash });
    bitacora_(u.no_empleado, 'cambiar_pin', 'Personal', u.no_empleado, '');
    return sesion_(Object.assign({}, p, { pin_hash: hash }));
  });
}

function resetPin_(req, u) {
  const p = persona_(req.no_empleado);
  update_('Personal', p._row, { pin_hash: '', pin_intentos: 0, pin_bloqueado: 'NO' });
  bitacora_(u.no_empleado, 'reset_pin', 'Personal', p.no_empleado, '');
  return true;
}

function registerDevice_(req, u) {
  if (!req.fcm_token) throw new Error('Falta token');
  return withLock_(() => {
    const ex = rows_('Dispositivos').find(d => d.fcm_token === req.fcm_token);
    if (ex) update_('Dispositivos', ex._row, { no_empleado: u.no_empleado, activo: 'SI', fecha_registro: new Date() });
    else append_('Dispositivos', { no_empleado: u.no_empleado, fcm_token: req.fcm_token, plataforma: req.plataforma || 'otro', fecha_registro: new Date(), activo: 'SI' });
    return true;
  });
}

// ───────────────────────── Empleado: inicio y perfil ─────────────────────────

function inicio_(req, u) {
  const per = periodoActual_();
  const a = asistenciaEmpleado_(u.no_empleado, per.id);
  const hoy = hoy_();
  const recibos = recibosDe_(u.no_empleado);
  const pagos = pagosDe_(u.no_empleado);
  const band = bandejaDe_(u.no_empleado);
  const ad = adeudosDe_(u.no_empleado);
  return {
    hoy: hoy,
    periodo: per,
    asistencia: a.totales,
    hoy_detalle: a.dias.find(d => d.fecha === hoy) || null,
    horario: a.horario,
    ultimo_recibo: recibos[0] || null,
    recibos_sin_firmar: recibos.filter(r => !r.firma_fecha && r.estatus !== 'cancelado').length,
    ultimo_pago: pagos[0] || null,
    no_leidos: band.filter(n => !n.leido).length,
    saldo_adeudos: ad.saldo_total,
    cargos_pendientes: ad.cargos_pendientes,
    solicitudes_pendientes: solicitudesDe_(u.no_empleado).filter(s => s.estatus === 'pendiente').length,
    bienvenida: (b => ({ hechos: b.hechos, total: b.total, completa: b.completa, siguiente: b.siguiente })) (bienvenida_(u.no_empleado)),
    accesos: appsPara_(u.no_empleado).filter(a => a.acceso_directo),
  };
}

function perfil_(no) {
  const p = persona_(no);
  const e = empleadosChecador_().find(x => x.no === String(no)) || {};
  return {
    no_empleado: String(p.no_empleado), nombre: p.nombre, rfc: p.rfc, curp: p.curp, nss: p.nss, puesto: p.puesto, area: p.area,
    fecha_ingreso: fmt_(p.fecha_ingreso || e.ingreso, 'yyyy-MM-dd'), antiguedad: antiguedadTexto_(p.fecha_ingreso || e.ingreso),
    clabe: p.clabe ? '•••• ' + String(p.clabe).slice(-4) : '', banco: p.banco, telefono: p.telefono, correo: p.correo,
    horario: { entrada: e.entrada || '', dias: e.diasTxt || '', comida: e.comida || '' },
    vacaciones: vacaciones_(p),
    celular_checador: !!e.celular,
  };
}

// ───────────────────────── Asistencia (mismas reglas que el checador) ─────────────────────────

/** Empleados de la pestaña Empleados del checador, con horario. */
function empleadosChecador_() {
  if (_cache.emp) return _cache.emp;
  const sh = ss_().getSheetByName('Empleados');
  if (!sh || sh.getLastRow() < 2) return (_cache.emp = []);
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  const h = v[0].map(x => String(x).trim());
  const col = name => h.indexOf(name);
  const iNo = col('No. empleado'), iNom = col('Nombre'), iHora = col('Hora de entrada'), iDias = col('Días laborales'),
    iCom = col('Minutos de comida'), iIng = col('Fecha de ingreso'), iCel = col('Celular ID'), iChk = col('Checadas');
  return (_cache.emp = v.slice(1).filter(r => String(r[iNo]).trim()).map(r => ({
    no: String(r[iNo]).trim(), nombre: String(r[iNom]).trim().replace(/\s+/g, ' '),
    entrada: iHora >= 0 ? String(r[iHora]).trim() : '', diasTxt: iDias >= 0 ? String(r[iDias]).trim() : '',
    dias: parseDias_(iDias >= 0 ? r[iDias] : ''), comida: iCom >= 0 && String(r[iCom]).trim() !== '' ? Number(r[iCom]) : 60,
    ingreso: iIng >= 0 ? parseFecha_(r[iIng]) : '', celular: iCel >= 0 ? !!String(r[iCel]).trim() : false,
    checadas: iChk >= 0 ? String(r[iChk]) : '',
  })));
}

function parseDias_(txt) {
  const map = { D: 0, DO: 0, L: 1, LU: 1, M: 2, MA: 2, MI: 3, X: 3, J: 4, JU: 4, V: 5, VI: 5, S: 6, SA: 6 };
  return String(txt || '').split(/[,\s]+/).map(s => quitarAcentos_(s).toUpperCase()).filter(s => s in map).map(s => map[s]);
}

/** Checadas agrupadas por empleado y fecha: { no: { 'yyyy-MM-dd': [{tipo, min, hora, foto}] } } */
function checadasPorDia_(desde, hasta) {
  const key = 'chk:' + desde + ':' + hasta;
  if (_cache[key]) return _cache[key];
  const sh = ss_().getSheetByName('Checadas');
  const out = {};
  if (!sh || sh.getLastRow() < 2) return (_cache[key] = out);
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  const h = v[0].map(x => String(x).trim());
  const iF = h.indexOf('Fecha'), iH = h.indexOf('Hora'), iN = h.indexOf('No. empleado'), iT = h.indexOf('Tipo'), iFoto = h.indexOf('Foto');
  v.slice(1).forEach(r => {
    const f = parseFecha_(r[iF]);
    if (!f || f < desde || f > hasta) return;
    const no = String(r[iN]).trim();
    const tipo = tipoChecada_(r[iT]);
    const min = parseHora_(r[iH]);
    if (!no || !tipo || min == null) return;
    ((out[no] = out[no] || {})[f] = out[no][f] || []).push({ tipo: tipo, min: min, hora: horaTxt_(min), foto: iFoto >= 0 ? r[iFoto] : '' });
  });
  Object.keys(out).forEach(no => Object.keys(out[no]).forEach(f => out[no][f].sort((a, b) => a.min - b.min)));
  return (_cache[key] = out);
}

function tipoChecada_(t) {
  const s = quitarAcentos_(String(t || '')).toUpperCase().replace(/_/g, ' ');
  if (/REGRES/.test(s)) return 'REGRESO_COMIDA';
  if (/COM/.test(s)) return 'SALIDA_COMIDA';
  if (/ENTRADA/.test(s)) return 'ENTRADA';
  if (/SALIDA/.test(s)) return 'SALIDA';
  return '';
}

/** Justificadas del checador: { 'yyyy-MM-dd': { '*': motivo, '45': motivo } } */
function justificadas_() {
  if (_cache.just) return _cache.just;
  const out = {};
  const sh = ss_().getSheetByName('Justificadas');
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 4).getDisplayValues().forEach(r => {
      const f = parseFecha_(r[0]);
      if (!f) return;
      (out[f] = out[f] || {})[String(r[1]).trim() || '*'] = String(r[2] || 'Justificada').trim() || 'Justificada';
    });
  }
  return (_cache.just = out);
}

/**
 * Calcula asistencia de un empleado en un periodo.
 * Reglas: tolerancia 0; minutos tarde de entrada + minutos extra de comida = retraso;
 * falta = día laboral sin ENTRADA (vale HORAS_POR_FALTA); justificadas no cuentan.
 */
function asistenciaEmpleado_(no, periodoId) {
  no = String(no);
  const per = periodo_(periodoId || periodoActual_().id);
  const e = empleadosChecador_().find(x => x.no === no);
  const p = rows_('Personal').find(x => String(x.no_empleado) === no) || {};
  const hoy = hoy_();
  const horasFalta = Number(config_('HORAS_POR_FALTA', 8));
  const desdeSistema = parseFecha_(config_('ASISTENCIA_DESDE', '')) || per.desde;
  const ingreso = parseFecha_(p.fecha_ingreso) || (e && e.ingreso) || '';
  const ini = [per.desde, desdeSistema, ingreso].filter(String).sort().pop();
  const fin = per.hasta < hoy ? per.hasta : hoy;
  const chk = (checadasPorDia_(per.desde, per.hasta)[no]) || {};
  const just = justificadas_();
  const horario = e ? { entrada: e.entrada, dias: e.diasTxt, comida: e.comida } : null;
  const sinHorario = !e || !e.entrada || !e.dias.length;
  const entradaMin = e ? parseHora_(e.entrada) : null;

  const dias = [];
  const t = { dias_laborales: 0, asistencias: 0, faltas: 0, justificadas: 0, retardos: 0, min_tarde: 0,
    retardos_comida: 0, min_comida_extra: 0, min_total: 0, horas_retraso: 0, horas_faltas: 0, horas_descuento: 0 };

  for (let f = per.desde; f <= per.hasta; f = addDias_(f, 1)) {
    const marcas = chk[f] || [];
    const dow = diaSemana_(f);
    const laboral = !sinHorario && e.dias.indexOf(dow) >= 0;
    const d = { fecha: f, dia: DIAS_CORTOS[dow], laboral: laboral, marcas: marcas.map(m => ({ tipo: m.tipo, hora: m.hora })),
      entrada: '', debia: laboral ? e.entrada : '', min_tarde: 0, min_comida: null, min_comida_extra: 0, estado: '' };
    const ent = marcas.find(m => m.tipo === 'ENTRADA');
    const sal = marcas.find(m => m.tipo === 'SALIDA_COMIDA');
    const reg = marcas.filter(m => m.tipo === 'REGRESO_COMIDA' && (!sal || m.min > sal.min))[0];
    if (ent) d.entrada = ent.hora;
    if (sal && reg) {
      d.min_comida = Math.floor(reg.min - sal.min);
      d.min_comida_extra = Math.max(0, d.min_comida - (e ? e.comida : 60));
    }
    if (f > fin) d.estado = 'FUTURO';
    else if (f < ini) d.estado = marcas.length ? 'ANTES' : 'SIN_DATOS';
    else if (sinHorario) d.estado = 'SIN_HORARIO';
    else if (!laboral) d.estado = marcas.length ? 'DESCANSO_TRABAJADO' : 'DESCANSO';
    else {
      const j = just[f] && (just[f][no] || just[f]['*']);
      t.dias_laborales++;
      if (j && !ent) { d.estado = 'JUSTIFICADA'; d.motivo = j; t.justificadas++; }
      else if (!ent) {
        if (f === hoy) { d.estado = 'PENDIENTE'; t.dias_laborales--; }
        else { d.estado = 'FALTA'; t.faltas++; }
      } else {
        t.asistencias++;
        d.min_tarde = entradaMin == null ? 0 : Math.max(0, Math.floor(ent.min - entradaMin));
        if (d.min_tarde > 0) { t.retardos++; t.min_tarde += d.min_tarde; }
        if (d.min_comida_extra > 0) { t.retardos_comida++; t.min_comida_extra += d.min_comida_extra; }
        d.estado = d.min_tarde > 0 || d.min_comida_extra > 0 ? 'RETARDO' : 'A_TIEMPO';
        if (j) d.motivo = j;
      }
    }
    dias.push(d);
  }
  t.min_total = t.min_tarde + t.min_comida_extra;
  t.horas_retraso = round_(t.min_total / 60, 2);
  t.horas_faltas = t.faltas * horasFalta;
  t.horas_descuento = round_(t.horas_retraso + t.horas_faltas, 2);
  return { no_empleado: no, nombre: (e && e.nombre) || p.nombre || '', periodo: per, horario: horario, sin_horario: sinHorario,
    cuenta_desde: ini, dias: dias, totales: t };
}

function asistenciaGeneral_(periodoId) {
  const per = periodo_(periodoId || periodoActual_().id);
  const hoy = hoy_();
  const activos = rows_('Personal').filter(p => p.estatus !== 'baja');
  const lista = activos.map(p => {
    const a = asistenciaEmpleado_(p.no_empleado, per.id);
    const d = a.dias.find(x => x.fecha === hoy);
    return { no_empleado: String(p.no_empleado), nombre: a.nombre || p.nombre, puesto: p.puesto || '', sin_horario: a.sin_horario,
      totales: a.totales, hoy: d ? { estado: d.estado, entrada: d.entrada, min_tarde: d.min_tarde, debia: d.debia, laboral: d.laboral } : null };
  }).sort((a, b) => b.totales.horas_descuento - a.totales.horas_descuento || String(a.nombre).localeCompare(String(b.nombre)));
  return { periodo: per, hoy: hoy, empleados: lista };
}

// ───────────────────────── Periodos ─────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** id = 'yyyy-MM-1' (1 al 15) o 'yyyy-MM-2' (16 a fin de mes) */
function periodo_(id) {
  const m = String(id || '').match(/^(\d{4})-(\d{2})-([12])$/);
  if (!m) throw new Error('Periodo inválido: ' + id);
  const y = Number(m[1]), mo = Number(m[2]), q = Number(m[3]);
  const ultimo = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const pad = n => ('0' + n).slice(-2);
  return {
    id: id, desde: y + '-' + pad(mo) + '-' + (q === 1 ? '01' : '16'), hasta: y + '-' + pad(mo) + '-' + (q === 1 ? '15' : pad(ultimo)),
    etiqueta: (q === 1 ? '1ª' : '2ª') + ' quincena de ' + MESES[mo - 1] + ' ' + y,
    corta: (q === 1 ? '1ª' : '2ª') + ' ' + MESES[mo - 1].slice(0, 3) + ' ' + y,
  };
}
function periodoDeFecha_(f) { const [y, m, d] = f.split('-'); return periodo_(y + '-' + m + '-' + (Number(d) <= 15 ? 1 : 2)); }
function periodoActual_() { return periodoDeFecha_(hoy_()); }
function periodoAnterior_(id) { const p = periodo_(id); return periodoDeFecha_(addDias_(p.desde, -1)); }

// ───────────────────────── Nómina: prenómina y recibos ─────────────────────────

function prenomina_(periodoId) {
  const per = periodo_(periodoId);
  const diasQ = Number(config_('DIAS_QUINCENA', 15));
  const horasJ = Number(config_('HORAS_JORNADA', 8));
  const recibos = rows_('Recibos').filter(r => r.estatus !== 'cancelado');
  const cobrados = {};
  recibos.forEach(r => { try { (JSON.parse(r.detalle_json || '{}').cargos || []).forEach(c => cobrados[c.rep_id] = r.recibo_id); } catch (e) {} });
  const adeudos = rows_('Adeudos').filter(a => a.estatus === 'activo' && Number(a.saldo) > 0);
  const cargosFl = cargosFlotilla_();

  const filas = rows_('Personal').filter(p => p.estatus !== 'baja').map(p => {
    const no = String(p.no_empleado);
    const a = asistenciaEmpleado_(no, per.id);
    const sd = Number(p.salario_diario || 0);
    const vh = sd / horasJ;
    const cargos = p.flotilla_id ? cargosFl.filter(c => c.responsable_id === String(p.flotilla_id) && !cobrados[c.rep_id] && c.fecha <= per.hasta) : [];
    const abonos = adeudos.filter(x => String(x.no_empleado) === no).map(x => ({ adeudo_id: x.adeudo_id, concepto: x.concepto,
      monto: round_(Math.min(Number(x.cuota || x.saldo), Number(x.saldo)), 2), saldo: Number(x.saldo) }));
    const ya = recibos.find(r => String(r.no_empleado) === no && r.periodo === per.id);
    const f = {
      no_empleado: no, nombre: a.nombre || p.nombre, rfc: p.rfc || '', puesto: p.puesto || '', salario_diario: sd, dias: diasQ,
      sin_salario: !sd, sin_clabe: !p.clabe, sin_horario: a.sin_horario,
      asistencia: a.totales,
      sueldo: round_(sd * diasQ, 2), bonos: 0, otras_percepciones: 0,
      desc_faltas: round_(a.totales.faltas * sd, 2),
      desc_retardos: round_(a.totales.horas_retraso * vh, 2),
      desc_cargos: round_(cargos.reduce((s, c) => s + c.monto, 0), 2),
      desc_adeudos: round_(abonos.reduce((s, x) => s + x.monto, 0), 2),
      otras_deducciones: 0,
      cargos: cargos, abonos: abonos, notas: '',
      recibo_existente: ya ? { recibo_id: ya.recibo_id, neto: Number(ya.neto), estatus: ya.estatus } : null,
    };
    return totales_(f);
  });
  return { periodo: per, filas: filas.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))) };
}

function totales_(f) {
  const n = k => Number(f[k] || 0);
  f.total_percepciones = round_(n('sueldo') + n('bonos') + n('otras_percepciones'), 2);
  f.total_deducciones = round_(n('desc_faltas') + n('desc_retardos') + n('desc_cargos') + n('desc_adeudos') + n('otras_deducciones'), 2);
  f.neto = round_(Math.max(0, f.total_percepciones - f.total_deducciones), 2);
  return f;
}

/** req.filas: filas de la prenómina (editadas por el patrón). Solo se emiten las que vienen. */
function emitirRecibos_(req, u) {
  const per = periodo_(req.periodo);
  const filas = req.filas || [];
  if (!filas.length) throw new Error('No hay recibos que emitir');
  const emitidos = [];
  filas.forEach(fila => {
    const r = withLock_(() => emitirUno_(per, fila, u, !!req.reemplazar));
    emitidos.push(r);
    notificar_(r.no_empleado, 'recibo', '🧾 Tu recibo de nómina está listo',
      per.etiqueta + ': neto ' + money_(r.neto) + '. Ábrelo para revisarlo y firmarlo.', r.recibo_id);
  });
  return { emitidos: emitidos.length, recibos: emitidos };
}

function emitirUno_(per, fila, u, reemplazar) {
  const no = String(fila.no_empleado);
  const p = persona_(no);
  const previo = rows_('Recibos').find(r => String(r.no_empleado) === no && r.periodo === per.id && r.estatus !== 'cancelado');
  if (previo) {
    if (!reemplazar) throw new Error(p.nombre + ' ya tiene recibo de ' + per.etiqueta + ' (' + previo.recibo_id + ')');
    if (previo.estatus === 'pagado') throw new Error('El recibo ' + previo.recibo_id + ' ya está pagado; cancélalo a mano si de verdad quieres reemplazarlo');
    cancelarInterno_(previo, u, 'Reemplazado');
  }
  const f = totales_(Object.assign({}, fila, {
    sueldo: num_(fila.sueldo), bonos: num_(fila.bonos), otras_percepciones: num_(fila.otras_percepciones),
    desc_faltas: num_(fila.desc_faltas), desc_retardos: num_(fila.desc_retardos), desc_cargos: num_(fila.desc_cargos),
    desc_adeudos: num_(fila.desc_adeudos), otras_deducciones: num_(fila.otras_deducciones),
  }));
  const id = nextId_('REC', 6);
  const detalle = {
    asistencia: fila.asistencia || null,
    cargos: (fila.cargos || []).map(c => ({ rep_id: c.rep_id, fecha: c.fecha, vehiculo_id: c.vehiculo_id, descripcion: c.descripcion, monto: num_(c.monto) })),
    abonos: (fila.abonos || []).filter(a => num_(a.monto) > 0).map(a => ({ adeudo_id: a.adeudo_id, concepto: a.concepto, monto: num_(a.monto) })),
    notas: String(fila.notas || ''), concepto_bonos: String(fila.concepto_bonos || ''), concepto_otras: String(fila.concepto_otras || ''),
  };
  const rec = {
    recibo_id: id, no_empleado: no, nombre: p.nombre, periodo: per.id, desde: per.desde, hasta: per.hasta, dias: num_(fila.dias),
    salario_diario: num_(p.salario_diario || fila.salario_diario), sueldo: f.sueldo, bonos: f.bonos, otras_percepciones: f.otras_percepciones,
    desc_faltas: f.desc_faltas, desc_retardos: f.desc_retardos, desc_cargos: f.desc_cargos, desc_adeudos: f.desc_adeudos,
    otras_deducciones: f.otras_deducciones, total_percepciones: f.total_percepciones, total_deducciones: f.total_deducciones, neto: f.neto,
    detalle_json: JSON.stringify(detalle), estatus: 'emitido', fecha_emision: new Date(), emitido_por: u.no_empleado,
  };
  rec.pdf_id = crearPdfRecibo_(rec, p, per, detalle);
  append_('Recibos', rec);
  detalle.abonos.forEach(a => {
    const ad = rows_('Adeudos').find(x => x.adeudo_id === a.adeudo_id);
    if (!ad) return;
    const saldo = round_(Math.max(0, Number(ad.saldo) - a.monto), 2);
    update_('Adeudos', ad._row, { saldo: saldo, estatus: saldo <= 0 ? 'liquidado' : 'activo' });
    append_('Abonos', { abono_id: nextId_('AB', 6), adeudo_id: a.adeudo_id, no_empleado: no, fecha: new Date(), monto: a.monto, recibo_id: id });
  });
  bitacora_(u.no_empleado, 'emitir_recibo', 'Recibos', id, no + ' ' + per.id + ' neto ' + f.neto);
  return { recibo_id: id, no_empleado: no, nombre: p.nombre, neto: f.neto };
}

function cancelarRecibo_(req, u) {
  return withLock_(() => {
    const r = rows_('Recibos').find(x => x.recibo_id === req.recibo_id);
    if (!r) throw new Error('Recibo no encontrado');
    if (r.estatus === 'cancelado') return true;
    cancelarInterno_(r, u, req.motivo || 'Cancelado por RH');
    return true;
  });
}

function cancelarInterno_(r, u, motivo) {
  rows_('Abonos').filter(a => a.recibo_id === r.recibo_id).sort((a, b) => b._row - a._row).forEach(a => {
    const ad = rows_('Adeudos').find(x => x.adeudo_id === a.adeudo_id);
    if (ad) update_('Adeudos', ad._row, { saldo: round_(Number(ad.saldo) + Number(a.monto), 2), estatus: 'activo' });
    sheet_('Abonos').deleteRow(a._row);
    delete _cache['r:Abonos'];
  });
  update_('Recibos', r._row, { estatus: 'cancelado' });
  if (r.pago_id) {
    const pg = rows_('Pagos').find(x => x.pago_id === r.pago_id);
    if (pg) update_('Pagos', pg._row, { recibo_id: '', cuadra: 'SIN RECIBO' });
  }
  bitacora_(u.no_empleado, 'cancelar_recibo', 'Recibos', r.recibo_id, motivo);
}

function recibosAdmin_(periodoId) {
  return rows_('Recibos').filter(r => !periodoId || r.periodo === periodoId).map(pickRecibo_).sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));
}

function recibosDe_(no) {
  return rows_('Recibos').filter(r => String(r.no_empleado) === String(no) && r.estatus !== 'cancelado').map(pickRecibo_)
    .sort((a, b) => b.desde.localeCompare(a.desde) || b.fecha_emision.localeCompare(a.fecha_emision));
}

function pickRecibo_(r) {
  let det = {};
  try { det = JSON.parse(r.detalle_json || '{}'); } catch (e) {}
  const per = (() => { try { return periodo_(r.periodo); } catch (e) { return { etiqueta: r.periodo }; } })();
  return {
    recibo_id: r.recibo_id, no_empleado: String(r.no_empleado), nombre: r.nombre, periodo: r.periodo, etiqueta: per.etiqueta,
    desde: fmt_(r.desde, 'yyyy-MM-dd'), hasta: fmt_(r.hasta, 'yyyy-MM-dd'), dias: Number(r.dias), salario_diario: Number(r.salario_diario),
    sueldo: Number(r.sueldo), bonos: Number(r.bonos), otras_percepciones: Number(r.otras_percepciones),
    desc_faltas: Number(r.desc_faltas), desc_retardos: Number(r.desc_retardos), desc_cargos: Number(r.desc_cargos),
    desc_adeudos: Number(r.desc_adeudos), otras_deducciones: Number(r.otras_deducciones),
    total_percepciones: Number(r.total_percepciones), total_deducciones: Number(r.total_deducciones), neto: Number(r.neto),
    detalle: det, estatus: r.estatus, fecha_emision: fmt_(r.fecha_emision, 'yyyy-MM-dd HH:mm'),
    firma_fecha: fmt_(r.firma_fecha, 'yyyy-MM-dd HH:mm'), pago_id: r.pago_id || '', fecha_pago: fmt_(r.fecha_pago, 'yyyy-MM-dd HH:mm'),
  };
}

function reciboPropio_(id, u) {
  const r = rows_('Recibos').find(x => x.recibo_id === id);
  if (!r || (String(r.no_empleado) !== u.no_empleado && u.rol !== 'admin')) throw new Error('Recibo no encontrado');
  return r;
}
function reciboDetalle_(id, u) { return pickRecibo_(reciboPropio_(id, u)); }
function reciboPdf_(id, u) {
  const r = reciboPropio_(id, u);
  if (!r.pdf_id) throw new Error('Este recibo no tiene PDF');
  const blob = DriveApp.getFileById(r.pdf_id).getBlob();
  return { nombre: 'Recibo ' + r.recibo_id + '.pdf', mime: 'application/pdf', base64: Utilities.base64Encode(blob.getBytes()) };
}

function firmarRecibo_(req, u) {
  return withLock_(() => {
    const r = reciboPropio_(req.recibo_id, u);
    if (String(r.no_empleado) !== u.no_empleado) throw new Error('Solo el empleado puede firmar su recibo');
    if (r.estatus === 'cancelado') throw new Error('Este recibo fue cancelado');
    if (r.firma_fecha) return pickRecibo_(r);
    const p = persona_(u.no_empleado);
    if (hashPin_(p.no_empleado, String(req.pin || '')) !== p.pin_hash) throw new Error('PIN incorrecto');
    update_('Recibos', r._row, { firma_fecha: new Date(), firma_dispositivo: String(req.dispositivo || '').slice(0, 200) });
    bitacora_(u.no_empleado, 'firmar_recibo', 'Recibos', r.recibo_id, '');
    return pickRecibo_(rows_('Recibos').find(x => x.recibo_id === r.recibo_id));
  });
}

function crearPdfRecibo_(rec, p, per, det) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fila = (l, v) => v ? '<tr><td>' + esc(l) + '</td><td class="n">' + money_(v) + '</td></tr>' : '';
  const a = det.asistencia || {};
  const html = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#17202b;margin:28px}' +
    'h1{font-size:16px;margin:0}h2{font-size:12px;margin:18px 0 6px;color:#1f3a5f;text-transform:uppercase;letter-spacing:.04em}' +
    '.top{border-bottom:3px solid #1f3a5f;padding-bottom:8px;display:flex;justify-content:space-between}' +
    '.muted{color:#637083}table{width:100%;border-collapse:collapse}td{padding:4px 6px;border-bottom:1px solid #dde3ea}' +
    '.n{text-align:right}.tot td{font-weight:bold;border-top:2px solid #1f3a5f}.neto{font-size:15px;background:#f3f5f8}' +
    '.cols{width:100%}.cols td{vertical-align:top;width:50%;border:0;padding:0 8px 0 0}.leg{margin-top:24px;font-size:9px;color:#637083}' +
    '</style></head><body>' +
    '<div class="top"><div><h1>' + esc(EMPRESA) + '</h1><div class="muted">' + esc(EMPRESA_DOMICILIO) + '</div></div>' +
    '<div style="text-align:right"><b>Recibo de nómina</b><br>' + esc(rec.recibo_id) + '<br>' + esc(per.etiqueta) + '</div></div>' +
    '<h2>Empleado</h2><table>' +
    '<tr><td>Nombre</td><td>' + esc(p.nombre) + '</td><td>No. empleado</td><td>' + esc(p.no_empleado) + '</td></tr>' +
    '<tr><td>RFC</td><td>' + esc(p.rfc) + '</td><td>CURP</td><td>' + esc(p.curp) + '</td></tr>' +
    '<tr><td>Puesto</td><td>' + esc(p.puesto) + '</td><td>NSS</td><td>' + esc(p.nss) + '</td></tr>' +
    '<tr><td>Periodo</td><td>' + esc(per.desde) + ' al ' + esc(per.hasta) + '</td><td>Salario diario</td><td>' + money_(rec.salario_diario) + '</td></tr>' +
    '</table>' +
    '<table class="cols"><tr><td><h2>Percepciones</h2><table>' +
    fila('Sueldo (' + rec.dias + ' días)', rec.sueldo) + fila('Bonos' + (det.concepto_bonos ? ' · ' + det.concepto_bonos : ''), rec.bonos) +
    fila('Otras percepciones' + (det.concepto_otras ? ' · ' + det.concepto_otras : ''), rec.otras_percepciones) +
    '<tr class="tot"><td>Total</td><td class="n">' + money_(rec.total_percepciones) + '</td></tr></table></td>' +
    '<td><h2>Deducciones</h2><table>' +
    fila('Faltas (' + (a.faltas || 0) + ')', rec.desc_faltas) + fila('Retardos (' + horasTxt_(a.min_total || 0) + ')', rec.desc_retardos) +
    fila('Cargos de flotilla', rec.desc_cargos) + fila('Abono a adeudos', rec.desc_adeudos) + fila('Otras deducciones', rec.otras_deducciones) +
    '<tr class="tot"><td>Total</td><td class="n">' + money_(rec.total_deducciones) + '</td></tr></table></td></tr></table>' +
    '<table style="margin-top:14px"><tr class="tot neto"><td>NETO A PAGAR</td><td class="n">' + money_(rec.neto) + '</td></tr></table>' +
    ((det.cargos || []).length ? '<h2>Detalle de cargos</h2><table>' + det.cargos.map(c => '<tr><td>' + esc(c.rep_id) + ' · ' + esc(c.vehiculo_id) + ' · ' + esc(c.descripcion) + '</td><td class="n">' + money_(c.monto) + '</td></tr>').join('') + '</table>' : '') +
    ((det.abonos || []).length ? '<h2>Detalle de abonos</h2><table>' + det.abonos.map(x => '<tr><td>' + esc(x.adeudo_id) + ' · ' + esc(x.concepto) + '</td><td class="n">' + money_(x.monto) + '</td></tr>').join('') + '</table>' : '') +
    (det.notas ? '<h2>Notas</h2><p>' + esc(det.notas) + '</p>' : '') +
    '<p class="leg">Comprobante interno de pago emitido el ' + fmt_(new Date(), 'yyyy-MM-dd HH:mm') + '. No sustituye al CFDI de nómina. ' +
    'El empleado confirma su recepción desde el Portal Packatelas con su PIN personal; la fecha de confirmación queda registrada.</p>' +
    '</body></html>';
  const pdf = Utilities.newBlob(html, 'text/html', rec.recibo_id + '.html').getAs('application/pdf').setName(rec.recibo_id + ' · ' + p.nombre + ' · ' + per.id + '.pdf');
  const folder = subfolder_(DriveApp.getFolderById(config_('RECIBOS_FOLDER_ID')), per.id.slice(0, 7));
  return folder.createFile(pdf).getId();
}

// ───────────────────────── Pagos (Fondeadora vía Gmail) ─────────────────────────

/** Trigger cada 5 min. */
function tareaFondeadora() { revisarFondeadora_(3, true); }

/** Ejecutar una vez a mano para traer depósitos viejos sin mandar notificaciones. */
function importarPagosHistoricos() { console.log(JSON.stringify(revisarFondeadora_(60, false))); }

/** Extrae los datos del correo "Transferencia exitosa". Devuelve null si no es ese formato. */
function parseFondeadora_(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ');
  const m = t.match(/transferencia de \$\s?([\d,]+(?:\.\d{1,2})?) a (\d{18}) por el concepto de (.*?)\.?\s*Clave de rastreo:?\s*([A-Z0-9]+)/i);
  if (!m) return null;
  return { monto: Number(m[1].replace(/,/g, '')), clabe: m[2], concepto: m[3].trim(), clave_rastreo: m[4] };
}

function revisarFondeadora_(dias, notificar) {
  const remitente = config_('FONDEADORA_REMITENTE', 'info@negocios.fondeadora.com');
  const threads = GmailApp.search('from:' + remitente + ' subject:"Transferencia exitosa" newer_than:' + dias + 'd', 0, 200);
  const porClabe = {};
  rows_('Personal').forEach(p => { const c = String(p.clabe || '').replace(/\D/g, ''); if (c.length === 18) porClabe[c] = p; });
  const vistos = {};
  rows_('Pagos').forEach(p => { if (p.gmail_id) vistos[p.gmail_id] = 1; if (p.clave_rastreo) vistos['cr:' + p.clave_rastreo] = 1; });
  let nuevos = 0, sinMatch = 0;
  const msgs = [];
  threads.forEach(th => th.getMessages().forEach(m => msgs.push(m)));
  msgs.sort((a, b) => a.getDate() - b.getDate());
  msgs.forEach(m => {
    const id = m.getId();
    if (vistos[id] || !/Transferencia exitosa/i.test(m.getSubject())) return;
    const d = parseFondeadora_(m.getPlainBody());
    if (!d || vistos['cr:' + d.clave_rastreo]) return;
    const p = porClabe[d.clabe];
    if (!p) { sinMatch++; return; }
    withLock_(() => registrarPago_(p, d, m.getDate(), id, 'fondeadora', notificar));
    vistos[id] = 1; vistos['cr:' + d.clave_rastreo] = 1;
    nuevos++;
  });
  return { revisados: msgs.length, pagos_nuevos: nuevos, transferencias_a_otros: sinMatch };
}

function registrarPago_(p, d, fecha, gmailId, origen, notificar) {
  const no = String(p.no_empleado);
  const tol = Number(config_('TOLERANCIA_PAGO', 1));
  const pendientes = rows_('Recibos').filter(r => String(r.no_empleado) === no && r.estatus === 'emitido' && !r.pago_id)
    .sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
  const recibo = pendientes.find(r => Math.abs(Number(r.neto) - d.monto) <= tol);
  const esNomina = /n[oó]mina|quincena|sueldo/i.test(d.concepto);
  const cuadra = recibo ? 'SI' : (esNomina && pendientes.length ? 'NO' : 'SIN RECIBO');
  const pagoId = nextId_('PAG', 6);
  append_('Pagos', { pago_id: pagoId, fecha: fecha, no_empleado: no, nombre: p.nombre, monto: d.monto, clabe: d.clabe, concepto: d.concepto,
    clave_rastreo: d.clave_rastreo, gmail_id: gmailId || '', recibo_id: recibo ? recibo.recibo_id : '', cuadra: cuadra, origen: origen,
    notificado: notificar ? 'SI' : 'NO' });
  if (recibo) update_('Recibos', recibo._row, { estatus: 'pagado', pago_id: pagoId, fecha_pago: fecha });
  if (notificar) {
    notificar_(no, 'pago', '💸 Te depositamos ' + money_(d.monto),
      'Concepto: ' + d.concepto + (recibo ? ' · Recibo ' + recibo.recibo_id : '') + ' · Rastreo ' + d.clave_rastreo, pagoId);
    if (cuadra === 'NO') {
      const r0 = pendientes[0];
      notificarAdmins_('alerta', '⚠️ Depósito que no cuadra', p.nombre + ': se depositó ' + money_(d.monto) + ' y su recibo ' + r0.recibo_id + ' es de ' + money_(r0.neto) + '.', pagoId, true);
    }
  }
  return pagoId;
}

function pagosDe_(no) {
  return rows_('Pagos').filter(p => String(p.no_empleado) === String(no)).map(pickPago_).sort((a, b) => b.fecha.localeCompare(a.fecha));
}
function pickPago_(p) {
  return { pago_id: p.pago_id, fecha: fmt_(p.fecha, 'yyyy-MM-dd HH:mm'), no_empleado: String(p.no_empleado), nombre: p.nombre, monto: Number(p.monto),
    concepto: p.concepto, clave_rastreo: p.clave_rastreo, recibo_id: p.recibo_id, cuadra: p.cuadra, origen: p.origen,
    clabe: p.clabe ? '•••• ' + String(p.clabe).slice(-4) : '' };
}

function pagosAdmin_(req) {
  const desde = req.desde || addDias_(hoy_(), -45);
  return rows_('Pagos').map(pickPago_).filter(p => p.fecha.slice(0, 10) >= desde).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function asignarPago_(req, u) {
  return withLock_(() => {
    const pg = rows_('Pagos').find(x => x.pago_id === req.pago_id);
    if (!pg) throw new Error('Pago no encontrado');
    if (pg.recibo_id) {
      const viejo = rows_('Recibos').find(r => r.recibo_id === pg.recibo_id);
      if (viejo) update_('Recibos', viejo._row, { estatus: 'emitido', pago_id: '', fecha_pago: '' });
    }
    if (req.recibo_id) {
      const r = rows_('Recibos').find(x => x.recibo_id === req.recibo_id);
      if (!r || String(r.no_empleado) !== String(pg.no_empleado)) throw new Error('El recibo no es de ese empleado');
      update_('Recibos', r._row, { estatus: 'pagado', pago_id: pg.pago_id, fecha_pago: pg.fecha });
      update_('Pagos', pg._row, { recibo_id: r.recibo_id, cuadra: Math.abs(Number(r.neto) - Number(pg.monto)) <= Number(config_('TOLERANCIA_PAGO', 1)) ? 'SI' : 'MANUAL' });
    } else update_('Pagos', pg._row, { recibo_id: '', cuadra: 'SIN RECIBO' });
    bitacora_(u.no_empleado, 'asignar_pago', 'Pagos', pg.pago_id, req.recibo_id || 'sin recibo');
    return true;
  });
}

function pagoManual_(req, u) {
  const p = persona_(req.no_empleado);
  const monto = num_(req.monto);
  if (!(monto > 0)) throw new Error('Monto inválido');
  const id = withLock_(() => registrarPago_(p, { monto: monto, clabe: String(p.clabe || ''), concepto: req.concepto || 'Pago en efectivo', clave_rastreo: 'MANUAL-' + Date.now() },
    req.fecha ? parseFecha_(req.fecha) : new Date(), '', 'manual', req.notificar !== false));
  bitacora_(u.no_empleado, 'pago_manual', 'Pagos', id, p.no_empleado + ' ' + monto);
  return id;
}

// ───────────────────────── Adeudos y cargos de flotilla ─────────────────────────

/** Reparaciones con monto a cargo del empleado (hoja de la flotilla). */
function cargosFlotilla_() {
  if (_cache.cargosFl) return _cache.cargosFl;
  let out = [];
  try {
    const fl = SpreadsheetApp.openById(FLOTILLA_ID);
    const reps = sheetRows_(fl.getSheetByName('Reparaciones'));
    const fallas = sheetRows_(fl.getSheetByName('Fallas'));
    out = reps.filter(r => Number(r.monto_empleado) > 0 && r.fecha_cierre).map(r => {
      const f = fallas.find(x => x.falla_id === r.falla_id) || {};
      return { rep_id: String(r.rep_id), falla_id: r.falla_id, fecha: fmt_(r.fecha_cierre, 'yyyy-MM-dd'), vehiculo_id: r.vehiculo_id,
        responsable_id: String(r.responsable_id), descripcion: String(f.descripcion || r.descripcion || '').slice(0, 140), causa: r.causa,
        costo_total: Number(r.costo_total || 0), monto: Number(r.monto_empleado) };
    });
  } catch (e) { console.warn('flotilla', e); }
  return (_cache.cargosFl = out);
}

function adeudosDe_(no) {
  const p = rows_('Personal').find(x => String(x.no_empleado) === String(no)) || {};
  const ad = rows_('Adeudos').filter(a => String(a.no_empleado) === String(no)).map(pickAdeudo_);
  const abonos = rows_('Abonos').filter(a => String(a.no_empleado) === String(no)).map(a => ({ adeudo_id: a.adeudo_id, fecha: fmt_(a.fecha, 'yyyy-MM-dd'), monto: Number(a.monto), recibo_id: a.recibo_id }));
  const cobrados = {};
  rows_('Recibos').filter(r => r.estatus !== 'cancelado' && String(r.no_empleado) === String(no)).forEach(r => {
    try { (JSON.parse(r.detalle_json || '{}').cargos || []).forEach(c => cobrados[c.rep_id] = r.recibo_id); } catch (e) {}
  });
  const cargos = p.flotilla_id ? cargosFlotilla_().filter(c => c.responsable_id === String(p.flotilla_id))
    .map(c => Object.assign({}, c, { recibo_id: cobrados[c.rep_id] || '', estatus: cobrados[c.rep_id] ? 'descontado' : 'pendiente' }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];
  return {
    adeudos: ad, abonos: abonos.sort((a, b) => b.fecha.localeCompare(a.fecha)), cargos: cargos,
    saldo_total: round_(ad.filter(a => a.estatus === 'activo').reduce((s, a) => s + a.saldo, 0), 2),
    cargos_pendientes: round_(cargos.filter(c => c.estatus === 'pendiente').reduce((s, c) => s + c.monto, 0), 2),
  };
}

function pickAdeudo_(a) {
  return { adeudo_id: a.adeudo_id, no_empleado: String(a.no_empleado), nombre: a.nombre, concepto: a.concepto, monto_total: Number(a.monto_total),
    cuota: Number(a.cuota), saldo: Number(a.saldo), fecha_alta: fmt_(a.fecha_alta, 'yyyy-MM-dd'), estatus: a.estatus, origen: a.origen, notas: a.notas };
}

function adeudosAdmin_() {
  const per = rows_('Personal');
  return {
    adeudos: rows_('Adeudos').map(pickAdeudo_).sort((a, b) => (a.estatus === 'activo' ? 0 : 1) - (b.estatus === 'activo' ? 0 : 1) || b.fecha_alta.localeCompare(a.fecha_alta)),
    cargos: cargosFlotilla_().map(c => {
      const p = per.find(x => String(x.flotilla_id) === c.responsable_id);
      return Object.assign({}, c, { no_empleado: p ? String(p.no_empleado) : '', nombre: p ? p.nombre : '(sin ligar: ' + c.responsable_id + ')' });
    }).sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}

function guardarAdeudo_(req, u) {
  return withLock_(() => {
    const monto = num_(req.monto_total), cuota = num_(req.cuota);
    if (req.adeudo_id) {
      const a = rows_('Adeudos').find(x => x.adeudo_id === req.adeudo_id);
      if (!a) throw new Error('Adeudo no encontrado');
      const upd = { concepto: req.concepto || a.concepto, cuota: cuota || a.cuota, notas: req.notas == null ? a.notas : req.notas };
      if (req.estatus) upd.estatus = req.estatus;
      if (req.saldo != null && req.saldo !== '') upd.saldo = num_(req.saldo);
      update_('Adeudos', a._row, upd);
      bitacora_(u.no_empleado, 'editar_adeudo', 'Adeudos', a.adeudo_id, JSON.stringify(upd));
      return a.adeudo_id;
    }
    const p = persona_(req.no_empleado);
    if (!(monto > 0)) throw new Error('Monto inválido');
    const id = nextId_('AD', 5);
    append_('Adeudos', { adeudo_id: id, no_empleado: p.no_empleado, nombre: p.nombre, concepto: req.concepto || 'Préstamo', monto_total: monto,
      cuota: cuota || monto, saldo: monto, fecha_alta: new Date(), estatus: 'activo', origen: req.origen || 'RH', notas: req.notas || '' });
    bitacora_(u.no_empleado, 'nuevo_adeudo', 'Adeudos', id, p.no_empleado + ' ' + monto);
    notificar_(p.no_empleado, 'adeudo', 'Nuevo adeudo registrado', (req.concepto || 'Préstamo') + ': ' + money_(monto) + ', se descontarán ' + money_(cuota || monto) + ' por quincena.', id);
    return id;
  });
}

// ───────────────────────── Solicitudes (justificantes, vacaciones, permisos, anticipos) ─────────────────────────

const TIPOS_SOL = { justificante: 'Justificante de falta', vacaciones: 'Vacaciones', permiso: 'Permiso', anticipo: 'Anticipo de nómina', otro: 'Otro' };

function crearSolicitud_(req, u) {
  const tipo = String(req.tipo || '');
  if (!TIPOS_SOL[tipo]) throw new Error('Tipo de solicitud inválido');
  const desde = req.fecha_desde ? parseFecha_(req.fecha_desde) : '';
  const hasta = req.fecha_hasta ? parseFecha_(req.fecha_hasta) : desde;
  if (['justificante', 'vacaciones', 'permiso'].indexOf(tipo) >= 0 && !desde) throw new Error('Indica la fecha');
  if (hasta && desde && hasta < desde) throw new Error('La fecha final es antes de la inicial');
  if (tipo === 'anticipo' && !(num_(req.monto) > 0)) throw new Error('Indica el monto del anticipo');
  if (!String(req.motivo || '').trim() && tipo !== 'vacaciones') throw new Error('Escribe el motivo');
  let dias = 0;
  if (desde) {
    const e = empleadosChecador_().find(x => x.no === u.no_empleado);
    for (let f = desde; f <= hasta; f = addDias_(f, 1)) if (!e || !e.dias.length || e.dias.indexOf(diaSemana_(f)) >= 0) dias++;
  }
  if (tipo === 'vacaciones') {
    const v = vacaciones_(persona_(u.no_empleado));
    if (dias > v.disponibles) throw new Error('Solo tienes ' + v.disponibles + ' día(s) de vacaciones disponibles');
  }
  const id = withLock_(() => {
    const sid = nextId_('SOL', 5);
    append_('Solicitudes', { sol_id: sid, no_empleado: u.no_empleado, nombre: u.nombre, tipo: tipo, fecha_desde: desde, fecha_hasta: hasta, dias: dias,
      monto: num_(req.monto) || '', motivo: String(req.motivo || '').slice(0, 500), evidencia: req.evidencia || '', estatus: 'pendiente',
      fecha_solicitud: new Date() });
    return sid;
  });
  notificarAdmins_('solicitud', '📝 Nueva solicitud: ' + TIPOS_SOL[tipo], u.nombre + (desde ? ' · ' + desde + (hasta !== desde ? ' a ' + hasta : '') : '') +
    (tipo === 'anticipo' ? ' · ' + money_(req.monto) : '') + (req.motivo ? ' · ' + String(req.motivo).slice(0, 80) : ''), id, false);
  return id;
}

function subirEvidencia_(req, u) {
  if (!req.base64) throw new Error('Falta el archivo');
  const folder = subfolder_(DriveApp.getFolderById(config_('EVIDENCIAS_FOLDER_ID')), fmt_(new Date(), 'yyyy-MM'));
  const ext = /pdf/.test(req.mime) ? 'pdf' : 'jpg';
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.base64), req.mime || 'image/jpeg', u.no_empleado + '_' + fmt_(new Date(), 'yyyyMMdd_HHmmss') + '.' + ext));
  return { id: f.getId() };
}

function solicitudesDe_(no) {
  return rows_('Solicitudes').filter(s => String(s.no_empleado) === String(no)).map(pickSol_).sort((a, b) => b.fecha_solicitud.localeCompare(a.fecha_solicitud));
}
function solicitudesAdmin_(req) {
  return rows_('Solicitudes').map(pickSol_).filter(s => !req.estatus || s.estatus === req.estatus).sort((a, b) =>
    (a.estatus === 'pendiente' ? 0 : 1) - (b.estatus === 'pendiente' ? 0 : 1) || b.fecha_solicitud.localeCompare(a.fecha_solicitud)).slice(0, 200);
}
function pickSol_(s) {
  return { sol_id: s.sol_id, no_empleado: String(s.no_empleado), nombre: s.nombre, tipo: s.tipo, tipo_txt: TIPOS_SOL[s.tipo] || s.tipo,
    fecha_desde: fmt_(s.fecha_desde, 'yyyy-MM-dd'), fecha_hasta: fmt_(s.fecha_hasta, 'yyyy-MM-dd'), dias: Number(s.dias || 0), monto: Number(s.monto || 0),
    motivo: s.motivo, evidencia: s.evidencia, estatus: s.estatus, fecha_solicitud: fmt_(s.fecha_solicitud, 'yyyy-MM-dd HH:mm'),
    resuelta_por: s.resuelta_por, fecha_resolucion: fmt_(s.fecha_resolucion, 'yyyy-MM-dd HH:mm'), comentario: s.comentario };
}

function resolverSolicitud_(req, u) {
  const s = withLock_(() => {
    const s = rows_('Solicitudes').find(x => x.sol_id === req.sol_id);
    if (!s) throw new Error('Solicitud no encontrada');
    if (s.estatus !== 'pendiente') throw new Error('Esta solicitud ya fue resuelta');
    const aprobar = !!req.aprobar;
    update_('Solicitudes', s._row, { estatus: aprobar ? 'aprobada' : 'rechazada', resuelta_por: u.nombre, fecha_resolucion: new Date(), comentario: req.comentario || '' });
    if (aprobar && ['justificante', 'vacaciones', 'permiso'].indexOf(s.tipo) >= 0) escribirJustificadas_(s);
    if (aprobar && s.tipo === 'anticipo') {
      const p = persona_(s.no_empleado);
      append_('Adeudos', { adeudo_id: nextId_('AD', 5), no_empleado: s.no_empleado, nombre: p.nombre, concepto: 'Anticipo de nómina (' + s.sol_id + ')',
        monto_total: Number(s.monto), cuota: Number(req.cuota || s.monto), saldo: Number(s.monto), fecha_alta: new Date(), estatus: 'activo', origen: s.sol_id, notas: '' });
    }
    bitacora_(u.no_empleado, aprobar ? 'aprobar_solicitud' : 'rechazar_solicitud', 'Solicitudes', s.sol_id, req.comentario || '');
    return s;
  });
  const ok = !!req.aprobar;
  notificar_(String(s.no_empleado), 'solicitud', (ok ? '✅ Aprobada: ' : '❌ Rechazada: ') + (TIPOS_SOL[s.tipo] || s.tipo),
    (s.fecha_desde ? fmt_(s.fecha_desde, 'yyyy-MM-dd') + ' · ' : '') + (req.comentario || (ok ? 'Tu solicitud fue aprobada.' : 'Tu solicitud fue rechazada.')), s.sol_id);
  return true;
}

/** Escribe en la pestaña Justificadas del checador (un renglón por día laboral) para que el dashboard del checador también lo tome. */
function escribirJustificadas_(s) {
  const sh = ss_().getSheetByName('Justificadas');
  if (!sh) return;
  const motivoBase = { vacaciones: 'Vacaciones', permiso: 'Permiso', justificante: 'Justificada' }[s.tipo];
  let motivo = motivoBase;
  const dv = sh.getRange('C2').getDataValidation();
  if (dv && dv.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    const ops = dv.getCriteriaValues()[0] || [];
    motivo = ops.find(o => quitarAcentos_(o).toLowerCase().indexOf(quitarAcentos_(motivoBase).toLowerCase().slice(0, 5)) >= 0)
      || ops.find(o => /otro|justific/i.test(o)) || ops[0] || motivoBase;
  }
  const e = empleadosChecador_().find(x => x.no === String(s.no_empleado));
  const desde = fmt_(s.fecha_desde, 'yyyy-MM-dd'), hasta = fmt_(s.fecha_hasta || s.fecha_desde, 'yyyy-MM-dd');
  const filas = [];
  for (let f = desde; f <= hasta; f = addDias_(f, 1)) {
    if (e && e.dias.length && e.dias.indexOf(diaSemana_(f)) < 0) continue;
    filas.push([f, String(s.no_empleado), motivo, 'Portal ' + s.sol_id + (s.motivo ? ' · ' + String(s.motivo).slice(0, 80) : '')]);
  }
  if (!filas.length) return;
  // primera fila vacía en la columna A (la pestaña tiene instrucciones en la columna F)
  const colA = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
  let r = colA.length;
  while (r > 1 && colA[r - 1][0] === '') r--;
  sh.getRange(r + 1, 1, filas.length, 4).setValues(filas);
  delete _cache.just;
}

/** Vacaciones LFT (reforma 2023): 12 días el primer año, +2 por año hasta 20 (5º año), luego +2 cada 5 años. */
function diasVacacionesLft_(anios) {
  if (anios < 1) return 0;
  if (anios <= 5) return 10 + anios * 2;
  return 20 + Math.ceil((anios - 5) / 5) * 2;
}

function vacaciones_(p) {
  const e = empleadosChecador_().find(x => x.no === String(p.no_empleado)) || {};
  const ing = parseFecha_(p.fecha_ingreso) || e.ingreso;
  if (!ing) return { sin_fecha: true, derecho: 0, tomados: 0, disponibles: 0 };
  const hoy = hoy_();
  let anios = Number(hoy.slice(0, 4)) - Number(ing.slice(0, 4));
  if (hoy.slice(5) < ing.slice(5)) anios--;
  const derecho = diasVacacionesLft_(anios);
  const ultimoAniv = anios >= 1 ? (Number(ing.slice(0, 4)) + anios) + ing.slice(4) : ing;
  const tomados = rows_('Solicitudes').filter(s => String(s.no_empleado) === String(p.no_empleado) && s.tipo === 'vacaciones' &&
    ['aprobada', 'pendiente'].indexOf(s.estatus) >= 0 && fmt_(s.fecha_desde, 'yyyy-MM-dd') >= ultimoAniv).reduce((t, s) => t + Number(s.dias || 0), 0);
  const prox = (Number(ing.slice(0, 4)) + Math.max(anios, 0) + 1) + ing.slice(4);
  return { anios: Math.max(anios, 0), derecho: derecho, tomados: tomados, disponibles: Math.max(0, derecho - tomados),
    desde: ultimoAniv, proximo_aniversario: prox, dias_proximo: diasVacacionesLft_(Math.max(anios, 0) + 1) };
}

// ───────────────────────── Bandeja, avisos y push ─────────────────────────

function bandejaDe_(no) {
  return rows_('Bandeja').filter(n => String(n.no_empleado) === String(no)).map(n => ({ notif_id: n.notif_id, fecha: fmt_(n.fecha, 'yyyy-MM-dd HH:mm'),
    tipo: n.tipo, titulo: n.titulo, mensaje: n.mensaje, ref: n.ref, leido: n.leido === 'SI' })).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.notif_id.localeCompare(a.notif_id)).slice(0, 100);
}

function marcarLeido_(req, u) {
  const ids = req.todos ? null : [].concat(req.ids || []);
  const sh = sheet_('Bandeja'), h = headers_('Bandeja'), col = h.indexOf('leido') + 1;
  rows_('Bandeja').forEach(n => { if (String(n.no_empleado) === u.no_empleado && n.leido !== 'SI' && (!ids || ids.indexOf(n.notif_id) >= 0)) sh.getRange(n._row, col).setValue('SI'); });
  delete _cache['r:Bandeja'];
  return true;
}

function enviarAviso_(req, u) {
  const titulo = String(req.titulo || '').trim(), mensaje = String(req.mensaje || '').trim();
  if (!titulo || !mensaje) throw new Error('Escribe título y mensaje');
  const destino = req.destinatarios === 'todos' || !req.destinatarios ? rows_('Personal').filter(p => p.estatus !== 'baja').map(p => String(p.no_empleado))
    : [].concat(req.destinatarios).map(String);
  const ref = nextId_('AV', 5);
  let push = 0;
  destino.forEach(no => { if (notificar_(no, 'aviso', '📢 ' + titulo, mensaje, ref)) push++; });
  bitacora_(u.no_empleado, 'aviso', 'Bandeja', ref, titulo + ' → ' + destino.length);
  return { enviados: destino.length, con_push: push, ref: ref };
}

function avisosEnviados_() {
  const map = {};
  rows_('Bandeja').filter(n => n.tipo === 'aviso').forEach(n => {
    const m = map[n.ref] = map[n.ref] || { ref: n.ref, fecha: fmt_(n.fecha, 'yyyy-MM-dd HH:mm'), titulo: n.titulo, mensaje: n.mensaje, total: 0, leidos: 0 };
    m.total++; if (n.leido === 'SI') m.leidos++;
  });
  return Object.keys(map).map(k => map[k]).sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 50);
}

/** Guarda en la bandeja del empleado y manda push a sus dispositivos. Devuelve true si llegó algún push. */
function notificar_(no, tipo, titulo, mensaje, ref) {
  const devices = rows_('Dispositivos').filter(d => String(d.no_empleado) === String(no) && d.activo === 'SI');
  let ok = false;
  devices.forEach(d => {
    const r = sendPush_(d.fcm_token, titulo, mensaje, { tipo: tipo, ref: String(ref || '') });
    if (r.ok) ok = true;
    if (r.unregistered) update_('Dispositivos', d._row, { activo: 'NO' });
  });
  append_('Bandeja', { notif_id: nextId_('N', 7), fecha: new Date(), no_empleado: String(no), tipo: tipo, titulo: titulo, mensaje: mensaje,
    ref: ref || '', leido: 'NO', push: devices.length ? (ok ? 'enviado' : 'fallido') : 'sin dispositivo' });
  return ok;
}

function notificarAdmins_(tipo, titulo, mensaje, ref, correo) {
  rows_('Personal').filter(p => p.rol === 'admin' && p.estatus !== 'baja').forEach(p => notificar_(String(p.no_empleado), tipo, titulo, mensaje, ref));
  if (correo) {
    const to = String(config_('CORREOS_ADMIN', '')).split(',').map(s => s.trim()).filter(String).join(',');
    if (to) try { MailApp.sendEmail(to, 'Portal Packatelas · ' + titulo, mensaje); } catch (e) { console.error('mail', e); }
  }
}

function sendPush_(token, title, body, data) {
  try {
    const res = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + FCM_PROJECT + '/messages:send', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ message: {
        token: token, notification: { title: title, body: body }, data: data || {},
        webpush: { fcm_options: { link: config_('APP_URL', 'https://computenga.github.io/portal-packatelas/') } },
      } }),
    });
    const code = res.getResponseCode();
    if (code === 200) return { ok: true };
    const txt = res.getContentText();
    console.warn('FCM', code, txt);
    return { ok: false, unregistered: code === 404 || /UNREGISTERED/.test(txt) };
  } catch (err) { console.error('FCM', err); return { ok: false }; }
}

/** Prueba desde el editor: push al empleado 1. */
function probarPush() { notificar_('1', 'prueba', 'Prueba del portal', 'Si ves esto, las notificaciones funcionan.', ''); }

// ───────────────────────── Documentos del expediente ─────────────────────────

function carpetaEmpleado_(p) {
  if (p.carpeta_docs) { try { return DriveApp.getFolderById(p.carpeta_docs); } catch (e) {} }
  const f = subfolder_(DriveApp.getFolderById(config_('EXPEDIENTES_FOLDER_ID')), p.no_empleado + ' - ' + p.nombre);
  update_('Personal', p._row, { carpeta_docs: f.getId() });
  return f;
}

function documentosDe_(no) {
  const p = persona_(no);
  if (!p.carpeta_docs) return [];
  const out = [];
  const it = carpetaEmpleado_(p).getFiles();
  while (it.hasNext()) { const f = it.next(); out.push({ id: f.getId(), nombre: f.getName(), mime: f.getMimeType(), fecha: fmt_(f.getLastUpdated(), 'yyyy-MM-dd'), tamano: f.getSize() }); }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function documento_(req, u) {
  const no = u.rol === 'admin' && req.no_empleado ? req.no_empleado : u.no_empleado;
  const p = persona_(no);
  const folder = carpetaEmpleado_(p);
  const f = DriveApp.getFileById(req.id);
  const parents = f.getParents();
  let mio = false;
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) mio = true;
  if (!mio) throw new Error('Documento no encontrado');
  if (f.getSize() > 15e6) throw new Error('El archivo es muy grande para abrirlo desde la app');
  return { nombre: f.getName(), mime: f.getMimeType(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
}

function subirDocumento_(req, u) {
  const p = persona_(req.no_empleado);
  if (!req.base64 || !req.nombre) throw new Error('Falta el archivo');
  const f = carpetaEmpleado_(p).createFile(Utilities.newBlob(Utilities.base64Decode(req.base64), req.mime || 'application/octet-stream', String(req.nombre).slice(0, 120)));
  bitacora_(u.no_empleado, 'subir_documento', 'Personal', p.no_empleado, f.getName());
  if (req.avisar) notificar_(String(p.no_empleado), 'documento', '📄 Nuevo documento en tu expediente', f.getName(), f.getId());
  return { id: f.getId() };
}

// ───────────────────────── Bienvenida (onboarding) y apps ─────────────────────────

function appRow_(a, i) {
  return { app_id: a[0], nombre: a[1], descripcion: a[2], icono: a[3], color: a[4], tipo: a[5], url_instalar: a[6], android_package: a[7],
    url_abrir: a[8], puestos: a[9], requerida: a[10], acceso_directo: a[11], orden: (i + 1) * 10, activo: 'SI' };
}

function pickApp_(a) {
  return { app_id: String(a.app_id), nombre: a.nombre, descripcion: a.descripcion, icono: a.icono || '📱', color: a.color || '#2b4c78',
    tipo: a.tipo || 'playstore', url_instalar: a.url_instalar, android_package: a.android_package, url_abrir: a.url_abrir,
    puestos: a.puestos || 'todos', requerida: a.requerida === 'SI', acceso_directo: a.acceso_directo === 'SI', orden: Number(a.orden || 999),
    activo: a.activo !== 'NO' };
}

/** 'repartidor' | 'otro' | '' (sin definir). El puesto del expediente manda; si está vacío, lo que eligió el empleado. */
function rolBienvenida_(p) {
  const puesto = quitarAcentos_(String(p.puesto || '')).toLowerCase();
  if (puesto) return /repart|chofer|driver|mensajer/.test(puesto) ? 'repartidor' : 'otro';
  if (p.flotilla_id) return 'repartidor';
  return p.onb_rol || '';
}

function appsPara_(no) {
  const p = persona_(no);
  const rol = rolBienvenida_(p);
  const listas = String(p.onb_apps || '').split(',').filter(String);
  return rows_('Apps').map(pickApp_).filter(a => a.activo && (a.puestos === 'todos' || a.puestos === rol))
    .sort((a, b) => a.orden - b.orden).map(a => Object.assign(a, { lista: listas.indexOf(a.app_id) >= 0 }));
}

function bienvenida_(no) {
  const p = persona_(no);
  const rol = rolBienvenida_(p);
  const e = empleadosChecador_().find(x => x.no === String(no)) || {};
  const push = rows_('Dispositivos').some(d => String(d.no_empleado) === String(no) && d.activo === 'SI');
  const apps = rol === 'repartidor' ? appsPara_(no).filter(a => a.requerida) : [];
  const pasos = [
    { id: 'acceso', titulo: 'Crea tu acceso', detalle: 'RFC y PIN', hecho: !!p.pin_hash, auto: true },
    { id: 'documentos', titulo: 'Sube tus documentos', detalle: 'Formulario de alta', hecho: !!p.onb_docs,
      fecha: fmt_(p.onb_docs, 'yyyy-MM-dd') },
  ];
  if (rol === 'repartidor') pasos.push({ id: 'apps', titulo: 'Instala tus apps e inicia sesión', detalle: apps.filter(a => a.lista).length + ' de ' + apps.length + ' listas',
    hecho: apps.length > 0 && apps.every(a => a.lista), listas: apps.filter(a => a.lista).length, total: apps.length,
    faltan: apps.filter(a => !a.lista).map(a => a.nombre) });
  pasos.push({ id: 'checador', titulo: 'Registra tu celular en el checador', detalle: 'QR del kiosco + tu huella', hecho: !!e.celular, auto: true });
  pasos.push({ id: 'notificaciones', titulo: 'Activa las notificaciones', detalle: 'Para tu recibo y tu depósito', hecho: push, auto: true });
  const hechos = pasos.filter(x => x.hecho).length;
  const sig = pasos.find(x => !x.hecho);
  return { rol: rol, rol_fijo: !!String(p.puesto || '').trim() || !!p.flotilla_id, pasos: pasos, hechos: hechos, total: pasos.length,
    completa: hechos === pasos.length, siguiente: sig ? sig.titulo : '', form_documentos: config_('FORM_DOCUMENTOS', '') };
}

function elegirRol_(req, u) {
  const p = persona_(u.no_empleado);
  if (String(p.puesto || '').trim() || p.flotilla_id) throw new Error('Tu puesto ya lo definió RH');
  if (['repartidor', 'otro'].indexOf(req.rol) < 0) throw new Error('Puesto inválido');
  update_('Personal', p._row, { onb_rol: req.rol });
  return bienvenida_(u.no_empleado);
}

function marcarApp_(req, u) {
  return withLock_(() => {
    const p = persona_(u.no_empleado);
    const set = String(p.onb_apps || '').split(',').filter(String).filter(x => x !== req.app_id);
    if (req.lista !== false) set.push(String(req.app_id));
    update_('Personal', p._row, { onb_apps: set.join(',') });
    return bienvenida_(u.no_empleado);
  });
}

function marcarDocs_(no, si, u) {
  const p = persona_(no);
  update_('Personal', p._row, { onb_docs: si ? new Date() : '' });
  bitacora_(u.no_empleado, si ? 'docs_enviados' : 'docs_pendientes', 'Personal', String(no), '');
  if (si && u.no_empleado === String(no)) notificarAdmins_('bienvenida', '📄 Documentos de alta', p.nombre + ' dice que ya envió sus documentos por el formulario.', String(no), false);
  return bienvenida_(no);
}

function recordarBienvenida_(req, u) {
  const b = bienvenida_(req.no_empleado);
  if (b.completa) throw new Error('Ya completó su bienvenida');
  notificar_(String(req.no_empleado), 'bienvenida', '👋 Te falta terminar tu bienvenida', 'Siguiente paso: ' + b.siguiente + '. Ábrelo desde Inicio en el portal.', '');
  bitacora_(u.no_empleado, 'recordar_bienvenida', 'Personal', String(req.no_empleado), b.siguiente);
  return true;
}

function guardarApp_(req, u) {
  return withLock_(() => {
    const d = req.app || {};
    const id = String(d.app_id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!id || !String(d.nombre || '').trim()) throw new Error('ID y nombre son obligatorios');
    if (['playstore', 'apk', 'web'].indexOf(d.tipo) < 0) throw new Error('Tipo inválido');
    const row = { app_id: id, nombre: d.nombre, descripcion: d.descripcion || '', icono: d.icono || '📱', color: d.color || '#2b4c78', tipo: d.tipo,
      url_instalar: d.url_instalar || '', android_package: d.android_package || '', url_abrir: d.url_abrir || '', puestos: d.puestos === 'repartidor' ? 'repartidor' : 'todos',
      requerida: d.requerida ? 'SI' : 'NO', acceso_directo: d.acceso_directo ? 'SI' : 'NO', orden: Number(d.orden || 999), activo: d.activo === false ? 'NO' : 'SI' };
    const ex = rows_('Apps').find(a => String(a.app_id) === id);
    if (ex) update_('Apps', ex._row, row); else append_('Apps', row);
    bitacora_(u.no_empleado, 'guardar_app', 'Apps', id, '');
    return true;
  });
}

// ───────────────────────── Patrón: panel y personal ─────────────────────────

function panel_() {
  const per = periodoActual_();
  const ag = asistenciaGeneral_(per.id);
  const hoyL = ag.empleados.filter(e => e.hoy && e.hoy.laboral);
  const recibos = rows_('Recibos').filter(r => r.estatus !== 'cancelado');
  const ant = periodoAnterior_(per.id);
  const pagos = pagosAdmin_({ desde: addDias_(hoy_(), -7) });
  const personal = rows_('Personal').filter(p => p.estatus !== 'baja');
  return {
    periodo: per, periodo_anterior: ant, hoy: ag.hoy,
    hoy_resumen: {
      esperados: hoyL.length,
      presentes: hoyL.filter(e => e.hoy.entrada).length,
      tarde: hoyL.filter(e => e.hoy.min_tarde > 0).length,
      faltan: hoyL.filter(e => !e.hoy.entrada).map(e => ({ no_empleado: e.no_empleado, nombre: e.nombre, debia: e.hoy.debia })),
      llegadas: hoyL.filter(e => e.hoy.entrada).map(e => ({ nombre: e.nombre, entrada: e.hoy.entrada, min_tarde: e.hoy.min_tarde })).sort((a, b) => a.entrada.localeCompare(b.entrada)),
    },
    quincena: {
      retardos: ag.empleados.reduce((s, e) => s + e.totales.retardos + e.totales.retardos_comida, 0),
      horas_retraso: round_(ag.empleados.reduce((s, e) => s + e.totales.horas_retraso, 0), 2),
      faltas: ag.empleados.reduce((s, e) => s + e.totales.faltas, 0),
      top: ag.empleados.filter(e => e.totales.horas_descuento > 0).slice(0, 5).map(e => ({ nombre: e.nombre, faltas: e.totales.faltas, min_total: e.totales.min_total })),
    },
    nomina: {
      recibos_periodo_anterior: recibos.filter(r => r.periodo === ant.id).length,
      recibos_periodo: recibos.filter(r => r.periodo === per.id).length,
      sin_firmar: recibos.filter(r => !r.firma_fecha).length,
      sin_pagar: recibos.filter(r => r.estatus === 'emitido').length,
      pagos_semana: round_(pagos.reduce((s, p) => s + p.monto, 0), 2),
      pagos_no_cuadran: pagos.filter(p => p.cuadra === 'NO').length,
    },
    solicitudes_pendientes: rows_('Solicitudes').filter(s => s.estatus === 'pendiente').length,
    datos_faltantes: {
      sin_rfc: personal.filter(p => !p.rfc).length, sin_clabe: personal.filter(p => !p.clabe).length,
      sin_salario: personal.filter(p => !Number(p.salario_diario)).length, sin_pin: personal.filter(p => !p.pin_hash).length,
      sin_horario: ag.empleados.filter(e => e.sin_horario).length,
    },
    bienvenida_pendiente: personal.filter(p => !bienvenida_(p.no_empleado).completa).length,
    con_push: unicos_(rows_('Dispositivos').filter(d => d.activo === 'SI').map(d => String(d.no_empleado))).length,
    total_personal: personal.length,
  };
}

function personalAdmin_() {
  const emp = empleadosChecador_();
  const disp = unicos_(rows_('Dispositivos').filter(d => d.activo === 'SI').map(d => String(d.no_empleado)));
  return rows_('Personal').map(p => {
    const e = emp.find(x => x.no === String(p.no_empleado)) || {};
    return {
      no_empleado: String(p.no_empleado), nombre: p.nombre, rfc: p.rfc, curp: p.curp, nss: p.nss, puesto: p.puesto, area: p.area,
      rol: p.rol || 'empleado', estatus: p.estatus || 'activo', fecha_ingreso: fmt_(p.fecha_ingreso, 'yyyy-MM-dd'), fecha_baja: fmt_(p.fecha_baja, 'yyyy-MM-dd'),
      salario_diario: Number(p.salario_diario || 0), clabe: p.clabe, banco: p.banco, telefono: p.telefono, correo: p.correo,
      flotilla_id: p.flotilla_id, notas: p.notas, tiene_pin: !!p.pin_hash, bloqueado: p.pin_bloqueado === 'SI',
      ultimo_acceso: fmt_(p.ultimo_acceso, 'yyyy-MM-dd HH:mm'), push: disp.indexOf(String(p.no_empleado)) >= 0,
      en_checador: !!e.no, horario: e.no ? { entrada: e.entrada, dias: e.diasTxt, comida: e.comida } : null, celular_checador: !!e.celular,
      bienvenida: p.estatus === 'baja' ? null : (b => ({ hechos: b.hechos, total: b.total, completa: b.completa }))(bienvenida_(p.no_empleado)),
    };
  }).sort((a, b) => (a.estatus === 'baja') - (b.estatus === 'baja') || String(a.nombre).localeCompare(String(b.nombre)));
}

const CAMPOS_EDITABLES = ['nombre', 'rfc', 'curp', 'nss', 'puesto', 'area', 'rol', 'estatus', 'fecha_ingreso', 'fecha_baja', 'salario_diario',
  'clabe', 'banco', 'telefono', 'correo', 'flotilla_id', 'notas'];

function guardarPersona_(req, u) {
  return withLock_(() => {
    const d = req.persona || {};
    const upd = {};
    CAMPOS_EDITABLES.forEach(k => { if (d[k] !== undefined) upd[k] = typeof d[k] === 'string' ? d[k].trim() : d[k]; });
    if (upd.rfc) { upd.rfc = normRfc_(upd.rfc); if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(upd.rfc)) throw new Error('RFC inválido'); }
    if (upd.curp) upd.curp = String(upd.curp).toUpperCase();
    if (upd.clabe) { upd.clabe = String(upd.clabe).replace(/\D/g, ''); if (!clabeValida_(upd.clabe)) throw new Error('La CLABE no es válida (revisa los 18 dígitos)'); }
    if (upd.rol && ['admin', 'empleado'].indexOf(upd.rol) < 0) throw new Error('Rol inválido');
    if (upd.salario_diario !== undefined) upd.salario_diario = num_(upd.salario_diario);
    if (upd.fecha_ingreso) upd.fecha_ingreso = parseFecha_(upd.fecha_ingreso);
    if (upd.fecha_baja) upd.fecha_baja = parseFecha_(upd.fecha_baja);
    const todos = rows_('Personal');
    if (upd.rfc) { const dup = todos.find(x => normRfc_(x.rfc) === upd.rfc && String(x.no_empleado) !== String(d.no_empleado)); if (dup) throw new Error('Ese RFC ya es de ' + dup.nombre); }
    if (upd.clabe) { const dup = todos.find(x => String(x.clabe) === upd.clabe && String(x.no_empleado) !== String(d.no_empleado)); if (dup) throw new Error('Esa CLABE ya es de ' + dup.nombre); }
    let p = todos.find(x => String(x.no_empleado) === String(d.no_empleado));
    if (!p) {
      if (!String(d.no_empleado || '').trim() || !upd.nombre) throw new Error('Número y nombre son obligatorios');
      append_('Personal', Object.assign({ no_empleado: String(d.no_empleado).trim(), rol: 'empleado', estatus: 'activo', pin_intentos: 0, pin_bloqueado: 'NO' }, upd));
    } else {
      if (String(p.no_empleado) === u.no_empleado && upd.rol === 'empleado') throw new Error('No puedes quitarte el rol de admin a ti mismo');
      update_('Personal', p._row, upd);
    }
    bitacora_(u.no_empleado, 'guardar_persona', 'Personal', d.no_empleado, Object.keys(upd).join(','));
    return true;
  });
}

/** Dígito verificador de CLABE (pesos 3,7,1). */
function clabeValida_(c) {
  if (!/^\d{18}$/.test(c)) return false;
  const w = [3, 7, 1];
  let s = 0;
  for (let i = 0; i < 17; i++) s += (Number(c[i]) * w[i % 3]) % 10;
  return (10 - (s % 10)) % 10 === Number(c[17]);
}

// ───────────────────────── Acceso a hojas ─────────────────────────

let _ss = null;
const _cache = {};
function ss_() { return _ss || (_ss = SpreadsheetApp.openById(MAESTRO_ID)); }
function sheet_(name) { const sh = ss_().getSheetByName(name); if (!sh) throw new Error('No existe la pestaña ' + name + '. Ejecuta setup().'); return sh; }
function headers_(name) {
  if (!_cache['h:' + name]) { const sh = sheet_(name); _cache['h:' + name] = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); }
  return _cache['h:' + name];
}
function rows_(name) {
  if (_cache['r:' + name]) return _cache['r:' + name];
  return (_cache['r:' + name] = sheetRows_(sheet_(name), headers_(name)));
}
function sheetRows_(sh, h) {
  if (!sh) return [];
  const last = sh.getLastRow();
  h = h || sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, h.length).getValues();
  const out = [];
  values.forEach((r, i) => {
    if (r.every(c => c === '')) return;
    const o = { _row: i + 2 };
    h.forEach((k, j) => { if (k) o[k] = r[j]; });
    out.push(o);
  });
  return out;
}
function append_(name, obj) {
  const h = headers_(name);
  sheet_(name).appendRow(h.map(k => obj[k] === undefined ? '' : obj[k]));
  delete _cache['r:' + name];
}
function update_(name, row, obj) {
  const h = headers_(name), sh = sheet_(name);
  Object.keys(obj).forEach(k => { const c = h.indexOf(k); if (c >= 0) sh.getRange(row, c + 1).setValue(obj[k]); });
  delete _cache['r:' + name];
}
function config_(key, def) {
  const row = rows_('ConfigPortal').find(r => r.clave === key);
  const v = row ? row.valor : '';
  return v === '' || v === undefined || v === null ? (def === undefined ? '' : def) : v;
}
function setConfig_(key, value) {
  const row = rows_('ConfigPortal').find(r => r.clave === key);
  if (row) update_('ConfigPortal', row._row, { valor: value }); else append_('ConfigPortal', { clave: key, valor: value });
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Servidor ocupado, intenta de nuevo');
  try { return fn(); } finally { SpreadsheetApp.flush(); lock.releaseLock(); }
}
function nextId_(prefix, width) {
  const p = PropertiesService.getScriptProperties();
  const k = 'SEQ_' + prefix;
  const n = Number(p.getProperty(k) || 0) + 1;
  p.setProperty(k, String(n));
  return prefix + '-' + ('000000000' + n).slice(-width);
}
function bitacora_(no, accion, entidad, ref, detalle) {
  try { append_('Bitacora', { fecha: new Date(), no_empleado: no, accion: accion, entidad: entidad, ref: ref, detalle: detalle }); } catch (e) { console.warn('bitacora', e); }
}
function persona_(no) {
  const p = rows_('Personal').find(x => String(x.no_empleado) === String(no));
  if (!p) throw new Error('Empleado no encontrado: ' + no);
  return p;
}
function folderByPath_(names) {
  let f = DriveApp.getRootFolder();
  names.forEach(n => f = subfolder_(f, n));
  return f;
}
function subfolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ───────────────────────── Utilidades ─────────────────────────

function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function fmt_(d, pattern) {
  if (d === '' || d == null) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && pattern === 'yyyy-MM-dd') return d;
  const date = d instanceof Date ? d : new Date(d);
  return isNaN(date) ? String(d) : Utilities.formatDate(date, TZ, pattern);
}
/** Acepta Date, 'yyyy-MM-dd', 'dd/MM/yyyy'. Devuelve 'yyyy-MM-dd' o ''. */
function parseFecha_(v) {
  if (v === '' || v == null) return '';
  if (v instanceof Date) return isNaN(v) ? '' : Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}
/** '9:00', '09:05:29', '8:50 a. m.' → minutos desde medianoche */
function parseHora_(v) {
  if (v === '' || v == null) return null;
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes() + v.getSeconds() / 60;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])?/i);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[4]) { const pm = /p/i.test(m[4]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  return h * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0);
}
/** Minutos completos de retraso: los segundos no cuentan como minuto extra (9:00:59 = 0 min tarde). */
function horaTxt_(min) { const h = Math.floor(min / 60), m = Math.floor(min % 60); return h + ':' + ('0' + m).slice(-2); }
function horasTxt_(min) { min = Math.round(min); return Math.floor(min / 60) + ':' + ('0' + (min % 60)).slice(-2) + ' h'; }
function addDias_(f, n) { const [y, m, d] = f.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); }
function diaSemana_(f) { const [y, m, d] = f.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function quitarAcentos_(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function round_(n, d) { const f = Math.pow(10, d); return Math.round(Number(n || 0) * f + 1e-9) / f; }
function num_(v) { const n = Number(String(v == null ? '' : v).replace(/[$,\s]/g, '')); return isNaN(n) ? 0 : round_(n, 2); }
function money_(n) {
  const [ent, dec] = Math.abs(round_(n, 2)).toFixed(2).split('.');
  return (Number(n) < 0 ? '-$' : '$') + ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec;
}
function unicos_(arr) { return arr.filter((x, i) => arr.indexOf(x) === i); }
function antiguedadTexto_(ing) {
  ing = parseFecha_(ing);
  if (!ing) return '';
  const hoy = hoy_();
  let meses = (Number(hoy.slice(0, 4)) - Number(ing.slice(0, 4))) * 12 + Number(hoy.slice(5, 7)) - Number(ing.slice(5, 7));
  if (Number(hoy.slice(8)) < Number(ing.slice(8))) meses--;
  meses = Math.max(0, meses);
  const a = Math.floor(meses / 12), m = meses % 12;
  return (a ? a + (a === 1 ? ' año' : ' años') : '') + (a && m ? ' y ' : '') + (m || !a ? m + (m === 1 ? ' mes' : ' meses') : '');
}

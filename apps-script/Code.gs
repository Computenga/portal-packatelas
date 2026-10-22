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
    'pin_hash', 'pin_intentos', 'pin_bloqueado', 'ultimo_acceso', 'notas', 'onb_rol', 'onb_docs', 'onb_apps', 'shipday_id',
    'hora_entrada', 'dias_laborales', 'minutos_comida', 'checadas', 'actualizado', 'moto_tipo', 'domicilio', 'dom_json', 'dom_lat', 'dom_lng',
    'dom_fecha', 'emer1_nombre', 'emer1_tel', 'emer1_parentesco', 'emer2_nombre', 'emer2_tel', 'emer2_parentesco'],
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
  DocsTipos: ['doc_id', 'nombre', 'descripcion', 'puestos', 'requerido', 'orden', 'activo'],
  DocsEmpleado: ['archivo_id', 'owner', 'doc_id', 'nombre_archivo', 'file_id', 'mime', 'fecha', 'estatus', 'comentario',
    'revisado_por', 'fecha_revision'],
  Altas: ['alta_id', 'fecha', 'nombre', 'rfc', 'curp', 'telefono', 'correo', 'rol', 'estatus', 'folder_id', 'token_hash',
    'no_empleado', 'notas', 'fecha_resolucion', 'resuelta_por'],
  Rutas: ['ruta_id', 'fecha', 'no_empleado', 'nombre', 'num', 'total', 'salida', 'fin', 'km', 'paradas', 'envios', 'datos_json',
    'estatus', 'publicada_por', 'fecha_publicacion', 'visto', 'limite', 'seg_json', 'seg_actualizado', 'seg_recalculo', 'fin_estimado',
    'estado_tiempo', 'retraso_min', 'sugerido', 'aprobado_por', 'gps_json', 'inact_json'],
  ReporteRutas: ['fecha', 'ruta_id', 'no_empleado', 'nombre', 'envios', 'entregados', 'no_entregados', 'en_orden', 'fuera_orden',
    'pct_orden', 'tarde', 'retraso_prom', 'fin_plan', 'fin_real', 'otros_repartidores', 'calificacion', 'detalle_json', 'generado'],
  HistorialEntregas: ['fecha', 'no_empleado', 'nombre', 'carrier_ids', 'entregados', 'fallidos', 'incompletos', 'total', 'pct', 'actualizado'],
  GpsLog: ['fecha', 'carrier_id', 'no_empleado', 'nombre', 'lat', 'lng', 'en_turno'],
  Recolecciones: ['rec_id', 'fecha', 'order_id', 'order_number', 'cliente', 'direccion', 'lat', 'lng', 'volumen', 'puntos', 'no_empleado',
    'nombre', 'carrier_id', 'estado', 'creada', 'resuelta', 'resuelta_por', 'nota'],
  ClientesRecoleccion: ['cliente', 'volumen', 'direccion', 'lat', 'lng', 'notas', 'alta'],
  AlcanceMoto: ['clave', 'lat', 'lng', 'chica_ok', 'motivo', 'min_normal', 'min_sin_autopista', 'fecha'],
  Apps: ['app_id', 'nombre', 'descripcion', 'icono', 'color', 'tipo', 'url_instalar', 'android_package', 'url_abrir',
    'puestos', 'requerida', 'acceso_directo', 'orden', 'activo'],
};

/** Documentos que se piden al entrar (se editan en la pestaña DocsTipos). puestos: todos | repartidor */
const DOCS_DEFAULT = [
  ['ine_frente', 'INE (frente)', 'Foto clara, sin reflejos', 'todos', 'SI'],
  ['ine_reverso', 'INE (reverso)', '', 'todos', 'SI'],
  ['curp', 'CURP', 'Descárgala de gob.mx/curp', 'todos', 'SI'],
  ['domicilio', 'Comprobante de domicilio', 'Luz, agua o teléfono, máximo 3 meses', 'todos', 'SI'],
  ['csf', 'Constancia de situación fiscal (RFC)', 'Del SAT, con tu RFC', 'todos', 'SI'],
  ['nss', 'Número de Seguro Social', 'Hoja o captura del IMSS con tu NSS', 'todos', 'SI'],
  ['clabe', 'Estado de cuenta con CLABE', 'Carátula donde se vea tu nombre y CLABE (para tu nómina)', 'todos', 'SI'],
  ['foto', 'Foto tuya de frente', 'Fondo claro, sin lentes ni gorra', 'todos', 'SI'],
  ['licencia', 'Licencia de conducir vigente', 'Frente y reverso (puedes subir PDF o dos fotos en una)', 'repartidor', 'SI'],
];
const MAX_ARCHIVO = 12e6; // bytes en base64 (~9 MB de archivo)

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
  ['ALTAS_FOLDER_ID', '', 'Carpeta de Drive con los documentos de personas que aún no se dan de alta (se crea sola)'],
  ['RUTA_TOLERANCIA_MIN', '20', 'Minutos de tolerancia contra la hora estimada antes de contar una entrega como tarde'],
  ['RUTA_REPORTE_HORA', '23', 'Hora (0-23) del reporte diario de rutas contra Shipday (después del límite de entrega de las 23:00)'],
  ['SHIPDAY_PREFIJO', 'ML-', 'Prefijo de los números de orden en Shipday (antes del número de shipment)'],
  ['GPS_MODO', 'produccion', 'produccion = cada 5 min se guarda el GPS de Shipday y se avisa si un repartidor se sale de su ruta · prueba = solo se guarda · apagado'],
  ['GPS_DESVIO_M', '800', 'Metros fuera del recorrido planeado para contar que un repartidor se salió de su ruta'],
  ['GPS_DESVIO_MUESTRAS', '2', 'Muestras seguidas (cada 5 min) fuera de ruta antes de avisar'],
  ['RUTA_INACTIVIDAD_MIN', '60', 'Minutos sin entregar ni marcar fallido una parada antes de avisar (0 = no avisar)'],
  ['JERARQUIA_DIAS', '30', 'Días hacia atrás que cuentan para la jerarquía de repartidores'],
  ['JERARQUIA_PESO_EXITO', '0.6', 'Peso del % de éxito en la jerarquía (el resto es el volumen entregado)'],
  ['RECOLECCION_MODO', 'aprobacion', 'aprobacion = propone y un admin aprueba · automatico = asigna directo en Shipday · apagado'],
  ['RECOLECCION_HASTA', '12:00', 'Hora límite para asignar recolecciones en automático'],
  ['RECOLECCION_DESDE', '08:00', 'Hora desde la que se buscan recolecciones'],
  ['RECOLECCION_CAPACIDAD', '6', 'Puntos de volumen que puede recolectar un repartidor (bajo=1, medio=2, alto=3)'],
  ['RECOLECCION_TEXTO', 'recoleccion', 'Texto que identifica una recolección en el número de envío o el nombre de origen'],
  ['SEGUIMIENTO_MIN', '10', 'Cada cuántos minutos se revisa en Shipday el estado de las rutas del día (mínimo 10)'],
  ['SEGUIMIENTO_DESDE', '8', 'Hora (0-23) desde la que se revisa Shipday'],
  ['SEGUIMIENTO_HASTA', '23', 'Hora (0-23) hasta la que se revisa Shipday'],
  ['RUTA_LIMITE', '23:00', 'Hora límite de entrega si la ruta no trae una (para el recálculo de si acaban a tiempo)'],
  ['SHIPDAY_HORA_UTC', 'SI', 'SI si Shipday devuelve las horas en UTC sin zona; NO si vienen en hora de CDMX'],
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
    const user = action.public ? null : auth_(req.token, action.admin ? 'patron' : action.ops ? 'admin' : '');
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
  apps:             { fn: (req, u) => appsPara_(u.no_empleado) },
  altaIniciar:      { public: true, fn: altaIniciar_ },
  altaEstado:       { public: true, fn: (req) => altaEstado_(altaPorToken_(req.alta_token)) },
  altaSubir:        { public: true, fn: altaSubir_ },
  misDocumentos:    { fn: (req, u) => docsDe_('E:' + u.no_empleado, rolBienvenida_(persona_(u.no_empleado))) },
  subirMiDocumento: { fn: subirMiDocumento_ },
  archivo:          { fn: archivo_ },
  cambiarPin:       { fn: cambiarPin_ },
  guardarMisDatos:  { fn: (req, u) => guardarDatos_(u.no_empleado, req, u) },
  desempeno:        { fn: (req, u) => desempeno_(u.no_empleado, req.fecha) },

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
  siguienteNumero:  { admin: true, fn: () => siguienteNumero_() },
  altasAdmin:       { admin: true, fn: altasAdmin_ },
  resolverAlta:     { admin: true, fn: resolverAlta_ },
  revisarDocumento: { admin: true, fn: revisarDocumento_ },
  docsDeEmpleado:   { admin: true, fn: (req) => docsDe_('E:' + req.no_empleado, rolBienvenida_(persona_(req.no_empleado))) },

  // Rutas
  yo:               { fn: (req, u) => u },
  miRuta:           { fn: (req, u) => miRuta_(u.no_empleado, req.fecha) },
  rutasConfig:      { ops: true, fn: (req) => rutasConfig_(req) },
  guardarClaves:    { admin: true, fn: guardarClaves_ },
  tomtomRutas:      { ops: true, fn: tomtomRutas_ },
  publicarRutas:    { ops: true, fn: publicarRutas_ },
  rutasAdmin:       { ops: true, fn: (req) => rutasAdmin_(req.fecha || hoy_()) },
  reporteRutas:     { ops: true, fn: (req) => reporteRutas_(req.fecha || hoy_(), false) },
  shipdayRepartidores: { admin: true, fn: shipdayRepartidores_ },
  vincularShipday:  { admin: true, fn: vincularShipday_ },
  gpsPrueba:        { admin: true, fn: (req) => gpsPrueba_(req.fecha || hoy_()) },
  gpsAhora:         { admin: true, fn: () => { asegurarTriggerReporte_(); return gpsMuestrear_(); } },
  recolecciones:    { ops: true, fn: (req) => recoleccionesVista_(req.fecha || hoy_()) },
  recoleccionesBuscar: { ops: true, fn: () => recoleccionesBuscar_(true) },
  recoleccionAprobar:  { ops: true, fn: recoleccionAprobar_ },
  recoleccionCambiar:  { ops: true, fn: recoleccionCambiar_ },
  recoleccionRechazar: { ops: true, fn: recoleccionRechazar_ },
  clienteVolumen:   { ops: true, fn: clienteVolumen_ },
  alcanceMotoChica: { ops: true, fn: alcanceMotoChica_ },
  elevaciones:      { ops: true, fn: elevaciones_ },
  seguimientoAhora: { ops: true, fn: () => seguimientoRutas_(true) },
  seguimientoRuta:  { ops: true, fn: (req) => seguimientoDetalle_(req.ruta_id) },
  shipdayMuestra:   { ops: true, fn: shipdayMuestra_ },
  emergencias:      { ops: true, fn: emergencias_ },
  guardarDatosDe:   { ops: true, fn: (req, u) => { if (!req.no_empleado) throw new Error('Falta el empleado'); return guardarDatos_(String(req.no_empleado), req, u); } },
  historialEntregas:{ ops: true, fn: (req) => historialEntregas_(req.fecha || hoy_()) },
  historialActualizar: { ops: true, fn: (req) => historialCalcular_(req.desde || hoy_(), req.hasta || req.desde || hoy_()) },
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
  if (!config_('ALTAS_FOLDER_ID')) setConfig_('ALTAS_FOLDER_ID', subfolder_(root, 'Altas').getId());
  if (!rows_('DocsTipos').length) DOCS_DEFAULT.forEach((d, i) => append_('DocsTipos', { doc_id: d[0], nombre: d[1], descripcion: d[2], puestos: d[3], requerido: d[4], orden: (i + 1) * 10, activo: 'SI' }));
  if (!rows_('Apps').length) APPS_DEFAULT.forEach((a, i) => append_('Apps', appRow_(a, i)));
  const r = sincronizarPersonal();
  instalarTriggers();
  console.log('Listo. Personal: ' + r.nuevos + ' nuevos, ' + r.actualizados + ' traídos del kiosco, ' + r.enviados + ' enviados al kiosco.');
}

function instalarTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('tareaFondeadora').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('sincronizarPersonal').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('tareaReporteRutas').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('tareaSeguimientoRutas').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('tareaOperacion5').timeBased().everyMinutes(5).create();
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
  ['no_empleado', 'clabe', 'rfc', 'curp', 'nss', 'telefono', 'flotilla_id', 'shipday_id', 'emer1_tel', 'emer2_tel', 'carrier_ids', 'sugerido', 'aprobado_por', 'clave_rastreo', 'periodo', 'salida', 'fin', 'fin_plan', 'fin_real'].forEach(col => {
    const i = headers.indexOf(col);
    if (i >= 0) sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
  });
  delete _cache['h:' + name];
  return sh;
}

/**
 * Base única de empleados: el expediente (Personal) es donde se captura todo, incluido horario y checadas.
 * La pestaña Empleados del checador se mantiene sola:
 *  - Al guardar en el portal se copia al momento (empujarEmpleado_).
 *  - Cada hora se concilian: empleados creados en el kiosco entran a Personal, y si alguien cambió nombre u
 *    horario en el kiosco, gana el cambio más reciente (columna Actualizado vs actualizado de Personal).
 */
const CHECADAS_TODAS = 'ENTRADA,SALIDA_COMIDA,REGRESO_COMIDA,SALIDA';
const CHECADAS_REPARTIDOR = 'ENTRADA,SALIDA_COMIDA,REGRESO_COMIDA';
const EMP_CAMPOS = [ // [Personal, Empleados]
  ['nombre', 'Nombre'], ['checadas', 'Checadas'], ['hora_entrada', 'Hora de entrada'], ['dias_laborales', 'Días laborales'],
  ['minutos_comida', 'Minutos de comida'], ['fecha_ingreso', 'Fecha de ingreso'],
];

function sincronizarPersonal() {
  return withLock_(() => {
    const emp = filasEmpleados_();
    if (!emp) return { nuevos: 0, actualizados: 0, enviados: 0 };
    let nuevos = 0, actualizados = 0, enviados = 0;
    const personal = rows_('Personal');
    emp.filas.forEach(e => {
      const p = personal.find(x => String(x.no_empleado) === e.no);
      if (!p) {
        const nuevo = { no_empleado: e.no, rol: e.no === '1' ? 'patron' : 'empleado', estatus: 'activo', pin_intentos: 0, pin_bloqueado: 'NO', actualizado: e.act || new Date() };
        EMP_CAMPOS.forEach(([k]) => nuevo[k] = e.v[k]);
        if (nuevo.fecha_ingreso) nuevo.fecha_ingreso = parseFecha_(nuevo.fecha_ingreso);
        append_('Personal', nuevo);
        nuevos++;
        return;
      }
      if (p.estatus === 'baja') return;
      const pv = valoresPersona_(p);
      const difiere = EMP_CAMPOS.some(([k]) => normCampo_(k, pv[k]) !== normCampo_(k, e.v[k]));
      if (!difiere) return;
      const tP = p.actualizado instanceof Date ? p.actualizado.getTime() : 0;
      if (tP === 0 || (e.act && e.act.getTime() > tP)) { // nunca se editó en el portal, o el kiosco es más reciente: traer
        const upd = { actualizado: e.act };
        EMP_CAMPOS.forEach(([k]) => { if (String(e.v[k]).trim() !== '' || k === 'checadas') upd[k] = k === 'fecha_ingreso' ? parseFecha_(e.v[k]) : e.v[k]; });
        update_('Personal', p._row, upd);
        actualizados++;
      } else { // el portal es más reciente: enviar
        escribirEmpleado_(emp, e, pv);
        update_('Personal', p._row, { actualizado: new Date() });
        enviados++;
      }
    });
    delete _cache.emp;
    return { nuevos: nuevos, actualizados: actualizados, enviados: enviados };
  });
}

/** Si el número ya existe en el kiosco, completa en Personal lo que falte (horario) antes de empujar. */
function sincronizarDesdeKiosco_(no) {
  const emp = filasEmpleados_();
  const e = emp && emp.filas.find(x => x.no === String(no));
  const p = rows_('Personal').find(x => String(x.no_empleado) === String(no));
  if (!e || !p) return;
  const upd = {};
  EMP_CAMPOS.forEach(([k]) => { if (k !== 'nombre' && String(p[k] == null ? '' : p[k]).trim() === '' && e.v[k]) upd[k] = k === 'fecha_ingreso' ? parseFecha_(e.v[k]) : e.v[k]; });
  if (Object.keys(upd).length) update_('Personal', p._row, upd);
}

/** Copia un expediente a la pestaña Empleados (crea el renglón si se dio de alta desde el portal). */
function empujarEmpleado_(no) {
  const p = rows_('Personal').find(x => String(x.no_empleado) === String(no));
  if (!p || p.estatus === 'baja') return false;
  const emp = filasEmpleados_();
  if (!emp) return false;
  const pv = valoresPersona_(p);
  if (!pv.checadas) pv.checadas = rolBienvenida_(p) === 'repartidor' ? CHECADAS_REPARTIDOR : CHECADAS_TODAS;
  let e = emp.filas.find(x => x.no === String(no));
  if (!e) {
    const fila = emp.h.map(k => k === 'No. empleado' ? String(no) : k === 'Contador' ? 0 : '');
    const r = emp.sh.getLastRow() + 1;
    emp.sh.getRange(r, 1, 1, emp.h.length).setNumberFormat('@').setValues([fila.map(String)]);
    e = { no: String(no), row: r, v: {} };
  }
  escribirEmpleado_(emp, e, pv);
  update_('Personal', p._row, { actualizado: new Date(), checadas: pv.checadas });
  delete _cache.emp;
  return true;
}

function escribirEmpleado_(emp, e, pv) {
  EMP_CAMPOS.forEach(([k, col]) => {
    const c = emp.h.indexOf(col);
    if (c < 0 || String(pv[k] == null ? '' : pv[k]).trim() === '') return; // nunca borra lo que ya tiene el kiosco
    const val = k === 'fecha_ingreso' ? (pv[k] ? parseFecha_(pv[k]) : '') : String(pv[k] == null ? '' : pv[k]);
    emp.sh.getRange(e.row, c + 1).setNumberFormat('@').setValue(val);
  });
  const ca = emp.h.indexOf('Actualizado');
  if (ca >= 0) emp.sh.getRange(e.row, ca + 1).setNumberFormat('@').setValue(now_());
}

function valoresPersona_(p) {
  const v = {};
  EMP_CAMPOS.forEach(([k]) => v[k] = p[k] == null ? '' : p[k]);
  v.fecha_ingreso = fmt_(p.fecha_ingreso, 'yyyy-MM-dd');
  v.hora_entrada = horaTexto_(p.hora_entrada);
  v.minutos_comida = p.minutos_comida === '' || p.minutos_comida == null ? '' : String(Number(p.minutos_comida));
  return v;
}

function normCampo_(k, v) {
  if (k === 'fecha_ingreso') return parseFecha_(v) || '';
  if (k === 'hora_entrada') return horaTexto_(v);
  if (k === 'minutos_comida') return v === '' || v == null ? '' : String(Number(v));
  if (k === 'dias_laborales' || k === 'checadas') return String(v || '').toUpperCase().replace(/\s+/g, '');
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

/** '9:00', Date de Sheets o '09:00:00' → '9:00' */
function horaTexto_(v) {
  if (v === '' || v == null) return '';
  const m = parseHora_(v);
  return m == null ? String(v) : Math.floor(m / 60) + ':' + ('0' + Math.floor(m % 60)).slice(-2);
}

/** Renglones de Empleados con sus valores como texto y la fecha de Actualizado. */
function filasEmpleados_() {
  const sh = ss_().getSheetByName('Empleados');
  if (!sh) return null;
  const last = sh.getLastRow(), lc = sh.getLastColumn();
  if (lc < 1) return null;
  const rng = sh.getRange(1, 1, Math.max(last, 1), lc);
  const disp = rng.getDisplayValues(), val = rng.getValues();
  const h = disp[0].map(x => String(x).trim());
  const iNo = h.indexOf('No. empleado'), iAct = h.indexOf('Actualizado');
  const filas = [];
  for (let i = 1; i < disp.length; i++) {
    const no = String(disp[i][iNo] || '').trim();
    if (!no) continue;
    const v = {};
    EMP_CAMPOS.forEach(([k, col]) => { const c = h.indexOf(col); v[k] = c >= 0 ? String(disp[i][c]).trim() : ''; });
    v.nombre = v.nombre.replace(/\s+/g, ' ');
    let act = iAct >= 0 ? val[i][iAct] : '';
    act = act instanceof Date ? act : parseFechaHora_(act);
    filas.push({ no: no, row: i + 1, v: v, act: act });
  }
  return { sh: sh, h: h, filas: filas };
}

function parseFechaHora_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] || 0)) : null;
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
    asegurarPatron_();
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
  return { no_empleado: String(p.no_empleado), nombre: p.nombre, rol: rolDe_(p), puesto: p.puesto || '',
    repartidor: rolBienvenida_(p) === 'repartidor' };
}

/** Roles: patron (super admin, todo), admin (rutas y reporte), empleado. */
function rolDe_(p) { return p.rol === 'patron' ? 'patron' : p.rol === 'admin' ? 'admin' : 'empleado'; }
/** Si nadie es patrón (instalaciones anteriores), el No. 1 pasa a patrón. */
function asegurarPatron_() {
  const per = rows_('Personal');
  if (per.some(p => p.rol === 'patron' && p.estatus !== 'baja')) return;
  const p1 = per.find(p => String(p.no_empleado) === '1');
  if (p1) { update_('Personal', p1._row, { rol: 'patron' }); bitacora_('1', 'rol_patron', 'Personal', '1', 'migración a patrón'); }
}

function auth_(token, nivel) {
  if (!token) throw new Error('Sesión requerida');
  asegurarPatron_();
  const parts = String(token).split('.');
  let payload;
  try { payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString(); } catch (e) { throw new Error('Sesión inválida'); }
  if (sign_(payload) !== parts[1]) throw new Error('Sesión inválida');
  const [no, exp, ph] = payload.split('|');
  if (Date.now() > Number(exp)) throw new Error('Sesión expirada');
  const p = rows_('Personal').find(x => String(x.no_empleado) === no);
  if (!p || p.estatus === 'baja' || p.pin_bloqueado === 'SI') throw new Error('Usuario inactivo');
  if (String(p.pin_hash).slice(0, 10) !== ph) throw new Error('Sesión expirada');
  const rol = rolDe_(p);
  if ((nivel === 'patron' && rol !== 'patron') || (nivel === 'admin' && rol === 'empleado')) throw new Error('Sin permiso para esta acción');
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
    recibos_sin_firmar: recibos.filter(r => !r.firma_fecha && r.estatus !== 'cancelado' && !r.historico).length,
    ultimo_pago: pagos[0] || null,
    no_leidos: band.filter(n => !n.leido).length,
    saldo_adeudos: ad.saldo_total,
    cargos_pendientes: ad.cargos_pendientes,
    solicitudes_pendientes: solicitudesDe_(u.no_empleado).filter(s => s.estatus === 'pendiente').length,
    repartidor: rolBienvenida_(persona_(u.no_empleado)) === 'repartidor',
    bienvenida: (b => ({ hechos: b.hechos, total: b.total, completa: b.completa, siguiente: b.siguiente })) (bienvenida_(u.no_empleado)),
    accesos: appsPara_(u.no_empleado).filter(a => a.acceso_directo),
    ruta: rutaResumen_(u.no_empleado),
    flotilla: flotillaHoy_(u.no_empleado),
    datos_pendientes: (c => !c.domicilio || !c.contactos)(datosCompletos_(persona_(u.no_empleado))),
    desempeno: rolBienvenida_(persona_(u.no_empleado)) === 'repartidor' ? (d => ({ dia: d.dia, semana: d.semana, jerarquia: d.jerarquia }))(desempeno_(u.no_empleado)) : null,
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
    moto_tipo: p.moto_tipo || '',
    domicilio: domicilioDe_(p), contactos: contactosDe_(p), completos: datosCompletos_(p),
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
    // "celular" = ya está registrado en el checador ZKTeco (tiene al menos una checada con su huella)
    ingreso: iIng >= 0 ? parseFecha_(r[iIng]) : '', celular: conHuellaZk_().has(String(r[iNo]).trim()),
    checadas: iChk >= 0 ? String(r[iChk]) : '',
  })));
}

/** Números de empleado con al menos una checada del checador de huella ZKTeco. */
function conHuellaZk_() {
  if (_cache.zk) return _cache.zk;
  const out = new Set();
  const sh = ss_().getSheetByName('Checadas');
  if (sh && sh.getLastRow() > 1) {
    const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
    const h = v[0].map(x => String(x).trim()), iN = h.indexOf('No. empleado'), iM = h.indexOf('Método');
    if (iN >= 0 && iM >= 0) v.slice(1).forEach(r => { if (/zkteco/i.test(r[iM])) out.add(String(r[iN]).trim()); });
  }
  return (_cache.zk = out);
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
    const cargos = cargosFl.filter(c => c.responsable_id === flotillaId_(p) && !cobrados[c.rep_id] && c.fecha <= per.hasta);
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
    recibo_id: r.recibo_id, no_empleado: String(r.no_empleado), nombre: r.nombre, periodo: r.periodo, etiqueta: det.etiqueta || per.etiqueta,
    historico: r.estatus === 'historico',
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
  if (!r || (String(r.no_empleado) !== u.no_empleado && u.rol !== 'patron')) throw new Error('Recibo no encontrado');
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
    if (r.estatus === 'historico') throw new Error('Los recibos históricos no se firman');
    if (r.firma_fecha) return pickRecibo_(r);
    const p = persona_(u.no_empleado);
    if (hashPin_(p.no_empleado, String(req.pin || '')) !== p.pin_hash) throw new Error('PIN incorrecto');
    update_('Recibos', r._row, { firma_fecha: new Date(), firma_dispositivo: String(req.dispositivo || '').slice(0, 200) });
    bitacora_(u.no_empleado, 'firmar_recibo', 'Recibos', r.recibo_id, '');
    return pickRecibo_(rows_('Recibos').find(x => x.recibo_id === r.recibo_id));
  });
}

// ───────────────────────── Carga de nómina histórica ─────────────────────────

/**
 * Carga recibos históricos (solo neto pagado, sin desglose) desde un JSON en Drive llamado
 * "historico_nomina.json". Se ejecuta a mano desde el editor. No firma, no notifica, no duplica:
 * si el empleado ya tiene recibo vivo de esa quincena, se lo salta y lo reporta.
 * JSON: { personas:[{no,nombre}], renombrar:{no:nombre}, salarios:{no:diario}, config:{clave:valor},
 *         recibos:[{no,nombre,periodo,etiqueta,desde,hasta,neto,tipo}] }
 */
function importarHistoricoNomina() {
  const it = DriveApp.getFilesByName('historico_nomina.json');
  if (!it.hasNext()) throw new Error('No encontré historico_nomina.json en Drive');
  let f = it.next();
  while (it.hasNext()) { const g = it.next(); if (g.getLastUpdated() > f.getLastUpdated()) f = g; }
  const res = importarHistorico_(expandirHistorico_(JSON.parse(f.getBlob().getDataAsString())));
  console.log(JSON.stringify(res));
  return res;
}

/** Formato compacto: { q: { no: { 'yyyy-MM-1': neto, 'AGU-2024': neto } } } → recibos completos. */
function expandirHistorico_(d) {
  if (!d.q) return d;
  d.recibos = d.recibos || [];
  Object.keys(d.q).forEach(no => Object.keys(d.q[no]).forEach(pid => {
    const ag = pid.match(/^AGU-(\d{4})$/);
    const per = ag ? { etiqueta: 'Aguinaldo ' + ag[1], desde: ag[1] + '-12-01', hasta: ag[1] + '-12-20' } : periodo_(pid);
    d.recibos.push({ no: no, periodo: pid, etiqueta: per.etiqueta, desde: per.desde, hasta: per.hasta, neto: d.q[no][pid], tipo: ag ? 'aguinaldo' : 'quincena' });
  }));
  return d;
}

function importarHistorico_(d) {
  return withLock_(() => {
    const res = { personas_nuevas: 0, renombrados: 0, salarios: 0, recibos: 0, duplicados: [], sin_persona: [] };
    const personal = () => rows_('Personal');
    // 1) Ex-empleados como baja
    const nuevas = (d.personas || []).filter(x => !personal().find(p => String(p.no_empleado) === String(x.no)));
    if (nuevas.length) {
      const h = headers_('Personal');
      const filas = nuevas.map(x => h.map(k => ({ no_empleado: String(x.no), nombre: x.nombre, rol: 'empleado', estatus: 'baja',
        pin_intentos: 0, pin_bloqueado: 'NO', notas: 'Alta automática por historial de nómina', actualizado: new Date() })[k] ?? ''));
      const sh = sheet_('Personal');
      sh.getRange(sh.getLastRow() + 1, 1, filas.length, h.length).setValues(filas);
      delete _cache['r:Personal'];
      res.personas_nuevas = filas.length;
    }
    // 2) Correcciones de nombre
    Object.keys(d.renombrar || {}).forEach(no => {
      const p = personal().find(x => String(x.no_empleado) === String(no));
      if (p && p.nombre !== d.renombrar[no]) { update_('Personal', p._row, { nombre: d.renombrar[no], actualizado: new Date() }); res.renombrados++; }
    });
    // 3) Salario diario (solo si está vacío o en 0)
    Object.keys(d.salarios || {}).forEach(no => {
      const p = personal().find(x => String(x.no_empleado) === String(no));
      if (p && !Number(p.salario_diario) && Number(d.salarios[no]) > 0) { update_('Personal', p._row, { salario_diario: Number(d.salarios[no]) }); res.salarios++; }
    });
    Object.keys(d.config || {}).forEach(k => setConfig_(k, d.config[k]));
    // 4) Recibos
    const existentes = {};
    rows_('Recibos').filter(r => r.estatus !== 'cancelado').forEach(r => existentes[String(r.no_empleado) + '|' + r.periodo] = r.recibo_id);
    const nombres = {};
    personal().forEach(p => nombres[String(p.no_empleado)] = p.nombre);
    const h = headers_('Recibos');
    const filas = [];
    (d.recibos || []).forEach(x => {
      const no = String(x.no), key = no + '|' + x.periodo;
      if (!(no in nombres)) { res.sin_persona.push(key); return; }
      if (existentes[key]) { res.duplicados.push(key + ' (' + existentes[key] + ')'); return; }
      existentes[key] = 'HIS';
      const neto = round_(Number(x.neto), 2);
      const rec = {
        recibo_id: 'HIS-' + no + '-' + x.periodo, no_empleado: no, nombre: nombres[no] || x.nombre, periodo: x.periodo,
        desde: parseFecha_(x.desde), hasta: parseFecha_(x.hasta), dias: 0, salario_diario: 0, sueldo: 0, bonos: 0,
        otras_percepciones: neto, desc_faltas: 0, desc_retardos: 0, desc_cargos: 0, desc_adeudos: 0, otras_deducciones: 0,
        total_percepciones: neto, total_deducciones: 0, neto: neto,
        detalle_json: JSON.stringify({ historico: true, tipo: x.tipo || 'quincena', etiqueta: x.etiqueta, concepto_otras: 'Neto pagado (sin desglose)',
          notas: 'Recibo histórico: monto neto que se pagó. En ese entonces no se desglosaban bonos ni descuentos.' }),
        estatus: 'historico', fecha_emision: new Date(), emitido_por: 'historico',
      };
      filas.push(h.map(k => rec[k] === undefined ? '' : rec[k]));
    });
    if (filas.length) {
      const sh = sheet_('Recibos');
      sh.getRange(sh.getLastRow() + 1, 1, filas.length, h.length).setValues(filas);
      delete _cache['r:Recibos'];
    }
    res.recibos = filas.length;
    bitacora_('sistema', 'importar_historico', 'Recibos', '', JSON.stringify({ recibos: res.recibos, personas: res.personas_nuevas, duplicados: res.duplicados.length }));
    return res;
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

/** En la flotilla, cada usuario es "U-" + número de empleado (el del ZKTeco). */
function flotillaId_(p) { return 'U-' + String(p.no_empleado).trim(); }

/**
 * Estado de flotilla del día para la tarjeta "Mi moto hoy" del Inicio (null si no tiene acceso a la flotilla).
 * repartidor: check matutino y carga de hoy; mecánico/admin: además, fallas pendientes de toda la flotilla.
 */
function flotillaHoy_(no) {
  try {
    const fl = SpreadsheetApp.openById(FLOTILLA_ID);
    const id = flotillaId_({ no_empleado: no });
    const u = sheetRows_(fl.getSheetByName('Usuarios')).find(x => String(x.usuario_id) === id && x.activo === 'SI');
    if (!u) return null;
    const hoy = hoy_();
    const check = sheetRows_(fl.getSheetByName('Checks'))
      .filter(x => x.tipo === 'matutino' && String(x.usuario_id) === id && fmt_(x.fecha_hora, 'yyyy-MM-dd') === hoy).pop();
    const carga = check ? sheetRows_(fl.getSheetByName('Combustible')).find(x => x.check_id === check.check_id) : null;
    const fallas = sheetRows_(fl.getSheetByName('Fallas')).filter(f => f.estatus === 'abierta' || f.estatus === 'en_reparacion');
    return {
      rol: String(u.rol),
      check: check ? { vehiculo_id: String(check.vehiculo_id), hora: fmt_(check.fecha_hora, 'HH:mm') } : null,
      carga: carga ? { monto: Number(carga.monto) } : null,
      mis_fallas: fallas.filter(f => String(f.responsable_id) === id).length,
      fallas_pendientes: u.rol === 'repartidor' ? null : fallas.length,
    };
  } catch (e) { console.warn('flotillaHoy', e); return null; }
}

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
  const cargos = p.no_empleado ? cargosFlotilla_().filter(c => c.responsable_id === flotillaId_(p))
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
      const p = per.find(x => flotillaId_(x) === c.responsable_id);
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
  rows_('Personal').filter(p => p.rol === 'patron' && p.estatus !== 'baja').forEach(p => notificar_(String(p.no_empleado), tipo, titulo, mensaje, ref));
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
  const subidos = {};
  rows_('DocsEmpleado').forEach(d => { subidos[d.file_id] = 1; });
  while (it.hasNext()) { const f = it.next(); if (subidos[f.getId()]) continue; out.push({ id: f.getId(), nombre: f.getName(), mime: f.getMimeType(), fecha: fmt_(f.getLastUpdated(), 'yyyy-MM-dd'), tamano: f.getSize() }); }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function documento_(req, u) {
  const no = u.rol === 'patron' && req.no_empleado ? req.no_empleado : u.no_empleado;
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
    (d => ({ id: 'documentos', titulo: 'Sube tus documentos', detalle: d.subidos + ' de ' + d.requeridos + ' subidos' + (d.rechazados ? ' · ' + d.rechazados + ' por corregir' : ''),
      hecho: !!p.onb_docs || (d.requeridos > 0 && d.completos), fecha: fmt_(p.onb_docs, 'yyyy-MM-dd'), rechazados: d.rechazados }))(docsDe_('E:' + no, rol)),
  ];
  if (rol === 'repartidor') pasos.push({ id: 'apps', titulo: 'Instala tus apps e inicia sesión', detalle: apps.filter(a => a.lista).length + ' de ' + apps.length + ' listas',
    hecho: apps.length > 0 && apps.every(a => a.lista), listas: apps.filter(a => a.lista).length, total: apps.length,
    faltan: apps.filter(a => !a.lista).map(a => a.nombre) });
  pasos.push({ id: 'checador', titulo: 'Registra tu huella en el checador', detalle: 'Con RH, en el checador de la base', hecho: !!e.celular, auto: true });
  pasos.push({ id: 'notificaciones', titulo: 'Activa las notificaciones', detalle: 'Para tu recibo y tu depósito', hecho: push, auto: true });
  const dc = datosCompletos_(p);
  pasos.push({ id: 'datos', titulo: 'Tu domicilio y 2 contactos de emergencia', detalle: [dc.domicilio ? 'Domicilio ✓' : 'Falta tu domicilio', dc.contactos ? 'contactos ✓' : 'faltan contactos'].join(' · '), hecho: dc.domicilio && dc.contactos });
  const hechos = pasos.filter(x => x.hecho).length;
  const sig = pasos.find(x => !x.hecho);
  return { rol: rol, rol_fijo: !!String(p.puesto || '').trim() || !!p.flotilla_id, pasos: pasos, hechos: hechos, total: pasos.length,
    completa: hechos === pasos.length, siguiente: sig ? sig.titulo : '' };
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

// ───────────────────────── Documentos de alta y altas ─────────────────────────

function tiposDocs_(rol) {
  return rows_('DocsTipos').filter(t => t.activo !== 'NO' && (t.puestos !== 'repartidor' || rol === 'repartidor' || rol === ''))
    .sort((a, b) => Number(a.orden || 999) - Number(b.orden || 999))
    .map(t => ({ doc_id: String(t.doc_id), nombre: t.nombre, descripcion: t.descripcion || '', requerido: t.requerido !== 'NO', solo_repartidor: t.puestos === 'repartidor' }));
}

/** Lista de documentos de un dueño ('E:no' o 'A:alta_id') con el último archivo de cada tipo. */
function docsDe_(owner, rol) {
  const archivos = rows_('DocsEmpleado').filter(d => d.owner === owner && d.estatus !== 'reemplazado');
  const tipos = tiposDocs_(rol).map(t => {
    const a = archivos.filter(x => String(x.doc_id) === t.doc_id).sort((x, y) => y._row - x._row)[0];
    return Object.assign(t, a ? { archivo_id: a.archivo_id, nombre_archivo: a.nombre_archivo, mime: a.mime, fecha: fmt_(a.fecha, 'yyyy-MM-dd HH:mm'),
      estatus: a.estatus, comentario: a.comentario || '' } : { estatus: 'falta' });
  });
  const req = tipos.filter(t => t.requerido);
  return { documentos: tipos, requeridos: req.length, subidos: req.filter(t => t.estatus === 'subido' || t.estatus === 'aprobado').length,
    aprobados: req.filter(t => t.estatus === 'aprobado').length, rechazados: tipos.filter(t => t.estatus === 'rechazado').length,
    completos: req.every(t => t.estatus === 'subido' || t.estatus === 'aprobado') };
}

function guardarArchivo_(folder, owner, docId, req, etiqueta) {
  if (!req.base64) throw new Error('Falta el archivo');
  if (String(req.base64).length > MAX_ARCHIVO) throw new Error('El archivo es muy grande (máx. 9 MB). Toma la foto otra vez o sube un PDF más ligero.');
  const mime = String(req.mime || '');
  if (!/^image\/|^application\/pdf$/.test(mime)) throw new Error('Solo se aceptan fotos o PDF');
  const tipo = rows_('DocsTipos').find(t => String(t.doc_id) === String(docId));
  if (!tipo) throw new Error('Tipo de documento desconocido');
  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
  const nombre = tipo.nombre + ' - ' + etiqueta + '.' + ext;
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(req.base64), mime, nombre));
  return withLock_(() => {
    rows_('DocsEmpleado').filter(d => d.owner === owner && String(d.doc_id) === String(docId) && d.estatus !== 'reemplazado')
      .forEach(d => update_('DocsEmpleado', d._row, { estatus: 'reemplazado' }));
    const id = nextId_('DOC', 6);
    append_('DocsEmpleado', { archivo_id: id, owner: owner, doc_id: String(docId), nombre_archivo: nombre, file_id: f.getId(), mime: mime,
      fecha: new Date(), estatus: 'subido', comentario: '' });
    return id;
  });
}

function hashToken_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t) + ':' + secret_('PIN_PEPPER')).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function altaIniciar_(req) {
  const rfc = normRfc_(req.rfc);
  frenoIntentos_('alta_' + rfc);
  if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) throw new Error('Revisa tu RFC: son 13 caracteres (ej. LOAS950505H12)');
  const tel = String(req.telefono || '').replace(/\D/g, '');
  if (tel.length !== 10) throw new Error('El celular debe tener 10 dígitos');
  const nombre = String(req.nombre || '').trim().replace(/\s+/g, ' ');
  if (nombre.split(' ').length < 2) throw new Error('Escribe tu nombre completo');
  if (['repartidor', 'otro'].indexOf(req.rol) < 0) throw new Error('Elige tu puesto');
  if (rows_('Personal').find(p => normRfc_(p.rfc) === rfc && p.estatus !== 'baja')) throw new Error('Ya estás dado de alta. Regresa y entra con tu RFC.');
  return withLock_(() => {
    const token = Utilities.getUuid() + Utilities.getUuid().slice(0, 8);
    const prev = rows_('Altas').find(a => normRfc_(a.rfc) === rfc && ['pendiente', 'completa'].indexOf(a.estatus) >= 0);
    if (prev) {
      // Retomar desde otro celular: debe coincidir el teléfono
      if (String(prev.telefono).replace(/\D/g, '') !== tel) throw new Error('Ya hay un registro con ese RFC y otro celular. Pide ayuda a RH.');
      update_('Altas', prev._row, { token_hash: hashToken_(token), nombre: nombre, rol: req.rol });
      return { alta_token: token, alta: altaEstado_(rows_('Altas').find(a => a.alta_id === prev.alta_id)) };
    }
    const id = nextId_('ALTA', 4);
    const folder = DriveApp.getFolderById(config_('ALTAS_FOLDER_ID')).createFolder(rfc + ' - ' + nombre);
    append_('Altas', { alta_id: id, fecha: new Date(), nombre: nombre, rfc: rfc, curp: String(req.curp || '').toUpperCase(), telefono: tel,
      correo: String(req.correo || ''), rol: req.rol, estatus: 'pendiente', folder_id: folder.getId(), token_hash: hashToken_(token) });
    return { alta_token: token, alta: altaEstado_(rows_('Altas').find(a => a.alta_id === id)) };
  });
}

function altaPorToken_(token) {
  if (!token) throw new Error('Registro no encontrado');
  const h = hashToken_(token);
  const a = rows_('Altas').find(x => x.token_hash === h);
  if (!a) throw new Error('Registro no encontrado. Vuelve a empezar con tu RFC y celular.');
  return a;
}

function altaEstado_(a) {
  const d = docsDe_('A:' + a.alta_id, a.rol);
  return { alta_id: a.alta_id, nombre: a.nombre, rfc: a.rfc, rol: a.rol, estatus: a.estatus, no_empleado: a.estatus === 'aprobada' ? String(a.no_empleado) : '',
    notas: a.estatus === 'rechazada' ? a.notas : '', docs: d };
}

function altaSubir_(req) {
  const a = altaPorToken_(req.alta_token);
  if (['pendiente', 'completa'].indexOf(a.estatus) < 0) throw new Error('Tu registro ya fue revisado por RH');
  guardarArchivo_(DriveApp.getFolderById(a.folder_id), 'A:' + a.alta_id, req.doc_id, req, a.rfc);
  const est = altaEstado_(rows_('Altas').find(x => x.alta_id === a.alta_id));
  if (est.docs.completos && a.estatus === 'pendiente') {
    update_('Altas', a._row, { estatus: 'completa' });
    est.estatus = 'completa';
    notificarAdmins_('alta', '🆕 Alta lista para revisar', a.nombre + ' subió todos sus documentos.', a.alta_id, true);
  }
  return est;
}

function subirMiDocumento_(req, u) {
  const p = persona_(u.no_empleado);
  guardarArchivo_(carpetaEmpleado_(p), 'E:' + u.no_empleado, req.doc_id, req, p.no_empleado + ' ' + p.nombre);
  const d = docsDe_('E:' + u.no_empleado, rolBienvenida_(p));
  if (d.completos && !d.documentos.some(x => x.estatus === 'subido' && x.doc_id !== req.doc_id))
    notificarAdmins_('documentos', '📄 Documentos para revisar', p.nombre + ' completó sus documentos.', String(u.no_empleado), false);
  return d;
}

/** Descarga un archivo: el dueño (empleado) o un admin. */
function archivo_(req, u) {
  const a = rows_('DocsEmpleado').find(x => x.archivo_id === req.archivo_id);
  if (!a || (a.owner !== 'E:' + u.no_empleado && u.rol !== 'patron')) throw new Error('Archivo no encontrado');
  const f = DriveApp.getFileById(a.file_id);
  return { nombre: a.nombre_archivo, mime: f.getMimeType(), base64: Utilities.base64Encode(f.getBlob().getBytes()) };
}

function altasAdmin_(req) {
  const est = req.estatus || 'abiertas';
  return rows_('Altas').filter(a => est === 'todas' || (est === 'abiertas' ? ['pendiente', 'completa'].indexOf(a.estatus) >= 0 : a.estatus === est))
    .map(a => Object.assign(altaEstado_(a), { telefono: a.telefono, curp: a.curp, correo: a.correo, fecha: fmt_(a.fecha, 'yyyy-MM-dd HH:mm'),
      no_empleado: String(a.no_empleado || ''), notas: a.notas || '' }))
    .sort((x, y) => (x.estatus === 'completa' ? 0 : 1) - (y.estatus === 'completa' ? 0 : 1) || y.fecha.localeCompare(x.fecha));
}

/** Aprobar: liga la alta a un número de empleado (existente en Personal o nuevo) y mueve sus documentos al expediente. */
function resolverAlta_(req, u) {
  const r = withLock_(() => {
    const a = rows_('Altas').find(x => x.alta_id === req.alta_id);
    if (!a) throw new Error('Alta no encontrada');
    if (['pendiente', 'completa'].indexOf(a.estatus) < 0) throw new Error('Esta alta ya fue resuelta');
    if (!req.aprobar) {
      update_('Altas', a._row, { estatus: 'rechazada', notas: req.comentario || '', fecha_resolucion: new Date(), resuelta_por: u.nombre });
      return { a: a, ok: false };
    }
    const no = String(req.no_empleado || '').trim();
    if (!no) throw new Error('Indica el número de empleado (el mismo del checador)');
    let p = rows_('Personal').find(x => String(x.no_empleado) === no);
    if (p && p.rfc && normRfc_(p.rfc) !== normRfc_(a.rfc)) throw new Error('El No. ' + no + ' ya es de ' + p.nombre + ' con otro RFC');
    const dup = rows_('Personal').find(x => normRfc_(x.rfc) === normRfc_(a.rfc) && String(x.no_empleado) !== no);
    if (dup) throw new Error('Ese RFC ya es de ' + dup.nombre + ' (No. ' + dup.no_empleado + ')');
    const datos = { rfc: normRfc_(a.rfc), curp: a.curp || '', telefono: a.telefono, correo: a.correo || '', onb_rol: a.rol };
    if (req.puesto) datos.puesto = req.puesto;
    if (!p) {
      append_('Personal', Object.assign({ no_empleado: no, nombre: a.nombre, rol: 'empleado', estatus: 'activo', fecha_ingreso: new Date(), pin_intentos: 0, pin_bloqueado: 'NO' }, datos));
    } else {
      if (!p.fecha_ingreso) datos.fecha_ingreso = new Date();
      update_('Personal', p._row, datos);
    }
    p = rows_('Personal').find(x => String(x.no_empleado) === no);
    const destino = carpetaEmpleado_(p);
    rows_('DocsEmpleado').filter(d => d.owner === 'A:' + a.alta_id).forEach(d => {
      try { DriveApp.getFileById(d.file_id).moveTo(destino); } catch (e) { console.warn('mover', e); }
      update_('DocsEmpleado', d._row, { owner: 'E:' + no });
    });
    try { DriveApp.getFolderById(a.folder_id).setTrashed(true); } catch (e) {}
    update_('Altas', a._row, { estatus: 'aprobada', no_empleado: no, fecha_resolucion: new Date(), resuelta_por: u.nombre, notas: req.comentario || '' });
    sincronizarDesdeKiosco_(no);
    empujarEmpleado_(no);
    bitacora_(u.no_empleado, 'aprobar_alta', 'Altas', a.alta_id, no);
    return { a: a, ok: true, no: no };
  });
  return { aprobada: r.ok, no_empleado: r.no || '' };
}

function revisarDocumento_(req, u) {
  const d = rows_('DocsEmpleado').find(x => x.archivo_id === req.archivo_id);
  if (!d) throw new Error('Documento no encontrado');
  if (['aprobado', 'rechazado'].indexOf(req.estatus) < 0) throw new Error('Estatus inválido');
  if (req.estatus === 'rechazado' && !String(req.comentario || '').trim()) throw new Error('Escribe qué debe corregir');
  update_('DocsEmpleado', d._row, { estatus: req.estatus, comentario: req.comentario || '', revisado_por: u.nombre, fecha_revision: new Date() });
  if (req.estatus === 'rechazado' && /^E:/.test(d.owner)) {
    const tipo = rows_('DocsTipos').find(t => String(t.doc_id) === String(d.doc_id)) || {};
    notificar_(d.owner.slice(2), 'documento_rechazado', '📄 Corrige tu ' + (tipo.nombre || 'documento'), req.comentario, d.archivo_id);
  }
  return true;
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
      sin_firmar: recibos.filter(r => !r.firma_fecha && r.estatus !== 'historico').length,
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
    altas_por_revisar: rows_('Altas').filter(a => a.estatus === 'completa').length,
    altas_en_proceso: rows_('Altas').filter(a => a.estatus === 'pendiente').length,
    docs_por_revisar: rows_('DocsEmpleado').filter(d => d.estatus === 'subido' && /^E:/.test(d.owner)).length,
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
      flotilla_id: p.flotilla_id, shipday_id: String(p.shipday_id || ''), notas: p.notas, tiene_pin: !!p.pin_hash, bloqueado: p.pin_bloqueado === 'SI',
      ultimo_acceso: fmt_(p.ultimo_acceso, 'yyyy-MM-dd HH:mm'), push: disp.indexOf(String(p.no_empleado)) >= 0,
      en_checador: !!e.no, horario: e.no ? { entrada: e.entrada, dias: e.diasTxt, comida: e.comida } : null, celular_checador: !!e.celular,
      hora_entrada: horaTexto_(p.hora_entrada) || e.entrada || '', dias_laborales: String(p.dias_laborales || e.diasTxt || ''),
      minutos_comida: p.minutos_comida === '' || p.minutos_comida == null ? (e.no ? e.comida : '') : Number(p.minutos_comida),
      checadas: String(p.checadas || e.checadas || ''),
      moto_tipo: p.moto_tipo || '', domicilio: domicilioDe_(p), contactos: contactosDe_(p),
      docs_por_revisar: rows_('DocsEmpleado').filter(d => d.owner === 'E:' + p.no_empleado && d.estatus === 'subido').length,
      bienvenida: p.estatus === 'baja' ? null : (b => ({ hechos: b.hechos, total: b.total, completa: b.completa }))(bienvenida_(p.no_empleado)),
    };
  }).sort((a, b) => (a.estatus === 'baja') - (b.estatus === 'baja') || String(a.nombre).localeCompare(String(b.nombre)));
}

const CAMPOS_EDITABLES = ['nombre', 'rfc', 'curp', 'nss', 'puesto', 'area', 'rol', 'estatus', 'fecha_ingreso', 'fecha_baja', 'salario_diario',
  'clabe', 'banco', 'telefono', 'correo', 'flotilla_id', 'shipday_id', 'notas', 'hora_entrada', 'dias_laborales', 'minutos_comida', 'checadas', 'moto_tipo'];
const DIAS_VALIDOS = ['L', 'M', 'MI', 'J', 'V', 'S', 'D'];
const CHECADAS_VALIDAS = ['ENTRADA', 'SALIDA_COMIDA', 'REGRESO_COMIDA', 'SALIDA'];

function guardarPersona_(req, u) {
  return withLock_(() => {
    const d = req.persona || {};
    const upd = {};
    CAMPOS_EDITABLES.forEach(k => { if (d[k] !== undefined) upd[k] = typeof d[k] === 'string' ? d[k].trim() : d[k]; });
    if (upd.rfc) { upd.rfc = normRfc_(upd.rfc); if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(upd.rfc)) throw new Error('RFC inválido'); }
    if (upd.curp) upd.curp = String(upd.curp).toUpperCase();
    if (upd.clabe) { upd.clabe = String(upd.clabe).replace(/\D/g, ''); if (!clabeValida_(upd.clabe)) throw new Error('La CLABE no es válida (revisa los 18 dígitos)'); }
    if (upd.rol && ['patron', 'admin', 'empleado'].indexOf(upd.rol) < 0) throw new Error('Rol inválido');
    if (upd.moto_tipo !== undefined) { if (['', 'grande', 'chica'].indexOf(upd.moto_tipo) < 0) throw new Error('Tipo de moto inválido'); personalCols_(); }
    if (upd.rol === 'patron' && u.rol !== 'patron') throw new Error('Solo un patrón puede dar el rol de patrón');
    if (upd.salario_diario !== undefined) upd.salario_diario = num_(upd.salario_diario);
    if (upd.fecha_ingreso) upd.fecha_ingreso = parseFecha_(upd.fecha_ingreso);
    if (upd.fecha_baja) upd.fecha_baja = parseFecha_(upd.fecha_baja);
    if (upd.hora_entrada) { if (!/^([01]?\d|2[0-3]):[0-5]\d(:\d\d)?$/.test(String(upd.hora_entrada))) throw new Error('Hora de entrada inválida (usa 9:00)'); upd.hora_entrada = horaTexto_(upd.hora_entrada); }
    if (upd.dias_laborales !== undefined) {
      const ds = String(upd.dias_laborales).toUpperCase().split(/[,\s]+/).filter(String);
      if (ds.some(x => DIAS_VALIDOS.indexOf(x) < 0)) throw new Error('Días laborales inválidos');
      upd.dias_laborales = DIAS_VALIDOS.filter(x => ds.indexOf(x) >= 0).map(x => x === 'MI' ? 'Mi' : x).join(',');
    }
    if (upd.minutos_comida !== undefined && upd.minutos_comida !== '') { const n = Number(upd.minutos_comida); if (!(n >= 0 && n <= 240)) throw new Error('Minutos de comida inválidos'); upd.minutos_comida = n; }
    if (upd.checadas !== undefined) {
      const cs = String(upd.checadas).toUpperCase().split(/[,\s]+/).filter(String);
      if (!cs.length || cs.some(x => CHECADAS_VALIDAS.indexOf(x) < 0)) throw new Error('Elige qué checadas le tocan');
      upd.checadas = CHECADAS_VALIDAS.filter(x => cs.indexOf(x) >= 0).join(',');
    }
    upd.actualizado = new Date();
    const todos = rows_('Personal');
    if (upd.rfc) { const dup = todos.find(x => normRfc_(x.rfc) === upd.rfc && String(x.no_empleado) !== String(d.no_empleado)); if (dup) throw new Error('Ese RFC ya es de ' + dup.nombre); }
    if (upd.clabe) { const dup = todos.find(x => String(x.clabe) === upd.clabe && String(x.no_empleado) !== String(d.no_empleado)); if (dup) throw new Error('Esa CLABE ya es de ' + dup.nombre); }
    let p = todos.find(x => String(x.no_empleado) === String(d.no_empleado));
    if (!p) {
      if (!String(d.no_empleado || '').trim() || !upd.nombre) throw new Error('Número y nombre son obligatorios');
      append_('Personal', Object.assign({ no_empleado: String(d.no_empleado).trim(), rol: 'empleado', estatus: 'activo', pin_intentos: 0, pin_bloqueado: 'NO' }, upd));
    } else {
      if (String(p.no_empleado) === u.no_empleado && upd.rol && upd.rol !== 'patron') throw new Error('No puedes quitarte el rol de patrón a ti mismo');
      update_('Personal', p._row, upd);
    }
    empujarEmpleado_(String(d.no_empleado).trim());
    bitacora_(u.no_empleado, 'guardar_persona', 'Personal', d.no_empleado, Object.keys(upd).join(','));
    return true;
  });
}

/** Siguiente número libre (para dar de alta desde el portal). */
function siguienteNumero_() {
  const nums = rows_('Personal').map(p => Number(p.no_empleado)).concat((filasEmpleados_() || { filas: [] }).filas.map(e => Number(e.no))).filter(n => n > 0);
  return String((nums.length ? Math.max.apply(null, nums) : 0) + 1);
}

/** Dígito verificador de CLABE (pesos 3,7,1). */
function clabeValida_(c) {
  if (!/^\d{18}$/.test(c)) return false;
  const w = [3, 7, 1];
  let s = 0;
  for (let i = 0; i < 17; i++) s += (Number(c[i]) * w[i % 3]) % 10;
  return (10 - (s % 10)) % 10 === Number(c[17]);
}


// ───────────────────────── Rutas (ruteador, Mi ruta y reporte Shipday) ─────────────────────────
// Las keys de TomTom y Shipday viven en las propiedades del script: nunca llegan al navegador.

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function setProp_(k, v) { const p = PropertiesService.getScriptProperties(); if (v) p.setProperty(k, v); else if (p.deleteProperty) p.deleteProperty(k); else p.setProperty(k, ''); }
function asegurarTriggerReporte_() {
  try {
    const h = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction && t.getHandlerFunction());
    if (h.indexOf('tareaReporteRutas') < 0) ScriptApp.newTrigger('tareaReporteRutas').timeBased().everyHours(1).create();
    if (h.indexOf('tareaSeguimientoRutas') < 0) ScriptApp.newTrigger('tareaSeguimientoRutas').timeBased().everyMinutes(10).create();
    if (h.indexOf('tareaOperacion5') < 0) ScriptApp.newTrigger('tareaOperacion5').timeBased().everyMinutes(5).create();
  } catch (e) { console.warn('trigger rutas', e); }
  asegurarConfig_();
}
function rutasTabs_() {
  ['Rutas', 'ReporteRutas'].forEach(n => {
    const sh = ss_().getSheetByName(n);
    if (!sh || SCHEMA[n].some(c => headers_(n).indexOf(c) < 0)) ensureTab_(n, SCHEMA[n]);
  });
}

/**
 * Datos para el ruteador: empleados con asistencia del día (checador), casa (pin del portal), tipo de moto y jerarquía.
 * fecha = hoy → presente / salió / sin checar / descanso; fecha futura → programado / descanso según su horario.
 */
function rutasConfig_(req) {
  const per = rows_('Personal').filter(p => p.estatus !== 'baja');
  const hoy = hoy_();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String((req && req.fecha) || '')) ? req.fecha : hoy;
  const chk = fecha === hoy ? checadasPorDia_(hoy, hoy) : {};
  const emp = empleadosChecador_();
  const jer = jerarquia_();
  const rk = {}; jer.lista.forEach(x => { rk[x.no_empleado] = x; });
  return {
    tomtom: !!prop_('TOMTOM_KEY'), shipday: !!prop_('SHIPDAY_KEY'), fecha: fecha, hoy: hoy, jerarquia_dias: jer.dias,
    empleados: per.map(p => {
      const no = String(p.no_empleado), e = emp.find(x => x.no === no) || {};
      const laboral = parseDias_(p.dias_laborales || e.diasTxt || '').indexOf(diaSemana_(fecha)) >= 0;
      let asis;
      if (fecha === hoy) {
        const m = (chk[no] || {})[hoy] || [];
        const ent = m.find(t => t.tipo === 'ENTRADA'), sal = m.filter(t => t.tipo === 'SALIDA').pop();
        asis = ent ? (sal ? { estado: 'salio', entrada: ent.hora, salida: sal.hora } : { estado: 'presente', entrada: ent.hora }) : { estado: laboral ? 'sin_checar' : 'descanso' };
      } else asis = { estado: fecha > hoy ? (laboral ? 'programado' : 'descanso') : 'pasado' };
      const d = domicilioDe_(p), r = rk[no];
      return { no_empleado: no, nombre: p.nombre, telefono: String(p.telefono || ''), repartidor: rolBienvenida_(p) === 'repartidor',
        moto_tipo: p.moto_tipo || '', casa: d.lat != null ? [d.lat, d.lng] : null, colonia: d.colonia ? d.colonia + ', ' + d.municipio : '',
        asistencia: asis, shipday: idsShipday_(p).length > 0,
        rango: r ? { rank: r.rank, de: jer.lista.length, score: r.score, pct: r.pct, entregados: r.entregados, dias: r.dias } : null };
    }).sort((a, b) => (b.repartidor - a.repartidor) || String(a.nombre).localeCompare(String(b.nombre))),
  };
}

/** Guarda (o borra con '-') las keys. Antes de guardar prueba que funcionen. */
function guardarClaves_(req, u) {
  const out = {};
  if (req.tomtom) {
    if (req.tomtom === '-') setProp_('TOMTOM_KEY', '');
    else {
      const k = String(req.tomtom).trim();
      const r = UrlFetchApp.fetch('https://api.tomtom.com/routing/1/calculateRoute/19.4182,-99.1369:19.4326,-99.1332/json?key=' + encodeURIComponent(k) + '&routeRepresentation=summaryOnly', { muteHttpExceptions: true });
      if (r.getResponseCode() !== 200) throw new Error('TomTom rechazó la key (' + r.getResponseCode() + '). Revisa que tenga habilitada la Routing API.');
      setProp_('TOMTOM_KEY', k);
    }
    out.tomtom = !!prop_('TOMTOM_KEY');
  }
  if (req.shipday) {
    if (req.shipday === '-') setProp_('SHIPDAY_KEY', '');
    else {
      const k = String(req.shipday).trim();
      const r = UrlFetchApp.fetch('https://api.shipday.com/carriers', { muteHttpExceptions: true, headers: { Authorization: 'Basic ' + k, Accept: 'application/json' } });
      if (r.getResponseCode() !== 200) throw new Error('Shipday rechazó la key (' + r.getResponseCode() + '). Cópiala de Shipday → My Account → API key.');
      setProp_('SHIPDAY_KEY', k);
    }
    out.shipday = !!prop_('SHIPDAY_KEY');
  }
  bitacora_(u.no_empleado, 'guardar_claves', 'Rutas', '', Object.keys(out).join(','));
  return out;
}

/** Proxy a TomTom Routing (Calculate Route) con tráfico. req.rutas = [{ locs: [[lat,lng], ...] }] */
function tomtomRutas_(req) {
  const key = prop_('TOMTOM_KEY');
  if (!key) throw new Error('Falta la key de TomTom. Guárdala en el ruteador → Claves.');
  const mode = req.mode === 'car' ? 'car' : 'motorcycle';
  const dep = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(String(req.departAt || '')) ? req.departAt : 'now';
  const MAXP = 140, jobs = [];
  (req.rutas || []).forEach((r, ri) => {
    const locs = r.locs || [];
    for (let s = 0; s < locs.length - 1; s += MAXP - 1) {
      const seg = locs.slice(s, Math.min(locs.length, s + MAXP));
      const url = 'https://api.tomtom.com/routing/1/calculateRoute/' + seg.map(p => Number(p[0]).toFixed(6) + ',' + Number(p[1]).toFixed(6)).join(':') +
        '/json?key=' + encodeURIComponent(key) + '&traffic=true&routeType=fastest&travelMode=' + mode + '&departAt=' + encodeURIComponent(dep) + '&routeRepresentation=polyline' +
        (r.chica ? '&avoid=motorways&avoid=tollRoads' : '');
      jobs.push({ ri: ri, url: url });
    }
  });
  const res = jobs.map(() => null);
  let pend = jobs.map((j, i) => i);
  for (let intento = 0; intento < 3 && pend.length; intento++) {
    const sig = [];
    for (let b = 0; b < pend.length; b += 5) {
      const lote = pend.slice(b, b + 5);
      const rr = UrlFetchApp.fetchAll(lote.map(i => ({ url: jobs[i].url, muteHttpExceptions: true })));
      rr.forEach((r, k) => { if (r.getResponseCode() === 429) sig.push(lote[k]); else res[lote[k]] = r; });
      if (b + 5 < pend.length) Utilities.sleep(1100);
    }
    pend = sig;
    if (pend.length) Utilities.sleep(2000);
  }
  const out = (req.rutas || []).map(() => ({ legs: [] }));
  jobs.forEach((j, i) => {
    const o = out[j.ri];
    if (o.error) return;
    const r = res[i];
    if (!r) { o.error = 'TomTom: límite de consultas, intenta en un minuto'; return; }
    let js = null; try { js = JSON.parse(r.getContentText()); } catch (e) {}
    if (r.getResponseCode() !== 200 || !js || !js.routes || !js.routes.length) {
      const m = js && ((js.detailedError && js.detailedError.message) || (js.error && js.error.description) || js.errorText);
      o.error = 'TomTom ' + r.getResponseCode() + (m ? ': ' + m : '');
      return;
    }
    js.routes[0].legs.forEach(l => o.legs.push({ sec: l.summary.travelTimeInSeconds, m: l.summary.lengthInMeters, pts: simplificar_((l.points || []).map(p => [p.latitude, p.longitude]), 60) }));
  });
  return { rutas: out, departAt: dep };
}

/** Reduce una polilínea a como máximo n puntos (conserva extremos) y redondea a 5 decimales. */
function simplificar_(pts, n) {
  if (!pts.length) return pts;
  const step = Math.max(1, Math.ceil(pts.length / n));
  const out = [];
  for (let i = 0; i < pts.length; i += step) out.push(pts[i]);
  if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
  return out.map(p => [round_(p[0], 5), round_(p[1], 5)]);
}

/** Publica las rutas del día en la super app. Reemplaza lo publicado antes para esa fecha. */
function publicarRutas_(req, u) {
  rutasTabs_();
  const fecha = String(req.fecha || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida');
  const rutas = (req.rutas || []).filter(r => r && r.no_empleado);
  if (!rutas.length) throw new Error('Asigna al menos una ruta a un repartidor');
  const nos = rutas.map(r => String(r.no_empleado));
  const dup = nos.find((n, i) => nos.indexOf(n) !== i);
  if (dup) throw new Error(persona_(dup).nombre + ' tiene más de una ruta asignada');
  const r = withLock_(() => {
    rows_('Rutas').filter(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa')
      .forEach(x => update_('Rutas', x._row, { estatus: 'reemplazada' }));
    const pubs = [];
    rutas.forEach(rt => {
      const p = persona_(rt.no_empleado);
      const datos = { paradas: rt.paradas || [], geom: rt.geom || [], deposito: rt.deposito || null, color: rt.color || '' };
      let txt = JSON.stringify(datos);
      while (txt.length > 45000 && datos.geom.length > 20) { datos.geom = datos.geom.filter((_, i) => i % 2 === 0); txt = JSON.stringify(datos); }
      if (txt.length > 45000) { datos.geom = []; txt = JSON.stringify(datos); }
      if (txt.length > 49000) throw new Error('La ruta ' + rt.num + ' tiene demasiadas paradas para guardarse');
      const id = nextId_('RT', 6);
      append_('Rutas', { ruta_id: id, fecha: fecha, no_empleado: String(p.no_empleado), nombre: p.nombre, num: rt.num, total: rt.total,
        salida: rt.salida, fin: rt.fin, limite: /^\d{1,2}:\d{2}$/.test(String(rt.limite || '')) ? rt.limite : '', fin_estimado: rt.fin, estado_tiempo: '', km: round_(rt.km, 1), paradas: (rt.paradas || []).length,
        envios: (rt.paradas || []).reduce((s, x) => s + (x.envios || []).length, 0), datos_json: txt, estatus: 'activa',
        publicada_por: u.no_empleado, fecha_publicacion: new Date(), visto: '', sugerido: String(rt.sugerido || ''), aprobado_por: u.no_empleado });
      pubs.push({ id: id, no: String(p.no_empleado), rt: rt });
    });
    const cambios = rutas.filter(x => x.sugerido && String(x.sugerido) !== String(x.no_empleado)).length;
    bitacora_(u.no_empleado, 'publicar_rutas', 'Rutas', fecha, pubs.map(x => x.id).join(',') + (rutas.some(x => x.sugerido) ? ' · ' + cambios + ' cambio(s) a la sugerencia' : ''));
    return pubs;
  });
  asegurarTriggerReporte_();
  let push = 0;
  r.forEach(x => {
    const hoy = fecha === hoy_();
    if (notificar_(x.no, 'ruta', '🗺️ ' + (hoy ? 'Tu ruta de hoy está lista' : 'Tu ruta del ' + fecha + ' está lista'),
      (x.rt.paradas || []).length + ' paradas · sales a las ' + x.rt.salida + ' · terminas aprox ' + x.rt.fin, x.id)) push++;
  });
  return { publicadas: r.length, con_push: push };
}

function pickRuta_(x, conDatos) {
  const o = { ruta_id: x.ruta_id, fecha: fmt_(x.fecha, 'yyyy-MM-dd'), no_empleado: String(x.no_empleado), nombre: x.nombre, num: Number(x.num),
    total: Number(x.total), salida: horaCelda_(x.salida), fin: horaCelda_(x.fin), km: Number(x.km || 0), paradas: Number(x.paradas || 0),
    envios: Number(x.envios || 0), estatus: x.estatus, visto: fmt_(x.visto, 'yyyy-MM-dd HH:mm') };
  o.seguimiento = segResumen_(x);
  if (conDatos) { try { Object.assign(o, JSON.parse(x.datos_json)); } catch (e) { o.paradas_lista = []; } }
  return o;
}
function horaCelda_(v) { return v instanceof Date ? fmt_(v, 'HH:mm') : String(v || ''); }

function rutasDe_(no) {
  if (!ss_().getSheetByName('Rutas')) return [];
  return rows_('Rutas').filter(x => String(x.no_empleado) === String(no) && x.estatus === 'activa');
}
function rutaResumen_(no) {
  const hoy = hoy_();
  const l = rutasDe_(no).filter(x => fmt_(x.fecha, 'yyyy-MM-dd') >= hoy).sort((a, b) => fmt_(a.fecha, 'yyyy-MM-dd').localeCompare(fmt_(b.fecha, 'yyyy-MM-dd')));
  return l.length ? pickRuta_(l[0], false) : null;
}

/** La ruta del empleado para la fecha (o la próxima publicada). */
function miRuta_(no, fecha) {
  const hoy = hoy_();
  const l = rutasDe_(no).filter(x => fecha ? fmt_(x.fecha, 'yyyy-MM-dd') === fecha : fmt_(x.fecha, 'yyyy-MM-dd') >= hoy)
    .sort((a, b) => fmt_(a.fecha, 'yyyy-MM-dd').localeCompare(fmt_(b.fecha, 'yyyy-MM-dd')));
  if (!l.length) return null;
  const x = l[0];
  if (!x.visto) { update_('Rutas', x._row, { visto: new Date() }); x.visto = new Date(); }
  return pickRuta_(x, true);
}

function rutasAdmin_(fecha) {
  rutasTabs_();
  if (fecha === hoy_() && rows_('Rutas').some(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa')) asegurarTriggerReporte_();
  const rutas = rows_('Rutas').filter(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa').map(x => pickRuta_(x, false)).sort((a, b) => a.num - b.num);
  return { fecha: fecha, rutas: rutas, reporte: reporteGuardado_(fecha), shipday: !!prop_('SHIPDAY_KEY') };
}

function reporteGuardado_(fecha) {
  const l = rows_('ReporteRutas').filter(r => fmt_(r.fecha, 'yyyy-MM-dd') === fecha);
  const ult = {};
  l.forEach(r => { const g = fmt_(r.generado, 'yyyy-MM-dd HH:mm:ss'); if (!ult[r.ruta_id] || ult[r.ruta_id].g <= g) ult[r.ruta_id] = { g: g, r: r }; });
  return Object.keys(ult).map(k => pickReporte_(ult[k].r));
}
function pickReporte_(r) {
  let det = []; try { det = JSON.parse(r.detalle_json || '[]'); } catch (e) {}
  return { ruta_id: r.ruta_id, no_empleado: String(r.no_empleado), nombre: r.nombre, envios: Number(r.envios), entregados: Number(r.entregados),
    no_entregados: Number(r.no_entregados), en_orden: Number(r.en_orden), fuera_orden: Number(r.fuera_orden), pct_orden: Number(r.pct_orden),
    tarde: Number(r.tarde), retraso_prom: Number(r.retraso_prom), fin_plan: horaCelda_(r.fin_plan), fin_real: horaCelda_(r.fin_real),
    otros_repartidores: r.otros_repartidores, calificacion: r.calificacion, generado: fmt_(r.generado, 'yyyy-MM-dd HH:mm'), detalle: det };
}


// ── Seguimiento en vivo (Shipday cada 10 min) ──

function limiteDe_(x) { const l = horaCelda_(x.limite); return /^\d{1,2}:\d{2}$/.test(l) ? l : String(config_('RUTA_LIMITE', '23:00')); }
function segDe_(x) { try { return JSON.parse(x.seg_json || '{}'); } catch (e) { return {}; } }
const FINAL_ = { entregado: 1, fallido: 1 };

function segResumen_(x) {
  const seg = segDe_(x);
  let datos = {}; try { datos = JSON.parse(x.datos_json || '{}'); } catch (e) {}
  const envios = [].concat.apply([], (datos.paradas || []).map(p => (p.envios || []).map(String)));
  const ent = envios.filter(n => seg[n] && seg[n].e === 'entregado').length;
  const fal = envios.filter(n => seg[n] && seg[n].e === 'fallido').length;
  return { total: envios.length, entregados: ent, fallidos: fal, pendientes: envios.length - ent - fal, limite: limiteDe_(x),
    fin_estimado: horaCelda_(x.fin_estimado) || horaCelda_(x.fin), estado: x.estado_tiempo || '', retraso_min: Number(x.retraso_min || 0),
    actualizado: fmt_(x.seg_actualizado, 'HH:mm') };
}

function seguimientoDetalle_(rutaId) {
  const x = rows_('Rutas').find(r => r.ruta_id === rutaId);
  if (!x) throw new Error('Ruta no encontrada');
  const r = pickRuta_(x, true), seg = segDe_(x);
  return { ruta_id: rutaId, nombre: r.nombre, num: r.num, seguimiento: r.seguimiento,
    paradas: (r.paradas || []).map((p, i) => ({ orden: i + 1, eta: p.eta, dir: p.dir, ref: p.ref,
      envios: (p.envios || []).map(n => ({ envio: String(n), estado: (seg[n] && seg[n].e) || 'pendiente', hora: (seg[n] && seg[n].h) || '', repartidor: (seg[n] && seg[n].r) || '' })) })) };
}

function notificarOps_(tipo, titulo, mensaje, ref) {
  rows_('Personal').filter(p => (p.rol === 'patron' || p.rol === 'admin') && p.estatus !== 'baja')
    .forEach(p => notificar_(String(p.no_empleado), tipo, titulo, mensaje, ref));
}

/** Trigger cada 10 min. */
function tareaSeguimientoRutas() {
  if (!ss_().getSheetByName('Rutas') || !prop_('SHIPDAY_KEY')) return;
  const h = Number(fmt_(new Date(), 'HH'));
  if (h < Number(config_('SEGUIMIENTO_DESDE', 8)) || h > Number(config_('SEGUIMIENTO_HASTA', 23))) return;
  seguimientoRutas_(false);
}

const hm2min_ = t => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const min2hm_ = m => { m = Math.round(m); return ('0' + Math.floor(m / 60) % 24).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); };
function havM_(a, b) { const R = 6371000, t = Math.PI / 180; const x = Math.pow(Math.sin((b[0] - a[0]) * t / 2), 2) + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.pow(Math.sin((b[1] - a[1]) * t / 2), 2); return 2 * R * Math.asin(Math.sqrt(x)); }

/**
 * Revisa en Shipday los envíos pendientes de las rutas activas de hoy, avisa a admins y patrón de entregas y fallos,
 * y recalcula con tráfico real (TomTom, desde la última entrega) si cada ruta aún acaba antes de su límite.
 */
function seguimientoRutas_(forzar) {
  rutasTabs_();
  const fecha = hoy_();
  const rutas = rows_('Rutas').filter(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa');
  if (!rutas.length) return { rutas: 0 };
  const cada = Math.max(10, Number(config_('SEGUIMIENTO_MIN', 10)));
  const ahora = new Date();
  const nowMin = hm2min_(fmt_(ahora, 'HH:mm'));
  const datos = {}, pend = [];
  rutas.forEach(x => {
    let d = {}; try { d = JSON.parse(x.datos_json || '{}'); } catch (e) {}
    datos[x.ruta_id] = d;
    const seg = segDe_(x);
    const ult = x.seg_actualizado ? new Date(x.seg_actualizado).getTime() : 0;
    if (!forzar && ahora.getTime() - ult < (cada - 1) * 60000) return;
    if (hm2min_(horaCelda_(x.salida)) != null && nowMin < hm2min_(horaCelda_(x.salida)) - 15) return;
    (d.paradas || []).forEach(p => (p.envios || []).forEach(n => { if (!(seg[n] && FINAL_[seg[n].e])) pend.push(String(n)); }));
  });
  const sd = pend.length ? shipdayGet_(unicos_(pend)) : {};
  const recalc = [];
  const resumen = [];
  rutas.forEach(x => {
    const d = datos[x.ruta_id], seg = segDe_(x);
    const eventos = [];
    (d.paradas || []).forEach((p, i) => (p.envios || []).forEach(n => {
      n = String(n);
      if (!(n in sd)) return;
      const inf = shipdayInfo_(sd[n]);
      const nuevo = inf.entregado ? 'entregado' : inf.fallido ? 'fallido' : 'pendiente';
      const antes = (seg[n] && seg[n].e) || 'pendiente';
      if (nuevo !== antes) {
        seg[n] = { e: nuevo, h: inf.entrega ? fmt_(inf.entrega, 'HH:mm') : fmt_(ahora, 'HH:mm'), r: inf.repartidor || '', o: i + 1 };
        if (nuevo !== 'pendiente') eventos.push({ envio: n, estado: nuevo, parada: i + 1 });
      }
    }));
    const tocado = Object.keys(sd).length && (d.paradas || []).some(p => (p.envios || []).some(n => String(n) in sd));
    if (!tocado && !forzar) return;
    // paradas que faltan (alguno de sus envíos sigue pendiente) y punto de partida = la última parada terminada
    const restantes = [], hechas = [];
    (d.paradas || []).forEach((p, i) => {
      const es = (p.envios || []).map(n => (seg[String(n)] && seg[String(n)].e) || 'pendiente');
      if (es.some(e => e === 'pendiente')) restantes.push(p); else hechas.push({ p: p, h: Math.max.apply(null, (p.envios || []).map(n => hm2min_((seg[String(n)] || {}).h) || 0)) });
    });
    hechas.sort((a, b) => b.h - a.h);
    const origen = hechas.length ? [hechas[0].p.lat, hechas[0].p.lng] : (d.deposito || [19.4182, -99.1369]);
    const salidaMin = hm2min_(horaCelda_(x.salida));
    const desde = hechas.length ? nowMin : Math.max(nowMin, salidaMin == null ? nowMin : salidaMin);
    const ultRec = x.seg_recalculo ? new Date(x.seg_recalculo).getTime() : 0;
    const necesita = restantes.length && (eventos.length || forzar || ahora.getTime() - ultRec > 25 * 60000 || !x.estado_tiempo);
    resumen.push({ x: x, seg: seg, eventos: eventos, restantes: restantes, origen: origen, desde: desde, recalcular: !!necesita });
    if (necesita) recalc.push(resumen[resumen.length - 1]);
  });
  recalcularFin_(recalc, ahora);
  const avisos = [];
  withLock_(() => resumen.forEach(r => {
    const x = r.x, lim = hm2min_(limiteDe_(x));
    const upd = { seg_json: JSON.stringify(r.seg), seg_actualizado: ahora };
    let estado = x.estado_tiempo || '', retraso = Number(x.retraso_min || 0), fin = horaCelda_(x.fin_estimado);
    if (!r.restantes.length) { estado = 'terminada'; retraso = 0; fin = min2hm_(Math.max.apply(null, Object.keys(r.seg).map(n => hm2min_(r.seg[n].h) || 0))); }
    else if (r.finMin != null) { fin = min2hm_(r.finMin); retraso = Math.max(0, Math.round(r.finMin - lim)); estado = r.finMin > lim ? 'tarde' : 'a_tiempo'; upd.seg_recalculo = ahora; }
    Object.assign(upd, { estado_tiempo: estado, retraso_min: retraso, fin_estimado: fin });
    update_('Rutas', x._row, upd);
    const s = segResumen_(Object.assign({}, x, upd));
    if (r.eventos.length) {
      const ent = r.eventos.filter(e => e.estado === 'entregado'), fal = r.eventos.filter(e => e.estado === 'fallido');
      const partes = [];
      if (ent.length) partes.push('✅ ' + (ent.length === 1 ? 'Entregó ' + ent[0].envio + ' (parada ' + ent[0].parada + ')' : ent.length + ' entregados'));
      if (fal.length) partes.push('❌ ' + (fal.length === 1 ? 'Fallido ' + fal[0].envio + ' (parada ' + fal[0].parada + ')' : fal.length + ' fallidos'));
      avisos.push(['ruta_avance', 'Ruta ' + x.num + ' · ' + primerNombre_(x.nombre) + ': ' + partes.join(' · '),
        'Quedan ' + s.pendientes + ' de ' + s.total + (s.pendientes ? ' · termina aprox ' + s.fin_estimado + (estado === 'tarde' ? ' ⚠️ ' + retraso + ' min tarde' : ' (a tiempo)') : ' · ruta terminada'), x.ruta_id]);
    }
    if (estado === 'tarde' && x.estado_tiempo !== 'tarde')
      avisos.push(['ruta_tarde', '⚠️ Ruta ' + x.num + ' (' + primerNombre_(x.nombre) + ') ya no alcanza',
        'Con el tráfico actual terminaría a las ' + fin + ', ' + retraso + ' min después de las ' + limiteDe_(x) + '. Le quedan ' + s.pendientes + ' envío(s).', x.ruta_id]);
    if (estado === 'a_tiempo' && x.estado_tiempo === 'tarde')
      avisos.push(['ruta_tarde', '👍 Ruta ' + x.num + ' (' + primerNombre_(x.nombre) + ') vuelve a ir a tiempo', 'Termina aprox ' + fin + '.', x.ruta_id]);
    const ina = r.restantes.length ? inactividad_(x, r.seg, datos[x.ruta_id], nowMin, s) : null;
    if (ina) { update_('Rutas', x._row, { inact_json: JSON.stringify(ina.estado) }); avisos.push(ina.aviso); }
  }));
  avisos.forEach(a => notificarOps_(a[0], a[1], a[2], a[3]));
  return { rutas: resumen.length, consultados: unicos_(pend).length, avisos: avisos.length };
}
function primerNombre_(n) { return String(n || '').trim().split(/\s+/)[0].replace(/^./, c => c.toUpperCase()); }

/** Tiempo restante de cada ruta: TomTom con tráfico (o estimado si no hay key) + espera de cada parada. */
function recalcularFin_(list, ahora) {
  if (!list.length) return;
  const key = prop_('TOMTOM_KEY');
  const reqs = list.map(r => {
    const locs = [r.origen].concat(r.restantes.map(p => [p.lat, p.lng]));
    const dep = r.desde > hm2min_(fmt_(ahora, 'HH:mm')) + 1 ? fmt_(new Date(ahora.getTime() + (r.desde - hm2min_(fmt_(ahora, 'HH:mm'))) * 60000), "yyyy-MM-dd'T'HH:mm:ss") + '-06:00' : 'now';
    return { url: 'https://api.tomtom.com/routing/1/calculateRoute/' + locs.slice(0, 140).map(p => Number(p[0]).toFixed(6) + ',' + Number(p[1]).toFixed(6)).join(':') +
      '/json?key=' + encodeURIComponent(key) + '&traffic=true&routeType=fastest&travelMode=motorcycle&routeRepresentation=summaryOnly&departAt=' + encodeURIComponent(dep), muteHttpExceptions: true, locs: locs };
  });
  let res = [];
  if (key) { try { for (let b = 0; b < reqs.length; b += 5) { res = res.concat(UrlFetchApp.fetchAll(reqs.slice(b, b + 5).map(q => ({ url: q.url, muteHttpExceptions: true })))); if (b + 5 < reqs.length) Utilities.sleep(1100); } } catch (e) { console.warn('tomtom seguimiento', e); res = []; } }
  list.forEach((r, i) => {
    let viaje = null;
    const rr = res[i];
    if (rr && rr.getResponseCode() === 200) { try { viaje = JSON.parse(rr.getContentText()).routes[0].summary.travelTimeInSeconds / 60; } catch (e) {} }
    if (viaje == null) { let m = 0; for (let k = 1; k < reqs[i].locs.length; k++) m += havM_(reqs[i].locs[k - 1], reqs[i].locs[k]) * 1.4; viaje = m / (22000 / 60) * 1.4; }
    const espera = r.restantes.reduce((s, p) => s + Number(p.espera || 10), 0);
    r.finMin = r.desde + viaje + espera;
  });
}


// ── Vincular repartidores de Shipday con empleados (por ID, no por nombre) ──
/** Un empleado puede tener varias cuentas de repartidor en Shipday: IDs separados por coma. */
function idsShipday_(p) { return String((p && p.shipday_id) || '').split(/[,;\s]+/).map(x => x.trim()).filter(String); }
function personalConShipday_() { if (headers_('Personal').indexOf('shipday_id') < 0) ensureTab_('Personal', SCHEMA.Personal); }
function shipdayRepartidores_() {
  personalConShipday_();
  const key = prop_('SHIPDAY_KEY');
  if (!key) throw new Error('Falta la key de Shipday. Guárdala en el ruteador → Claves del servidor.');
  const r = UrlFetchApp.fetch('https://api.shipday.com/carriers', { muteHttpExceptions: true, headers: { Authorization: 'Basic ' + key, Accept: 'application/json' } });
  if (r.getResponseCode() !== 200) throw new Error('Shipday respondió ' + r.getResponseCode());
  let l = []; try { l = JSON.parse(r.getContentText()); } catch (e) {}
  const per = rows_('Personal').filter(p => p.estatus !== 'baja');
  return {
    repartidores: (Array.isArray(l) ? l : []).map(c => {
      const id = String(c.id);
      const v = per.find(p => idsShipday_(p).indexOf(id) >= 0);
      return { id: id, nombre: c.name || '', telefono: c.phoneNumber || '', correo: c.email || '', activo: c.isActive !== false,
        no_empleado: v ? String(v.no_empleado) : '', sugerido: v ? '' : sugerirEmpleado_(c, per) };
    }).sort((a, b) => (b.activo - a.activo) || a.nombre.localeCompare(b.nombre)),
    empleados: per.map(p => ({ no_empleado: String(p.no_empleado), nombre: p.nombre, repartidor: rolBienvenida_(p) === 'repartidor', shipday_id: String(p.shipday_id || '') }))
      .sort((a, b) => (b.repartidor - a.repartidor) || String(a.nombre).localeCompare(String(b.nombre))),
  };
}
/** Solo una sugerencia para la pantalla (teléfono igual o mismo nombre); nunca se guarda sola. */
function sugerirEmpleado_(c, per) {
  const tel = String(c.phoneNumber || '').replace(/\D/g, '').slice(-10);
  const libres = per.filter(p => !idsShipday_(p).length);
  if (tel.length === 10) { const t = libres.find(p => String(p.telefono || '').replace(/\D/g, '').slice(-10) === tel); if (t) return String(t.no_empleado); }
  const cand = libres.filter(p => mismoNombre_(c.name, p.nombre));
  return cand.length === 1 ? String(cand[0].no_empleado) : '';
}
function vincularShipday_(req, u) {
  return withLock_(() => {
    personalConShipday_();
    const id = String(req.shipday_id || '').trim();
    if (!id) throw new Error('Falta el ID de Shipday');
    const per = rows_('Personal');
    per.filter(p => idsShipday_(p).indexOf(id) >= 0 && String(p.no_empleado) !== String(req.no_empleado || '')).forEach(p => { p.shipday_id = idsShipday_(p).filter(x => x !== id).join(', '); update_('Personal', p._row, { shipday_id: p.shipday_id }); });
    if (req.no_empleado) {
      const p = per.find(x => String(x.no_empleado) === String(req.no_empleado));
      if (!p) throw new Error('Empleado no encontrado');
      update_('Personal', p._row, { shipday_id: unicos_(idsShipday_(p).concat(id)).join(', ') });
    }
    bitacora_(u.no_empleado, 'vincular_shipday', 'Personal', req.no_empleado || '', id);
    return true;
  });
}


// ───────────────────────── Operación: GPS de Shipday (prueba) y recolecciones ─────────────────────────

function tabsOperacion_() { ['GpsLog', 'Recolecciones', 'ClientesRecoleccion', 'AlcanceMoto'].forEach(n => { if (!ss_().getSheetByName(n) || SCHEMA[n].some(c => headers_(n).indexOf(c) < 0)) ensureTab_(n, SCHEMA[n]); }); }

/** Trigger cada 5 min: muestra de GPS (si está en prueba) y búsqueda de recolecciones (hasta la hora límite). */
function tareaOperacion5() {
  const hm = fmt_(new Date(), 'HH:mm');
  if (hm < '07:00' || hm > '23:30') return;
  if (prop_('SHIPDAY_KEY') && gpsModo_() !== 'apagado') { try { gpsMuestrear_(); } catch (e) { console.warn('gps', e); } }
  const modo = String(config_('RECOLECCION_MODO', 'aprobacion'));
  if (prop_('SHIPDAY_KEY') && modo !== 'apagado' && hm >= String(config_('RECOLECCION_DESDE', '08:00')) && hm <= String(config_('RECOLECCION_HASTA', '12:00'))) {
    try { recoleccionesBuscar_(false); } catch (e) { console.warn('recolecciones', e); }
  }
}

function shipdayCarriers_() {
  const key = prop_('SHIPDAY_KEY');
  if (!key) throw new Error('Falta la key de Shipday. Guárdala en el ruteador → Claves del servidor.');
  const r = UrlFetchApp.fetch('https://api.shipday.com/carriers', { muteHttpExceptions: true, headers: { Authorization: 'Basic ' + key, Accept: 'application/json' } });
  if (r.getResponseCode() !== 200) throw new Error('Shipday respondió ' + r.getResponseCode());
  let l = []; try { l = JSON.parse(r.getContentText()); } catch (e) {}
  return Array.isArray(l) ? l : [];
}
function empleadoDeCarrier_(id, per) { return (per || rows_('Personal')).find(p => idsShipday_(p).indexOf(String(id)) >= 0) || null; }

function gpsMuestrear_() {
  tabsOperacion_();
  const per = rows_('Personal'), ahora = new Date();
  let n = 0;
  const filas = [], pos = {};
  shipdayCarriers_().forEach(c => {
    const lat = c.carrrierLocationLat != null ? c.carrrierLocationLat : c.carrierLocationLat, lng = c.carrrierLocationLng != null ? c.carrrierLocationLng : c.carrierLocationLng;
    if (c.isActive === false || (!c.isOnShift && lat == null)) return;
    const e = empleadoDeCarrier_(c.id, per);
    filas.push([ahora, String(c.id), e ? String(e.no_empleado) : '', c.name || '', lat == null ? '' : Number(lat), lng == null ? '' : Number(lng), c.isOnShift ? 'SI' : 'NO']);
    if (lat != null && lng != null) pos[String(c.id)] = { lat: Number(lat), lng: Number(lng) };
    n++;
  });
  if (filas.length) { const sh = sheet_('GpsLog'); sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas); delete _cache['r:GpsLog']; }
  // conservar solo 10 días
  const sh = sheet_('GpsLog');
  if (sh.getLastRow() > 30000) sh.deleteRows(2, sh.getLastRow() - 25000);
  let desvios = 0;
  if (gpsModo_() === 'produccion') { try { desvios = revisarDesvios_(pos, ahora); } catch (e) { console.warn('desvios', e); } }
  return { muestras: n, desvios: desvios };
}

/** Análisis de un día de prueba: cada cuánto cambia la ubicación y qué paradas de 15+ min se habrían detectado. */
function gpsPrueba_(fecha) {
  tabsOperacion_();
  asegurarTriggerReporte_();
  const filas = rows_('GpsLog').filter(r => fmt_(r.fecha, 'yyyy-MM-dd') === fecha);
  const por = {};
  filas.forEach(r => { (por[r.carrier_id] = por[r.carrier_id] || { carrier_id: String(r.carrier_id), nombre: r.nombre, no_empleado: String(r.no_empleado || ''), m: [] }).m.push(r); });
  const per = rows_('Personal');
  return { fecha: fecha, activo: gpsModo_() !== 'apagado', modo: gpsModo_(), alertas: alertasGps_(fecha), repartidores: Object.keys(por).map(k => {
    const x = por[k];
    const m = x.m.map(r => ({ t: new Date(r.fecha).getTime(), lat: r.lat === '' ? null : Number(r.lat), lng: r.lng === '' ? null : Number(r.lng), turno: r.en_turno === 'SI' })).sort((a, b) => a.t - b.t);
    const conGps = m.filter(p => p.lat != null);
    let cambios = 0, congelado = 0, maxCong = 0, ini = null;
    for (let i = 1; i < conGps.length; i++) {
      const igual = conGps[i].lat === conGps[i - 1].lat && conGps[i].lng === conGps[i - 1].lng;
      if (!igual) { cambios++; congelado = 0; } else { congelado += (conGps[i].t - conGps[i - 1].t) / 60000; maxCong = Math.max(maxCong, congelado); }
    }
    // paradas: ventana de puntos a menos de 100 m del primero durante 15+ min (con movimiento real de GPS)
    const paradas = [];
    let i = 0;
    while (i < conGps.length) {
      let j = i;
      while (j + 1 < conGps.length && havM_([conGps[i].lat, conGps[i].lng], [conGps[j + 1].lat, conGps[j + 1].lng]) <= 100) j++;
      const dur = (conGps[j].t - conGps[i].t) / 60000;
      if (dur >= 15) {
        const seg = conGps.slice(i, j + 1);
        const exactos = seg.every(p => p.lat === seg[0].lat && p.lng === seg[0].lng);
        const enBase = havM_([conGps[i].lat, conGps[i].lng], [19.4182, -99.1369]) <= 150;
        paradas.push({ desde: fmt_(new Date(conGps[i].t), 'HH:mm'), hasta: fmt_(new Date(conGps[j].t), 'HH:mm'), min: Math.round(dur),
          lat: round_(conGps[i].lat, 5), lng: round_(conGps[i].lng, 5), tipo: enBase ? 'base' : exactos ? 'sin_senal' : 'detenido' });
        i = j + 1;
      } else i++;
    }
    const e = x.no_empleado ? per.find(p => String(p.no_empleado) === x.no_empleado) : null;
    return { carrier_id: x.carrier_id, nombre: x.nombre, empleado: e ? e.nombre : '', muestras: m.length, con_gps: conGps.length,
      en_turno: m.filter(p => p.turno).length, cambios: cambios, pct_cambio: conGps.length > 1 ? Math.round(cambios / (conGps.length - 1) * 100) : 0,
      max_congelado_min: Math.round(maxCong), primera: m.length ? fmt_(new Date(m[0].t), 'HH:mm') : '', ultima: m.length ? fmt_(new Date(m[m.length - 1].t), 'HH:mm') : '',
      ultima_pos: conGps.length ? [round_(conGps[conGps.length - 1].lat, 5), round_(conGps[conGps.length - 1].lng, 5)] : null, paradas: paradas };
  }).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre))) };
}

// ── Recolecciones ──

const PUNTOS_VOLUMEN = { bajo: 1, medio: 2, alto: 3 };
function normTxt_(s) { return quitarAcentos_(String(s || '')).toLowerCase(); }
const BASE_ = [19.4182, -99.1369];

function shipdayActivas_() {
  const key = prop_('SHIPDAY_KEY');
  const r = UrlFetchApp.fetch('https://api.shipday.com/orders', { muteHttpExceptions: true, headers: { Authorization: 'Basic ' + key, Accept: 'application/json' } });
  if (r.getResponseCode() !== 200) throw new Error('Shipday respondió ' + r.getResponseCode() + ' al leer órdenes activas');
  let l = []; try { l = JSON.parse(r.getContentText()); } catch (e) {}
  return Array.isArray(l) ? l : [];
}

/** Repartidores disponibles hoy: checaron entrada, no han checado salida, son repartidores y tienen cuenta de Shipday vinculada. */
function repartidoresDisponibles_() {
  const hoy = hoy_();
  const chk = checadasPorDia_(hoy, hoy);
  return rows_('Personal').filter(p => p.estatus !== 'baja' && idsShipday_(p).length && rolBienvenida_(p) === 'repartidor').map(p => {
    const marcas = (chk[String(p.no_empleado)] || {})[hoy] || [];
    const ent = marcas.find(m => m.tipo === 'ENTRADA');
    const sal = marcas.filter(m => m.tipo === 'SALIDA').pop();
    return { no_empleado: String(p.no_empleado), nombre: p.nombre, carrier_id: idsShipday_(p)[0], entrada: ent ? ent.hora : '', salio: !!sal };
  }).filter(d => d.entrada && !d.salio);
}

function clienteRec_(nombre, direccion) {
  const l = rows_('ClientesRecoleccion');
  let c = l.find(x => normTxt_(x.cliente) === normTxt_(nombre));
  if (!c) {
    append_('ClientesRecoleccion', { cliente: nombre, volumen: '', direccion: direccion || '', alta: new Date() });
    c = rows_('ClientesRecoleccion').find(x => normTxt_(x.cliente) === normTxt_(nombre));
  }
  return c;
}

function geocodificar_(direccion) {
  if (!direccion) return null;
  try {
    const g = Maps.newGeocoder().setRegion('mx').setLanguage('es').geocode(direccion + ', México');
    const r = g && g.results && g.results[0];
    return r ? [r.geometry.location.lat, r.geometry.location.lng] : null;
  } catch (e) { console.warn('geocode', e); return null; }
}

/** De una orden de Shipday saca cliente, dirección y coordenadas del lugar donde hay que recolectar. */
function puntoRecoleccion_(o) {
  const rest = o.restaurant || o.pickup || {}, cust = o.customer || o.delivery || {};
  const nombre = rest.name || o.restaurantName || cust.name || '';
  const dir = rest.address || o.restaurantAddress || cust.address || '';
  let lat = rest.latitude != null ? rest.latitude : rest.lat, lng = rest.longitude != null ? rest.longitude : rest.lng;
  return { cliente: String(nombre).trim(), direccion: String(dir).trim(), lat: lat != null ? Number(lat) : null, lng: lng != null ? Number(lng) : null };
}

function esRecoleccion_(o) {
  const t = normTxt_(config_('RECOLECCION_TEXTO', 'recoleccion'));
  const rest = o.restaurant || {};
  return normTxt_(o.orderNumber).indexOf(t) >= 0 || normTxt_(rest.name).indexOf(t) >= 0 || normTxt_(o.restaurantName).indexOf(t) >= 0;
}
function creadaHoy_(o) {
  const al = o.activityLog || {};
  const t = shipdayFecha_(al.placementTime || o.placementTime || al.createdAt || o.createdAt);
  return !t || fmt_(t, 'yyyy-MM-dd') === hoy_();
}
function sinAsignar_(o) { const id = o.assignedCarrierId != null ? o.assignedCarrierId : (o.assignedCarrier || o.carrier || {}).id; return id == null || id === '' || Number(id) <= 0; }

/** Busca recolecciones nuevas y las reparte entre los disponibles (propuesta o directo según RECOLECCION_MODO). */
function recoleccionesBuscar_(manual) {
  tabsOperacion_();
  const fecha = hoy_();
  const modo = String(config_('RECOLECCION_MODO', 'aprobacion'));
  const cap = Number(config_('RECOLECCION_CAPACIDAD', 6));
  const ya = rows_('Recolecciones').filter(r => fmt_(r.fecha, 'yyyy-MM-dd') === fecha);
  const vistos = {}; ya.forEach(r => vistos[String(r.order_id)] = 1);
  const nuevas = shipdayActivas_().filter(o => esRecoleccion_(o) && creadaHoy_(o) && sinAsignar_(o) && !vistos[String(o.orderId)]);
  const disp = repartidoresDisponibles_();
  if (!nuevas.length) return { nuevas: 0, disponibles: disp.length };
  // carga actual de cada repartidor (lo propuesto o asignado hoy)
  const carga = {};
  disp.forEach(d => carga[d.no_empleado] = { d: d, puntos: 0, pts: [] });
  ya.filter(r => ['propuesta', 'aprobada', 'asignada'].indexOf(r.estado) >= 0 && carga[String(r.no_empleado)])
    .forEach(r => { const c = carga[String(r.no_empleado)]; c.puntos += Number(r.puntos || 0); if (r.lat !== '') c.pts.push([Number(r.lat), Number(r.lng)]); });
  const items = nuevas.map(o => {
    const p = puntoRecoleccion_(o);
    const cli = clienteRec_(p.cliente || 'Sin nombre', p.direccion);
    if (p.lat == null && cli && cli.lat !== '' && cli.lat != null && normTxt_(cli.direccion) === normTxt_(p.direccion)) { p.lat = Number(cli.lat); p.lng = Number(cli.lng); }
    if (p.lat == null) { const g = geocodificar_(p.direccion); if (g) { p.lat = g[0]; p.lng = g[1]; if (cli) update_('ClientesRecoleccion', cli._row, { lat: g[0], lng: g[1], direccion: p.direccion }); } }
    const vol = String((cli && cli.volumen) || '').toLowerCase();
    return { o: o, p: p, volumen: vol, puntos: PUNTOS_VOLUMEN[vol] || PUNTOS_VOLUMEN.medio };
  });
  // costo de agregar el punto a un recorrido abierto que sale de la base (inserción más barata, distancia en línea recta)
  const costo = (pts, x) => {
    if (!x) return 0;
    const ruta = [BASE_].concat(pts);
    let best = havM_(ruta[ruta.length - 1], x);
    for (let k = 0; k < ruta.length - 1; k++) best = Math.min(best, havM_(ruta[k], x) + havM_(x, ruta[k + 1]) - havM_(ruta[k], ruta[k + 1]));
    return best;
  };
  // primero los de mayor volumen; cada uno al repartidor con menor desvío que aún tenga capacidad
  items.sort((a, b) => b.puntos - a.puntos);
  const ahora = new Date(), out = [];
  items.forEach(it => {
    const x = it.p.lat != null ? [it.p.lat, it.p.lng] : null;
    let mejor = null, mc = Infinity;
    Object.keys(carga).forEach(no => {
      const c = carga[no];
      if (c.puntos + it.puntos > cap) return;
      const v = costo(c.pts, x) + c.puntos * 400; // leve preferencia por quien lleva menos
      if (v < mc) { mc = v; mejor = c; }
    });
    let estado = 'propuesta', nota = '';
    if (!disp.length) { estado = 'sin_repartidor'; nota = 'Nadie ha checado entrada'; }
    else if (!mejor) { estado = 'sin_capacidad'; nota = 'Todos llegaron a su tope de ' + cap + ' puntos'; }
    if (!x) nota = (nota ? nota + ' · ' : '') + 'Sin ubicación: revisa la dirección';
    if (mejor) { mejor.puntos += it.puntos; if (x) mejor.pts.push(x); }
    const fila = { rec_id: nextId_('REC', 6), fecha: fecha, order_id: String(it.o.orderId), order_number: String(it.o.orderNumber || ''), cliente: it.p.cliente,
      direccion: it.p.direccion, lat: x ? x[0] : '', lng: x ? x[1] : '', volumen: it.volumen || 'sin clasificar', puntos: it.puntos,
      no_empleado: mejor ? mejor.d.no_empleado : '', nombre: mejor ? mejor.d.nombre : '', carrier_id: mejor ? mejor.d.carrier_id : '', estado: estado, creada: ahora, nota: nota };
    out.push(fila);
  });
  withLock_(() => out.forEach(f => append_('Recolecciones', f)));
  let asignadas = 0;
  if (modo === 'automatico') out.filter(f => f.estado === 'propuesta').forEach(f => { const r = rows_('Recolecciones').find(x => x.rec_id === f.rec_id); if (asignarRec_(r, null).ok) asignadas++; });
  const prop = out.filter(f => f.estado === 'propuesta').length, prob = out.length - prop;
  notificarOps_('recolecciones', modo === 'automatico' ? '📦 ' + asignadas + ' recolección(es) asignadas' : '📦 ' + prop + ' recolección(es) por aprobar',
    (prob ? '⚠️ ' + prob + ' sin repartidor o sin capacidad · ' : '') + 'Revisa en Más → Recolecciones', fecha);
  return { nuevas: out.length, propuestas: prop, problemas: prob, asignadas: asignadas, disponibles: disp.length };
}

function asignarRec_(r, u) {
  if (!r.carrier_id) return { ok: false, error: 'Sin repartidor' };
  const key = prop_('SHIPDAY_KEY');
  const res = UrlFetchApp.fetch('https://api.shipday.com/orders/assign/' + encodeURIComponent(r.order_id) + '/' + encodeURIComponent(r.carrier_id),
    { method: 'put', muteHttpExceptions: true, headers: { Authorization: 'Basic ' + key, Accept: 'application/json' } });
  const ok = res.getResponseCode() >= 200 && res.getResponseCode() < 300;
  update_('Recolecciones', r._row, ok ? { estado: 'asignada', resuelta: new Date(), resuelta_por: u ? u.no_empleado : 'auto' }
    : { estado: 'error', nota: 'Shipday ' + res.getResponseCode() + ': ' + String(res.getContentText()).slice(0, 120) });
  if (ok && r.no_empleado) notificar_(String(r.no_empleado), 'recoleccion', '📦 Nueva recolección: ' + r.cliente, (r.direccion || '') + ' · ya está en tu app de Shipday', r.rec_id);
  return { ok: ok, error: ok ? '' : 'Shipday respondió ' + res.getResponseCode() };
}

function recoleccionAprobar_(req, u) {
  const ids = req.todas ? rows_('Recolecciones').filter(r => fmt_(r.fecha, 'yyyy-MM-dd') === hoy_() && r.estado === 'propuesta').map(r => r.rec_id) : [req.rec_id];
  let ok = 0; const errores = [];
  ids.forEach(id => { const r = rows_('Recolecciones').find(x => x.rec_id === id); if (!r) return; const x = asignarRec_(r, u); if (x.ok) ok++; else errores.push(r.cliente + ': ' + x.error); });
  bitacora_(u.no_empleado, 'aprobar_recolecciones', 'Recolecciones', ids.join(','), ok + ' ok');
  return { asignadas: ok, errores: errores };
}
function recoleccionCambiar_(req, u) {
  const r = rows_('Recolecciones').find(x => x.rec_id === req.rec_id);
  if (!r) throw new Error('Recolección no encontrada');
  if (r.estado === 'asignada') throw new Error('Ya está asignada en Shipday; cámbiala desde Shipday');
  const p = req.no_empleado ? rows_('Personal').find(x => String(x.no_empleado) === String(req.no_empleado)) : null;
  if (req.no_empleado && (!p || !idsShipday_(p).length)) throw new Error('Ese empleado no tiene cuenta de Shipday vinculada');
  update_('Recolecciones', r._row, { no_empleado: p ? String(p.no_empleado) : '', nombre: p ? p.nombre : '', carrier_id: p ? idsShipday_(p)[0] : '', estado: p ? 'propuesta' : 'sin_repartidor', nota: 'Cambiada a mano' });
  return true;
}
function recoleccionRechazar_(req, u) {
  const r = rows_('Recolecciones').find(x => x.rec_id === req.rec_id);
  if (!r) throw new Error('Recolección no encontrada');
  update_('Recolecciones', r._row, { estado: 'descartada', resuelta: new Date(), resuelta_por: u.no_empleado });
  return true;
}
function clienteVolumen_(req, u) {
  tabsOperacion_();
  const v = String(req.volumen || '').toLowerCase();
  if (!PUNTOS_VOLUMEN[v]) throw new Error('Volumen inválido');
  const c = clienteRec_(req.cliente, '');
  update_('ClientesRecoleccion', c._row, { volumen: v });
  // actualiza las propuestas de hoy de ese cliente
  rows_('Recolecciones').filter(r => fmt_(r.fecha, 'yyyy-MM-dd') === hoy_() && normTxt_(r.cliente) === normTxt_(req.cliente) && r.estado !== 'asignada')
    .forEach(r => update_('Recolecciones', r._row, { volumen: v, puntos: PUNTOS_VOLUMEN[v] }));
  return true;
}

function recoleccionesVista_(fecha) {
  tabsOperacion_();
  asegurarTriggerReporte_();
  const recs = rows_('Recolecciones').filter(r => fmt_(r.fecha, 'yyyy-MM-dd') === fecha).map(r => ({ rec_id: r.rec_id, order_number: r.order_number, cliente: r.cliente,
    direccion: r.direccion, lat: r.lat === '' ? null : Number(r.lat), lng: r.lng === '' ? null : Number(r.lng), volumen: r.volumen, puntos: Number(r.puntos || 0),
    no_empleado: String(r.no_empleado || ''), nombre: r.nombre, estado: r.estado, nota: r.nota, creada: fmt_(r.creada, 'HH:mm') }));
  const disp = fecha === hoy_() ? repartidoresDisponibles_() : [];
  return { fecha: fecha, modo: String(config_('RECOLECCION_MODO', 'aprobacion')), hasta: String(config_('RECOLECCION_HASTA', '12:00')),
    capacidad: Number(config_('RECOLECCION_CAPACIDAD', 6)), recolecciones: recs, disponibles: disp.map(d => Object.assign(d, {
      puntos: recs.filter(r => r.no_empleado === d.no_empleado && ['propuesta', 'asignada'].indexOf(r.estado) >= 0).reduce((s, r) => s + r.puntos, 0) })),
    clientes: rows_('ClientesRecoleccion').map(c => ({ cliente: c.cliente, volumen: c.volumen || '' })).sort((a, b) => (!!a.volumen - !!b.volumen) || String(a.cliente).localeCompare(String(b.cliente))),
    shipday: !!prop_('SHIPDAY_KEY') };
}

// ── Altitudes para detectar cerros (respaldo cuando el navegador no puede consultar Open-Meteo) ──
function elevaciones_(req) {
  const pts = (req.puntos || []).slice(0, 3000);
  const out = new Array(pts.length).fill(null);
  for (let i = 0; i < pts.length; i += 100) {
    const lote = pts.slice(i, i + 100);
    let ok = false;
    try {
      const r = UrlFetchApp.fetch('https://api.open-meteo.com/v1/elevation?latitude=' + lote.map(p => Number(p[0]).toFixed(4)).join(',') + '&longitude=' + lote.map(p => Number(p[1]).toFixed(4)).join(','), { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) { const j = JSON.parse(r.getContentText()); (j.elevation || []).forEach((e, k) => out[i + k] = e); ok = true; }
    } catch (e) {}
    if (!ok) {
      try {
        const r = UrlFetchApp.fetch('https://api.opentopodata.org/v1/srtm90m?locations=' + lote.map(p => Number(p[0]).toFixed(4) + ',' + Number(p[1]).toFixed(4)).join('|'), { muteHttpExceptions: true });
        if (r.getResponseCode() === 200) JSON.parse(r.getContentText()).results.forEach((x, k) => out[i + k] = x.elevation);
      } catch (e) {}
      Utilities.sleep(1100);
    }
  }
  return { elevaciones: out };
}

// ── Motos chicas: qué paradas se pueden hacer sin autopistas ──

/** Para cada punto compara el tiempo desde la base con y sin autopistas (TomTom). Se guarda en AlcanceMoto 30 días. */
function alcanceMotoChica_(req) {
  tabsOperacion_();
  const key = prop_('TOMTOM_KEY');
  if (!key) throw new Error('Para revisar autopistas hace falta la key de TomTom');
  const dep = req.deposito || BASE_;
  const ratio = Number(req.ratio || 1.4), extra = Number(req.extra_min || 12);
  const cache = {}; const lim = Date.now() - 30 * 864e5;
  rows_('AlcanceMoto').forEach(r => { if (new Date(r.fecha).getTime() > lim) cache[r.clave] = r; });
  const out = [], pend = [];
  (req.puntos || []).forEach((p, i) => {
    const clave = Number(p[0]).toFixed(4) + ',' + Number(p[1]).toFixed(4);
    const c = cache[clave];
    if (c) out[i] = { ok: c.chica_ok === 'SI', motivo: c.motivo, min_normal: Number(c.min_normal), min_sin: Number(c.min_sin_autopista) };
    else pend.push({ i: i, p: p, clave: clave });
  });
  const base = 'https://api.tomtom.com/routing/1/calculateRoute/';
  const nuevos = [];
  for (let b = 0; b < pend.length; b += 3) {
    const lote = pend.slice(b, b + 3), reqs = [];
    lote.forEach(x => {
      const loc = Number(dep[0]).toFixed(6) + ',' + Number(dep[1]).toFixed(6) + ':' + Number(x.p[0]).toFixed(6) + ',' + Number(x.p[1]).toFixed(6);
      reqs.push({ url: base + loc + '/json?key=' + encodeURIComponent(key) + '&travelMode=motorcycle&traffic=false&routeRepresentation=summaryOnly', muteHttpExceptions: true });
      reqs.push({ url: base + loc + '/json?key=' + encodeURIComponent(key) + '&travelMode=motorcycle&traffic=false&routeRepresentation=summaryOnly&avoid=motorways&avoid=tollRoads&sectionType=motorway', muteHttpExceptions: true });
    });
    const rr = UrlFetchApp.fetchAll(reqs);
    lote.forEach((x, k) => {
      const a = rr[2 * k], s = rr[2 * k + 1];
      let n = null, m = null, sigue = false;
      try { n = JSON.parse(a.getContentText()).routes[0].summary.travelTimeInSeconds / 60; } catch (e) {}
      try { const js = JSON.parse(s.getContentText()); m = js.routes[0].summary.travelTimeInSeconds / 60; sigue = (js.routes[0].sections || []).some(z => /MOTORWAY/i.test(z.sectionType)); } catch (e) {}
      if (n == null || m == null) { out[x.i] = { ok: true, motivo: 'sin_dato', min_normal: n, min_sin: m }; return; }
      const malo = sigue || (m > n * ratio && m - n > extra);
      const r = { ok: !malo, motivo: sigue ? 'solo_por_autopista' : malo ? 'rodeo_sin_autopista' : '', min_normal: Math.round(n), min_sin: Math.round(m) };
      out[x.i] = r;
      nuevos.push({ clave: x.clave, lat: x.p[0], lng: x.p[1], chica_ok: r.ok ? 'SI' : 'NO', motivo: r.motivo, min_normal: r.min_normal, min_sin_autopista: r.min_sin, fecha: new Date() });
    });
    if (b + 3 < pend.length) Utilities.sleep(700);
  }
  if (nuevos.length) withLock_(() => nuevos.forEach(n => append_('AlcanceMoto', n)));
  return { puntos: out, consultas: pend.length * 2 };
}

// ── Shipday

function shipdayGet_(nums) {
  const key = prop_('SHIPDAY_KEY');
  if (!key) throw new Error('Falta la key de Shipday. Guárdala en el ruteador → Claves.');
  const pref = String(config_('SHIPDAY_PREFIJO', 'ML-'));
  const out = {};
  for (let b = 0; b < nums.length; b += 20) {
    const lote = nums.slice(b, b + 20);
    const rr = UrlFetchApp.fetchAll(lote.map(n => ({ url: 'https://api.shipday.com/orders/' + encodeURIComponent(pref + n), muteHttpExceptions: true,
      headers: { Authorization: 'Basic ' + key, Accept: 'application/json' } })));
    rr.forEach((r, k) => {
      let js = null; try { js = JSON.parse(r.getContentText()); } catch (e) {}
      out[lote[k]] = r.getResponseCode() === 200 ? js : null;
      if (r.getResponseCode() === 401 || r.getResponseCode() === 403) throw new Error('Shipday rechazó la key (' + r.getResponseCode() + ')');
    });
    if (b + 20 < nums.length) Utilities.sleep(800);
  }
  return out;
}

/** Hora de una orden de Shipday → Date. Acepta ISO con zona, epoch o 'yyyy-MM-dd HH:mm:ss'. */
function shipdayFecha_(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return new Date(v);
  const s = String(v).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) { const d = new Date(s); return isNaN(d) ? null : d; }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d; }
  const utc = String(config_('SHIPDAY_HORA_UTC', 'SI')).toUpperCase() !== 'NO';
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) + (utc ? 0 : 6 * 3600e3));
}

/** De la respuesta de Shipday saca estado, hora de entrega y repartidor. */
function shipdayInfo_(js) {
  if (!js) return { encontrado: false };
  const l = Array.isArray(js) ? js.slice() : [js];
  if (!l.length) return { encontrado: false };
  l.sort((a, b) => Number(b.orderId || 0) - Number(a.orderId || 0));
  const o = l[0];
  const al = o.activityLog || {};
  const st = String((o.orderStatus && (o.orderStatus.orderState || o.orderStatus.status)) || o.status || o.orderState || '');
  const entrega = shipdayFecha_(al.deliveryTime || o.deliveryTime);
  const fallo = shipdayFecha_(al.failedDeliveryTime || o.failedDeliveryTime);
  const car = o.assignedCarrier || o.carrier || {};
  return { encontrado: true, estado: st, entregado: !!entrega && !/FAIL|INCOMPLETE/i.test(st), fallido: /FAIL/i.test(st) || !!fallo,
    entrega: entrega, repartidor: car.name || car.carrierName || '', repartidor_id: car.id || o.assignedCarrierId || '' };
}

function shipdayMuestra_(req) {
  const n = String(req.shipment || '').replace(/^ML-/i, '').trim();
  if (!n) throw new Error('Escribe un número de shipment');
  const r = shipdayGet_([n]);
  return { info: shipdayInfo_(r[n]), crudo: JSON.stringify(r[n]).slice(0, 6000) };
}

/** Subsecuencia creciente más larga: cuántas paradas se entregaron en el orden planeado. */
function lis_(a) {
  const t = [];
  a.forEach(x => { let lo = 0, hi = t.length; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < x) lo = m + 1; else hi = m; } t[lo] = x; });
  return t.length;
}
function mismoNombre_(a, b) {
  const tk = s => quitarAcentos_(String(s || '').toLowerCase()).split(/\s+/).filter(w => w.length > 2);
  const A = tk(a), B = tk(b);
  if (!A.length || !B.length) return true;
  return A.filter(w => B.indexOf(w) >= 0).length >= Math.min(2, A.length, B.length);
}

/** Compara lo planeado contra lo que registró Shipday y guarda una fila por ruta en ReporteRutas. */
function reporteRutas_(fecha, automatico) {
  rutasTabs_();
  const rutas = rows_('Rutas').filter(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa').map(x => pickRuta_(x, true));
  if (!rutas.length) return { fecha: fecha, rutas: 0, reporte: [] };
  const nums = unicos_([].concat.apply([], rutas.map(r => [].concat.apply([], (r.paradas || []).map(p => (p.envios || []).map(String))))));
  const sd = shipdayGet_(nums);
  const tol = Number(config_('RUTA_TOLERANCIA_MIN', 20));
  const generado = new Date();
  const filas = rutas.map(r => {
    const det = (r.paradas || []).map((p, i) => {
      const infos = (p.envios || []).map(n => Object.assign({ envio: String(n) }, shipdayInfo_(sd[String(n)])));
      const ent = infos.filter(x => x.entregado && x.entrega);
      const t = ent.length ? new Date(Math.min.apply(null, ent.map(x => x.entrega.getTime()))) : null;
      const eta = p.eta ? new Date(fecha + 'T' + p.eta + ':00-06:00') : null;
      const dif = t && eta ? Math.round((t - eta) / 60000) : null;
      return { o: i + 1, eta: p.eta || '', real: t ? fmt_(t, 'HH:mm') : '', t: t, dif: dif, envios: infos.length, entregados: ent.length,
        estado: ent.length === infos.length ? 'entregado' : ent.length ? 'parcial' : infos.some(x => x.fallido) ? 'fallido' : infos.some(x => !x.encontrado) ? 'no_en_shipday' : 'pendiente',
        repartidores: unicos_(infos.map(x => x.repartidor).filter(String)), ids: infos.map(x => ({ id: String(x.repartidor_id || ''), n: x.repartidor || '' })).filter(x => x.id || x.n) };
    });
    const hechas = det.filter(d => d.t).sort((a, b) => a.t - b.t);
    const enOrden = lis_(hechas.map(d => d.o));
    const tarde = hechas.filter(d => d.dif != null && d.dif > tol).length;
    const retraso = hechas.length ? round_(hechas.reduce((s, d) => s + Math.max(0, d.dif || 0), 0) / hechas.length, 0) : 0;
    const envios = det.reduce((s, d) => s + d.envios, 0), entregados = det.reduce((s, d) => s + d.entregados, 0);
    const sdIds = idsShipday_(rows_('Personal').find(p => String(p.no_empleado) === String(r.no_empleado)));
    const quien = [].concat.apply([], det.map(d => d.ids));
    // Con el ID de Shipday vinculado se compara por ID; sin vincular no se puede saber con certeza y se avisa.
    const otros = sdIds.length ? unicos_(quien.filter(x => x.id && sdIds.indexOf(x.id) < 0).map(x => x.n || ('ID ' + x.id)))
      : quien.length ? ['(sin vincular en Shipday: ' + unicos_(quien.map(x => x.n || x.id)).join(', ') + ')'] : [];
    const pct = hechas.length ? round_(enOrden / hechas.length * 100, 0) : 0;
    const pctTarde = hechas.length ? tarde / hechas.length : 0;
    const noEnt = envios - entregados;
    const cal = !hechas.length ? 'Sin datos' : (pct >= 85 && pctTarde <= 0.1 && noEnt === 0) ? 'Bien' : (pct >= 65 && pctTarde <= 0.3 && noEnt <= Math.max(1, envios * 0.1)) ? 'Regular' : 'Mal';
    const fila = { fecha: fecha, ruta_id: r.ruta_id, no_empleado: r.no_empleado, nombre: r.nombre, envios: envios, entregados: entregados,
      no_entregados: noEnt, en_orden: enOrden, fuera_orden: hechas.length - enOrden, pct_orden: pct, tarde: tarde, retraso_prom: retraso,
      fin_plan: r.fin, fin_real: hechas.length ? hechas[hechas.length - 1].real : '', otros_repartidores: otros.join(', '), calificacion: cal,
      detalle_json: JSON.stringify(det.map(d => ({ o: d.o, eta: d.eta, real: d.real, dif: d.dif, estado: d.estado, envios: d.envios, entregados: d.entregados, repartidores: d.repartidores }))).slice(0, 45000),
      generado: generado };
    return fila;
  });
  withLock_(() => filas.forEach(f => append_('ReporteRutas', f)));
  const rep = filas.map(f => pickReporte_(Object.assign({}, f)));
  if (automatico) enviarReporteRutas_(fecha, rep);
  return { fecha: fecha, rutas: rutas.length, reporte: rep };
}

/** Cada hora revisa si ya toca el reporte del día (RUTA_REPORTE_HORA) y lo manda una sola vez. */
function tareaReporteRutas() {
  if (prop_('SHIPDAY_KEY')) { try { tareaHistorial_(); } catch (e) { console.warn('historial', e); } }
  if (!ss_().getSheetByName('Rutas') || !prop_('SHIPDAY_KEY')) return;
  const hora = Number(fmt_(new Date(), 'HH'));
  if (hora < Number(config_('RUTA_REPORTE_HORA', 23))) return;
  const fecha = hoy_();
  const pk = 'REPORTE_RUTAS_' + fecha;
  if (prop_(pk)) return;
  if (!rows_('Rutas').some(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa')) return;
  reporteRutas_(fecha, true);
  setProp_(pk, '1');
}

function enviarReporteRutas_(fecha, rep) {
  const bien = rep.filter(r => r.calificacion === 'Bien').length, mal = rep.filter(r => r.calificacion === 'Mal').length;
  const resumen = rep.length + ' rutas · ' + bien + ' bien · ' + (rep.length - bien - mal) + ' regular · ' + mal + ' mal';
  rows_('Personal').filter(p => (p.rol === 'patron' || p.rol === 'admin') && p.estatus !== 'baja').forEach(p => notificar_(String(p.no_empleado), 'reporte_rutas', '🗺️ Reporte de rutas ' + fecha, resumen, fecha));
  const to = String(config_('CORREOS_ADMIN', '')).split(',').map(s => s.trim()).filter(String).join(',');
  if (!to) return;
  const color = { Bien: '#16834a', Regular: '#a85d00', Mal: '#c42020' };
  const filas = rep.map(r => '<tr><td>' + r.nombre + '</td><td>' + r.entregados + '/' + r.envios + '</td><td>' + r.pct_orden + '%' + (r.fuera_orden ? ' (' + r.fuera_orden + ' fuera)' : '') +
    '</td><td>' + r.tarde + '</td><td>' + r.fin_plan + ' / ' + (r.fin_real || '—') + '</td><td>' + (r.otros_repartidores || '') + '</td><td style="color:' + (color[r.calificacion] || '#555') + ';font-weight:700">' + r.calificacion + '</td></tr>').join('');
  const html = '<h2 style="font-family:Arial">Reporte de rutas · ' + fecha + '</h2><p style="font-family:Arial">' + resumen + '. Tolerancia: ' + config_('RUTA_TOLERANCIA_MIN', 20) + ' min.</p>' +
    '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:13px"><tr style="background:#1f3a5f;color:#fff"><th>Repartidor</th><th>Entregados</th><th>En orden</th><th>Tarde</th><th>Fin plan / real</th><th>Entregó otro</th><th>Resultado</th></tr>' + filas + '</table>' +
    '<p style="font-family:Arial;font-size:12px;color:#666">Detalle por parada en el portal → Más → Rutas y reporte.</p>';
  try { MailApp.sendEmail(to, 'Reporte de rutas ' + fecha + ' · ' + resumen, resumen, { htmlBody: html }); } catch (e) { console.error('mail', e); }
}

// ───────────────────────── Mis datos: domicilio y contactos de emergencia ─────────────────────────

/** Zona válida para el pin (CDMX, Edo. Méx. y estados vecinos). */
const BBOX_CASA_ = { s: 18.3, n: 20.7, o: -100.7, e: -97.7 };
function personalCols_() { if (SCHEMA.Personal.some(c => headers_('Personal').indexOf(c) < 0)) ensureTab_('Personal', SCHEMA.Personal); }
function telMx_(t) {
  let d = String(t || '').replace(/\D/g, '');
  if (d.length === 13 && d.indexOf('521') === 0) d = d.slice(3);
  if (d.length === 12 && d.indexOf('52') === 0) d = d.slice(2);
  return d;
}
function domicilioDe_(p) {
  let j = {}; try { j = JSON.parse(p.dom_json || '{}'); } catch (e) {}
  const ok = v => v !== '' && v != null && isFinite(Number(v)) && Number(v) !== 0;
  return { texto: String(p.domicilio || ''), calle: j.calle || '', colonia: j.colonia || '', cp: j.cp || '', municipio: j.municipio || '', estado: j.estado || '',
    referencias: j.referencias || '', lat: ok(p.dom_lat) ? Number(p.dom_lat) : null, lng: ok(p.dom_lng) ? Number(p.dom_lng) : null,
    dist_m: j.dist_m === '' || j.dist_m == null ? null : Number(j.dist_m), fecha: fmt_(p.dom_fecha, 'yyyy-MM-dd') };
}
function contactosDe_(p) {
  return [1, 2].map(i => ({ nombre: String(p['emer' + i + '_nombre'] || ''), telefono: String(p['emer' + i + '_tel'] || ''), parentesco: String(p['emer' + i + '_parentesco'] || '') }));
}
function datosCompletos_(p) {
  const d = domicilioDe_(p);
  return { domicilio: !!(d.texto && d.lat != null), contactos: contactosDe_(p).every(c => c.nombre && c.telefono && c.parentesco) };
}

/** Guarda domicilio (con pin) y/o los 2 contactos de emergencia. Valida todo antes de escribir. */
function guardarDatos_(no, req, u) {
  return withLock_(() => {
    personalCols_();
    const p = persona_(no);
    const upd = {};
    if (req.domicilio) {
      const d = req.domicilio;
      const t = k => String(d[k] == null ? '' : d[k]).trim().replace(/\s+/g, ' ');
      const calle = t('calle'), colonia = t('colonia'), cp = t('cp').replace(/\D/g, ''), mun = t('municipio'), edo = t('estado'), refs = t('referencias').slice(0, 300);
      if (calle.length < 4) throw new Error('Escribe tu calle y número');
      if (!/\d/.test(calle) && !/s\/?n\b|sin n[uú]m|mz|manzana|lote|\blt\b/i.test(calle)) throw new Error('Falta el número exterior (si no tiene, escribe S/N o manzana y lote)');
      if (colonia.length < 3) throw new Error('Falta la colonia');
      if (!/^\d{5}$/.test(cp)) throw new Error('El código postal debe tener 5 dígitos');
      if (mun.length < 3) throw new Error('Falta la alcaldía o municipio');
      if (!edo) throw new Error('Falta el estado');
      const ncp = Number(cp);
      if (/ciudad de m|cdmx/i.test(edo) && !(ncp >= 1000 && ncp <= 16999)) throw new Error('Ese código postal no es de la Ciudad de México (van del 01000 al 16999)');
      if (/^estado de m/i.test(edo) && !(ncp >= 50000 && ncp <= 57999)) throw new Error('Ese código postal no es del Estado de México (van del 50000 al 57999)');
      const lat = Number(d.lat), lng = Number(d.lng);
      if (!isFinite(lat) || !isFinite(lng) || !lat || !lng) throw new Error('Coloca el pin de tu casa en el mapa');
      if (lat < BBOX_CASA_.s || lat > BBOX_CASA_.n || lng < BBOX_CASA_.o || lng > BBOX_CASA_.e) throw new Error('El pin quedó muy lejos de la Ciudad de México; acomódalo en tu casa');
      upd.domicilio = calle + ', Col. ' + colonia + ', ' + mun + ', ' + edo + ', CP ' + cp;
      upd.dom_json = JSON.stringify({ calle: calle, colonia: colonia, cp: cp, municipio: mun, estado: edo, referencias: refs,
        dist_m: isFinite(Number(d.dist_m)) && d.dist_m !== '' && d.dist_m != null ? Math.round(Number(d.dist_m)) : '' });
      upd.dom_lat = round_(lat, 6); upd.dom_lng = round_(lng, 6); upd.dom_fecha = new Date();
    }
    if (req.contactos) {
      const propio = telMx_(p.telefono);
      const cs = (req.contactos || []).slice(0, 2).map((c, i) => {
        const n = 'Contacto ' + (i + 1) + ': ';
        const nombre = String(c.nombre || '').trim().replace(/\s+/g, ' '), tel = telMx_(c.telefono), par = String(c.parentesco || '').trim();
        if (nombre.length < 5 || nombre.split(' ').length < 2) throw new Error(n + 'escribe nombre y apellido');
        if (!/^\d{10}$/.test(tel)) throw new Error(n + 'el teléfono debe tener 10 dígitos');
        if (/^(\d)\1{9}$/.test(tel) || tel === '1234567890' || tel === '0123456789') throw new Error(n + 'ese teléfono no parece real');
        if (propio && tel === propio) throw new Error(n + 'no puede ser tu propio número');
        if (par.length < 3) throw new Error(n + 'elige el parentesco');
        return { nombre: nombre, tel: tel, par: par.slice(0, 40) };
      });
      if (cs.length < 2) throw new Error('Necesitamos 2 contactos de emergencia');
      if (cs[0].tel === cs[1].tel) throw new Error('Los dos contactos tienen el mismo teléfono; pon a dos personas distintas');
      cs.forEach((c, i) => { upd['emer' + (i + 1) + '_nombre'] = c.nombre; upd['emer' + (i + 1) + '_tel'] = c.tel; upd['emer' + (i + 1) + '_parentesco'] = c.par; });
    }
    if (!Object.keys(upd).length) throw new Error('Nada que guardar');
    update_('Personal', p._row, upd);
    bitacora_(u.no_empleado, 'guardar_datos', 'Personal', String(no), (req.domicilio ? 'domicilio ' : '') + (req.contactos ? 'contactos' : ''));
    return perfil_(no);
  });
}

/** Directorio para emergencias (admins y patrón): teléfono del empleado, sus 2 contactos y su domicilio. */
function emergencias_() {
  return rows_('Personal').filter(p => p.estatus !== 'baja').map(p => ({ no_empleado: String(p.no_empleado), nombre: p.nombre, puesto: p.puesto || '',
    telefono: String(p.telefono || ''), contactos: contactosDe_(p), domicilio: domicilioDe_(p) }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
}

// ───────────────────────── Historial de entregas y jerarquía de repartidores ─────────────────────────

function isoUtc_(d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }

/** Shipday POST /orders/query (por hora de creación, paginado). Devuelve las órdenes sin repetir. */
function shipdayQuery_(desde, hasta, estado) {
  const key = prop_('SHIPDAY_KEY');
  if (!key) throw new Error('Falta la key de Shipday. Guárdala en el ruteador → Claves del servidor.');
  const out = [], vistos = {}, PAG = 100;
  for (let c = 1; c < 30000; c += PAG) {
    const r = UrlFetchApp.fetch('https://api.shipday.com/orders/query', { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Basic ' + key, Accept: 'application/json' },
      payload: JSON.stringify({ startTime: isoUtc_(desde), endTime: isoUtc_(hasta), orderStatus: estado, startCursor: c, endCursor: c + PAG - 1 }) });
    const code = r.getResponseCode();
    if (code === 401 || code === 403) throw new Error('Shipday rechazó la key (' + code + ')');
    if (code !== 200) throw new Error('Shipday respondió ' + code + ' al consultar el historial (' + estado + ')');
    let l = []; try { l = JSON.parse(r.getContentText()); } catch (e) {}
    if (!Array.isArray(l) || !l.length) break;
    let nuevos = 0;
    l.forEach(o => { const id = String(o.orderId || o.id || ''); if (id && vistos[id]) return; if (id) vistos[id] = 1; out.push(o); nuevos++; });
    if (l.length < PAG || !nuevos) break;
    Utilities.sleep(250);
  }
  return out;
}

/**
 * Recalcula HistorialEntregas para [desde, hasta] (máx. 31 días): por repartidor y día, envíos entregados,
 * fallidos e incompletos en Shipday (sin recolecciones). Las órdenes se cuentan el día en que se entregaron o fallaron.
 */
function historialCalcular_(desde, hasta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || hasta < desde) throw new Error('Rango de fechas inválido');
  if (addDias_(desde, 31) <= hasta) throw new Error('Máximo 31 días por vez');
  if (!ss_().getSheetByName('HistorialEntregas') || SCHEMA.HistorialEntregas.some(c => headers_('HistorialEntregas').indexOf(c) < 0)) ensureTab_('HistorialEntregas', SCHEMA.HistorialEntregas);
  const ini = new Date(desde + 'T00:00:00-06:00'), fin = new Date(hasta + 'T23:59:59-06:00');
  const qIni = new Date(ini.getTime() - 3 * 86400000), qFin = new Date(Math.min(fin.getTime(), Date.now() + 60000));
  const per = rows_('Personal');
  const agg = {}, vistos = {};
  let leidas = 0;
  [['ALREADY_DELIVERED', 'entregados'], ['FAILED_DELIVERY', 'fallidos'], ['INCOMPLETE', 'incompletos']].forEach(([st, campo]) => {
    shipdayQuery_(qIni, qFin, st).forEach(o => {
      leidas++;
      if (esRecoleccion_(o)) return;
      const id = String(o.orderId || o.id || '');
      if (id && vistos[id]) return;
      const al = o.activityLog || {};
      const t = st === 'ALREADY_DELIVERED' ? shipdayFecha_(al.deliveryTime || o.deliveryTime)
        : shipdayFecha_(al.failedDeliveryTime || o.failedDeliveryTime || al.arrivedTime || al.pickedUpTime || al.startTime || al.assignedTime || al.placementTime || o.placementTime);
      if (!t) return;
      const f = fmt_(t, 'yyyy-MM-dd');
      if (f < desde || f > hasta) return;
      const car = o.assignedCarrier || o.carrier || {};
      const cid = String(car.id || o.assignedCarrierId || '');
      if (!cid || Number(cid) <= 0) return;
      if (id) vistos[id] = 1;
      const e = empleadoDeCarrier_(cid, per);
      const k = f + '|' + (e ? 'E' + e.no_empleado : 'C' + cid);
      const a = agg[k] = agg[k] || { fecha: f, no_empleado: e ? String(e.no_empleado) : '', nombre: e ? e.nombre : (car.name || 'Shipday ' + cid), carriers: {}, entregados: 0, fallidos: 0, incompletos: 0 };
      a.carriers[cid] = 1;
      a[campo]++;
    });
  });
  const ahora = new Date();
  const nuevas = Object.keys(agg).map(k => agg[k]).map(a => {
    const total = a.entregados + a.fallidos + a.incompletos;
    return { fecha: a.fecha, no_empleado: a.no_empleado, nombre: a.nombre, carrier_ids: Object.keys(a.carriers).join(', '), entregados: a.entregados,
      fallidos: a.fallidos, incompletos: a.incompletos, total: total, pct: total ? round_(a.entregados / total * 100, 1) : 0, actualizado: ahora };
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.nombre).localeCompare(String(b.nombre)));
  withLock_(() => {
    const sh = sheet_('HistorialEntregas'), h = headers_('HistorialEntregas');
    const quedan = rows_('HistorialEntregas').filter(r => { const f = fmt_(r.fecha, 'yyyy-MM-dd'); return f < desde || f > hasta; });
    const todas = quedan.concat(nuevas).sort((a, b) => fmt_(a.fecha, 'yyyy-MM-dd').localeCompare(fmt_(b.fecha, 'yyyy-MM-dd')));
    const last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, h.length).clearContent();
    if (todas.length) sh.getRange(2, 1, todas.length, h.length).setValues(todas.map(r => h.map(c => c === 'fecha' ? fmt_(r.fecha, 'yyyy-MM-dd') : (r[c] === undefined ? '' : r[c]))));
    delete _cache['r:HistorialEntregas'];
  });
  return { desde: desde, hasta: hasta, filas: nuevas.length, ordenes: leidas,
    entregados: nuevas.reduce((s, r) => s + r.entregados, 0), sin_vincular: nuevas.filter(r => !r.no_empleado).length };
}

/** Ejecutar desde el editor: llena los últimos 30 días del historial en tramos de 5 días (si se acaba el tiempo, vuelve a ejecutarla y sigue). */
function historialInicial() {
  const t0 = Date.now(), hoy = hoy_();
  let desde = prop_('HIST_INICIAL_DESDE') || addDias_(hoy, -30);
  while (desde <= hoy && Date.now() - t0 < 4.5 * 60000) {
    const hasta = addDias_(desde, 4) < hoy ? addDias_(desde, 4) : hoy;
    const r = historialCalcular_(desde, hasta);
    console.log(desde + ' → ' + hasta + ': ' + r.entregados + ' entregas, ' + r.filas + ' filas, ' + r.ordenes + ' órdenes leídas, ' + r.sin_vincular + ' sin vincular');
    desde = addDias_(hasta, 1);
    setProp_('HIST_INICIAL_DESDE', desde);
  }
  if (desde > hoy) { setProp_('HIST_INICIAL_DESDE', ''); console.log('Historial completo.'); } else console.log('Falta desde ' + desde + ': vuelve a ejecutar historialInicial.');
}

/** Cada hora (desde tareaReporteRutas): a las 23 h guarda ayer y hoy; en la mañana vuelve a cerrar ayer (entregas tardías). */
function tareaHistorial_() {
  const h = Number(fmt_(new Date(), 'HH')), hoy = hoy_(), ayer = addDias_(hoy, -1);
  if (h >= Number(config_('RUTA_REPORTE_HORA', 23))) { if (!prop_('HIST_' + hoy)) { historialCalcular_(ayer, hoy); setProp_('HIST_' + hoy, '1'); } }
  else if (h >= 6 && !prop_('HIST_AM_' + hoy)) { historialCalcular_(ayer, ayer); setProp_('HIST_AM_' + hoy, '1'); }
}

function historialFilas_() {
  if (!ss_().getSheetByName('HistorialEntregas')) return [];
  return rows_('HistorialEntregas').map(r => ({ fecha: fmt_(r.fecha, 'yyyy-MM-dd'), no: String(r.no_empleado || ''), nombre: r.nombre, cid: String(r.carrier_ids || ''),
    ent: Number(r.entregados || 0), fal: Number(r.fallidos || 0), inc: Number(r.incompletos || 0), act: fmt_(r.actualizado, 'yyyy-MM-dd HH:mm') }));
}
function sumaHist_(l) {
  const s = l.reduce((a, r) => ({ ent: a.ent + r.ent, fal: a.fal + r.fal + r.inc, dias: a.dias + (r.ent + r.fal + r.inc ? 1 : 0) }), { ent: 0, fal: 0, dias: 0 });
  s.total = s.ent + s.fal; s.pct = s.total ? round_(s.ent / s.total * 100, 1) : null;
  s.prom_dia = s.dias ? round_(s.ent / s.dias, 1) : 0;
  return s;
}
function semanaDe_(f) { const l = addDias_(f, -((diaSemana_(f) + 6) % 7)); return [l, addDias_(l, 6)]; }
function mesDe_(f) { const ini = f.slice(0, 8) + '01'; const sig = addDias_(ini, 32).slice(0, 8) + '01'; return [ini, addDias_(sig, -1)]; }

/**
 * Jerarquía: últimos JERARQUIA_DIAS días. score = peso × % de éxito (suavizado para pocos envíos) + (1 − peso) × volumen relativo al que más entregó.
 */
function jerarquia_(fechaRef) {
  const dias = Math.max(7, Number(config_('JERARQUIA_DIAS', 30))), w = Math.min(1, Math.max(0, Number(config_('JERARQUIA_PESO_EXITO', 0.6))));
  const hasta = fechaRef || hoy_(), desde = addDias_(hasta, -dias + 1);
  const por = {};
  historialFilas_().filter(r => r.no && r.fecha >= desde && r.fecha <= hasta).forEach(r => (por[r.no] = por[r.no] || []).push(r));
  const sums = Object.keys(por).map(no => Object.assign({ no_empleado: no }, sumaHist_(por[no])));
  const tE = sums.reduce((s, x) => s + x.ent, 0), tT = sums.reduce((s, x) => s + x.total, 0);
  const prior = tT ? tE / tT : 0.9;
  const maxEnt = Math.max.apply(null, [1].concat(sums.map(x => x.ent)));
  const lista = sums.filter(x => x.total > 0).map(x => {
    const suave = (x.ent + 20 * prior) / (x.total + 20);
    return { no_empleado: x.no_empleado, entregados: x.ent, fallidos: x.fal, pct: x.pct, dias: x.dias, prom_dia: x.prom_dia,
      score: round_(100 * (w * suave + (1 - w) * x.ent / maxEnt), 1) };
  }).sort((a, b) => b.score - a.score || b.entregados - a.entregados);
  lista.forEach((x, i) => { x.rank = i + 1; });
  return { desde: desde, hasta: hasta, dias: dias, peso_exito: w, lista: lista };
}

/** Vista de admins: cada repartidor con su día, semana y mes y su lugar en la jerarquía. */
function historialEntregas_(fecha) {
  const filas = historialFilas_();
  const sem = semanaDe_(fecha), mes = mesDe_(fecha);
  const jer = jerarquia_(fecha);
  const rk = {}; jer.lista.forEach(x => { rk[x.no_empleado] = x; });
  const per = rows_('Personal');
  const claves = {};
  filas.filter(r => r.fecha >= mes[0] && r.fecha <= mes[1] || r.fecha >= sem[0] && r.fecha <= sem[1]).forEach(r => { claves[r.no || 'C' + r.cid] = r; });
  per.filter(p => p.estatus !== 'baja' && rolBienvenida_(p) === 'repartidor').forEach(p => { if (!claves[String(p.no_empleado)]) claves[String(p.no_empleado)] = { no: String(p.no_empleado), nombre: p.nombre, cid: '' }; });
  const lista = Object.keys(claves).map(k => {
    const ref = claves[k];
    const mias = filas.filter(r => (ref.no ? r.no === ref.no : !r.no && r.cid === ref.cid));
    const p = ref.no ? per.find(x => String(x.no_empleado) === ref.no) : null;
    const en = (a, b) => sumaHist_(mias.filter(r => r.fecha >= a && r.fecha <= b));
    return { no_empleado: ref.no, nombre: p ? p.nombre : ref.nombre, vinculado: !!ref.no, carrier_ids: ref.cid,
      dia: en(fecha, fecha), semana: en(sem[0], sem[1]), mes: en(mes[0], mes[1]), jerarquia: rk[ref.no] || null,
      serie: mias.filter(r => r.fecha > addDias_(fecha, -14) && r.fecha <= fecha).map(r => ({ fecha: r.fecha, ent: r.ent, fal: r.fal + r.inc })) };
  }).sort((a, b) => ((a.jerarquia ? a.jerarquia.rank : 999) - (b.jerarquia ? b.jerarquia.rank : 999)) || String(a.nombre).localeCompare(String(b.nombre)));
  const act = filas.map(r => r.act).filter(String).sort().pop() || '';
  return { fecha: fecha, semana: sem, mes: mes, jerarquia: { dias: jer.dias, desde: jer.desde, hasta: jer.hasta, peso_exito: jer.peso_exito }, actualizado: act,
    shipday: !!prop_('SHIPDAY_KEY'), repartidores: lista };
}

/** Lo que ve el repartidor de sí mismo. */
function desempeno_(no, fecha) {
  fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(fecha || '')) ? fecha : hoy_();
  const mias = historialFilas_().filter(r => r.no === String(no));
  const sem = semanaDe_(fecha), mes = mesDe_(fecha);
  const jer = jerarquia_(fecha);
  const yo = jer.lista.find(x => x.no_empleado === String(no)) || null;
  const en = (a, b) => sumaHist_(mias.filter(r => r.fecha >= a && r.fecha <= b));
  return { fecha: fecha, dia: en(fecha, fecha), semana: en(sem[0], sem[1]), mes: en(mes[0], mes[1]),
    jerarquia: yo ? { rank: yo.rank, de: jer.lista.length, score: yo.score, pct: yo.pct, entregados: yo.entregados } : null, dias_jerarquia: jer.dias,
    serie: mias.filter(r => r.fecha > addDias_(fecha, -14) && r.fecha <= fecha).map(r => ({ fecha: r.fecha, ent: r.ent, fal: r.fal + r.inc })) };
}

// ───────────────────────── Alertas en producción: fuera de ruta y sin entregar ─────────────────────────

function gpsModo_() { const v = String(config_('GPS_MODO', '')).trim().toLowerCase(); return ['produccion', 'prueba', 'apagado'].indexOf(v) >= 0 ? v : 'produccion'; }
function asegurarConfig_() {
  try {
    const cfg = rows_('ConfigPortal');
    CONFIG_DEFAULTS.forEach(([k, v, d]) => { if (!cfg.find(r => r.clave === k)) append_('ConfigPortal', { clave: k, valor: v, descripcion: d }); });
  } catch (e) { console.warn('config', e); }
}
function jsonCol_(v) { try { return JSON.parse(v || '{}') || {}; } catch (e) { return {}; } }

/** Distancia en metros de un punto a una polilínea [[lat,lng],...]. */
function distPolilinea_(p, linea) {
  if (!linea || !linea.length) return Infinity;
  const k = 111320, c = Math.cos(p[0] * Math.PI / 180);
  const xy = q => [(Number(q[1]) - p[1]) * k * c, (Number(q[0]) - p[0]) * k];
  let best = Infinity, a = xy(linea[0]);
  if (linea.length === 1) return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  for (let i = 1; i < linea.length; i++) {
    const b = xy(linea[i]);
    const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    let t = L ? -(a[0] * dx + a[1] * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    const x = a[0] + t * dx, y = a[1] + t * dy;
    best = Math.min(best, Math.sqrt(x * x + y * y));
    a = b;
  }
  return best;
}
const mapsTxt_ = (lat, lng) => 'https://maps.google.com/?q=' + round_(lat, 5) + ',' + round_(lng, 5);
function kmTxt_(m) { return m >= 1000 ? round_(m / 1000, 1) + ' km' : Math.round(m) + ' m'; }

/** Con cada muestra de GPS: ¿el repartidor de cada ruta activa sigue sobre su recorrido? Avisa una vez por salida. */
function revisarDesvios_(pos, ahora) {
  if (!ss_().getSheetByName('Rutas')) return 0;
  rutasTabs_();
  const fecha = hoy_(), nowMin = hm2min_(fmt_(ahora, 'HH:mm'));
  const umbral = Math.max(200, Number(config_('GPS_DESVIO_M', 800))), nec = Math.max(1, Number(config_('GPS_DESVIO_MUESTRAS', 2)));
  const per = rows_('Personal');
  const chk = checadasPorDia_(fecha, fecha);
  const avisos = [];
  rows_('Rutas').filter(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa').forEach(x => {
    const s = segResumen_(x);
    if (!s.pendientes || x.estado_tiempo === 'terminada') return;
    const sal = hm2min_(horaCelda_(x.salida));
    if (sal != null && nowMin < sal + 10) return;
    const p = per.find(q => String(q.no_empleado) === String(x.no_empleado));
    const q = idsShipday_(p).map(id => pos[id]).filter(Boolean)[0];
    if (!q) return;
    const g = jsonCol_(x.gps_json);
    const marcas = (chk[String(x.no_empleado)] || {})[fecha] || [];
    const comiendo = marcas.length && marcas[marcas.length - 1].tipo === 'SALIDA_COMIDA';
    const d0 = jsonCol_(x.datos_json), seg = segDe_(x);
    const dep = d0.deposito || BASE_;
    const paradas = d0.paradas || [];
    const pend = paradas.filter(pp => (pp.envios || []).some(n => !(seg[String(n)] && FINAL_[seg[String(n)].e])));
    const linea = d0.geom && d0.geom.length > 1 ? d0.geom : [dep].concat(paradas.map(pp => [pp.lat, pp.lng]));
    const pt = [q.lat, q.lng];
    let dist = distPolilinea_(pt, linea);
    pend.forEach(pp => { dist = Math.min(dist, havM_(pt, [Number(pp.lat), Number(pp.lng)])); });
    if (havM_(pt, dep) < 400 || comiendo) dist = 0;
    if (dist > umbral) {
      g.f = (g.f || 0) + 1;
      if (g.f >= nec && !g.a) {
        g.a = 1; g.desde = fmt_(ahora, 'HH:mm');
        avisos.push(['ruta_desvio', '🧭 Ruta ' + x.num + ' · ' + primerNombre_(x.nombre) + ' se salió de su ruta',
          'Está a ' + kmTxt_(dist) + ' del recorrido planeado (desde hace ~' + (g.f * 5) + ' min). Le quedan ' + s.pendientes + ' envío(s). Ubicación: ' + mapsTxt_(q.lat, q.lng), x.ruta_id]);
      }
    } else {
      if (g.a && dist < umbral * 0.6) { g.a = 0; g.regreso = fmt_(ahora, 'HH:mm'); }
      g.f = 0;
    }
    g.d = Math.round(dist); g.t = fmt_(ahora, 'HH:mm'); g.p = [round_(q.lat, 5), round_(q.lng, 5)];
    update_('Rutas', x._row, { gps_json: JSON.stringify(g) });
  });
  avisos.forEach(a => notificarOps_(a[0], a[1], a[2], a[3]));
  return avisos.length;
}

/** ¿Lleva RUTA_INACTIVIDAD_MIN sin entregar ni fallar? Avisa a la hora, a las 2 h, etc. (se reinicia con cada entrega). */
function inactividad_(x, seg, datos, nowMin, s) {
  const lim = Number(config_('RUTA_INACTIVIDAD_MIN', 60));
  if (!(lim > 0)) return null;
  const hs = Object.keys(seg).map(n => seg[n]).filter(v => v && FINAL_[v.e]).map(v => hm2min_(v.h)).filter(v => v != null);
  const paradas = (datos && datos.paradas) || [];
  let base, desc;
  if (hs.length) { base = Math.max.apply(null, hs); desc = 'Su última entrega o fallo fue a las ' + min2hm_(base); }
  else {
    const eta1 = hm2min_((paradas[0] || {}).eta), sal = hm2min_(horaCelda_(x.salida));
    base = eta1 != null ? eta1 : sal;
    desc = 'No ha entregado nada todavía (su 1ª parada era a las ~' + min2hm_(base) + ')';
  }
  if (base == null) return null;
  const n = Math.floor((nowMin - base) / lim);
  const st = jsonCol_(x.inact_json);
  const prev = st.base === base ? Number(st.n || 0) : 0;
  if (n < 1 || n <= prev) return null;
  const mins = nowMin - base;
  return { estado: { base: base, n: n, t: min2hm_(nowMin) },
    aviso: ['ruta_inactiva', '⏱️ Ruta ' + x.num + ' · ' + primerNombre_(x.nombre) + ' lleva ' + horasTxt_(mins).replace(' h', ' h') + ' sin entregar',
      desc + '. Le quedan ' + s.pendientes + ' de ' + s.total + ' envíos.' + gpsReciente_(x), x.ruta_id] };
}

/** Texto corto con lo que dice el GPS de Shipday de los últimos 30 min (si hay). */
function gpsReciente_(x) {
  try {
    if (!ss_().getSheetByName('GpsLog')) return '';
    const g = jsonCol_(x.gps_json);
    const ids = idsShipday_(persona_(x.no_empleado));
    const desde = Date.now() - 35 * 60000;
    const m = rows_('GpsLog').filter(r => ids.indexOf(String(r.carrier_id)) >= 0 && r.lat !== '' && new Date(r.fecha).getTime() >= desde)
      .map(r => ({ t: new Date(r.fecha).getTime(), p: [Number(r.lat), Number(r.lng)] })).sort((a, b) => a.t - b.t);
    if (!m.length) return ' Sin GPS reciente de Shipday.';
    const u = m[m.length - 1];
    const mov = Math.max.apply(null, m.map(q => havM_(q.p, u.p)));
    return (mov < 150 && m.length >= 3 ? ' GPS: detenido ~' + Math.round((u.t - m[0].t) / 60000) + ' min en ' : ' GPS: se está moviendo, va en ') + mapsTxt_(u.p[0], u.p[1]) + (g.a ? ' (fuera de ruta)' : '');
  } catch (e) { return ''; }
}

/** Alertas de GPS e inactividad del día (para la pantalla de GPS). */
function alertasGps_(fecha) {
  if (!ss_().getSheetByName('Rutas')) return [];
  return rows_('Rutas').filter(x => fmt_(x.fecha, 'yyyy-MM-dd') === fecha && x.estatus === 'activa').map(x => {
    const g = jsonCol_(x.gps_json), ina = jsonCol_(x.inact_json);
    return { ruta_id: x.ruta_id, num: Number(x.num), nombre: x.nombre, fuera: !!g.a, desde: g.desde || '', dist_m: g.d == null ? null : g.d, revisado: g.t || '',
      pos: g.p || null, sin_entregar_h: ina.n || 0, ina_hora: ina.t || '' };
  }).sort((a, b) => a.num - b.num);
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

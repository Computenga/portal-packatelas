import { api, cached, prefetch, session, DEMO, NetworkError } from './api.js';
import { pickFile, readFile, openBase64, pushState, enablePush, refreshPush, isIOS, isStandalone } from './media.js';

// ═════════ DOM ═════════
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
function fill(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter(c => c != null && c !== false).map(c => c instanceof Node ? c : document.createTextNode(String(c))));
  return el;
}
const $app = document.getElementById('app');
const money = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = n => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const num = (n, d = 1) => n == null || n === '' ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: d });
const hm = min => { min = Math.round(min || 0); return Math.floor(min / 60) + ':' + String(min % 60).padStart(2, '0'); };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fecha = f => { if (!f) return ''; const [y, m, d] = f.slice(0, 10).split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}${y !== String(new Date().getFullYear()) ? ' ' + y : ''}`; };
const fechaHora = f => f ? fecha(f) + ' · ' + f.slice(11, 16) : '';
const hoyLargo = () => new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
const primerNombre = n => String(n || '').trim().split(/\s+/)[0].replace(/^./, c => c.toUpperCase());
const iniciales = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
const esc = s => String(s ?? '');

function toast(msg, kind = 'info', ms = 3500) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}
async function busy(label, fn) {
  const ov = h('div', { class: 'overlay' }, h('div', { class: 'spinner' }), h('p', {}, label));
  document.body.append(ov);
  try { return await fn(); } finally { ov.remove(); }
}
function modal(title, body, actions) {
  return new Promise(resolve => {
    const close = v => { m.remove(); resolve(v); };
    const m = h('div', { class: 'modal', onclick: e => { if (e.target === m) close(null); } },
      h('div', { class: 'sheet' }, h('h2', {}, title), body,
        h('div', { class: 'row', style: 'margin-top:14px' }, (actions || [['Cerrar', null]]).map(([l, v, cls]) =>
          h('button', { class: 'btn ' + (cls || ''), onclick: async () => { if (typeof v === 'function') { const r = await v(); if (r !== false) close(r); } else close(v); } }, l)))));
    document.body.append(m);
    const f = m.querySelector('input,textarea,select'); if (f) setTimeout(() => f.focus(), 60);
  });
}
const confirmar = (title, text, okLabel = 'Confirmar', cls = 'primary') => modal(title, h('p', {}, text), [['Cancelar', false], [okLabel, true, cls]]);
function pinModal(title, text) {
  const inp = h('input', { class: 'input big center', type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'off', placeholder: '••••••' });
  return modal(title, h('div', {}, h('p', { class: 'muted' }, text), inp), [['Cancelar', null], ['Confirmar', () => inp.value.length === 6 ? inp.value : (toast('El PIN tiene 6 dígitos', 'warn'), false), 'primary']]);
}

// ═════════ Estado y navegación ═════════
const state = { tab: null, noLeidos: 0, seq: 0 };
/** Para cached(): si llega información nueva y la persona sigue en la misma pantalla, la vuelve a pintar sin perder el scroll. */
function live(rerun) {
  const seq = state.seq;
  return { onUpdate: () => { if (state.seq !== seq) return; const y = window.scrollY; Promise.resolve(rerun()).then(() => window.scrollTo(0, y)); } };
}
const isPatron = () => session.user?.rol === 'patron';
const isAdmin = () => isPatron() || session.user?.rol === 'admin';
const esRepartidor = () => state.repartidor ?? !!session.user?.repartidor;
const modoPatron = () => isPatron() && session.modo === 'patron';

const TABS = {
  empleado: [['inicio', '🏠', 'Inicio'], ['asistencia', '⏱️', 'Asistencia'], ['nomina', '💵', 'Nómina'], ['solicitudes', '📝', 'Solicitudes'], ['mas', '☰', 'Más']],
  patron: [['panel', '📊', 'Panel'], ['equipo', '⏱️', 'Asistencia'], ['pnomina', '💵', 'Nómina'], ['personal', '👥', 'Personal'], ['pmas', '☰', 'Más']],
};
const VIEWS = {};
function go(tab, ...args) { state.tab = tab; (VIEWS[tab] || VIEWS[modoPatron() ? 'panel' : 'inicio'])(...args); }

function screen(title, body, { back, actions, sub } = {}) {
  state.seq++;
  $app.replaceChildren(
    h('header', { class: 'topbar' + (modoPatron() ? ' patron' : '') },
      back ? h('button', { class: 'icon-btn', 'aria-label': 'Regresar', onclick: back }, '←') : h('span', { class: 'logo' }, modoPatron() ? '🏢' : '📦'),
      h('div', { class: 'tb-title' }, h('h1', {}, title), sub && h('span', { class: 'tb-sub' }, sub)),
      actions || null,
      h('button', { class: 'icon-btn bell', 'aria-label': 'Notificaciones', onclick: () => bandeja() }, '🔔', state.noLeidos ? h('span', { class: 'dot' }, state.noLeidos > 9 ? '9+' : state.noLeidos) : null)),
    DEMO ? h('div', { class: 'demo-strip' }, 'Modo demostración · datos de ejemplo') : null,
    h('main', { class: 'content' }, body),
    nav());
  window.scrollTo(0, 0);
}
function nav() {
  const tabs = TABS[modoPatron() ? 'patron' : 'empleado'];
  return h('nav', { class: 'tabbar' }, tabs.map(([id, icon, label]) =>
    h('button', { class: state.tab === id ? 'active' : '', onclick: () => go(id) }, h('span', { class: 'ti' }, icon), h('span', {}, label))));
}
const loading = () => h('div', { class: 'spinner' });
const errorBox = (e, retry) => h('div', { class: 'banner error' }, e.message, retry && h('div', {}, h('button', { class: 'link', onclick: retry }, 'Reintentar')));
const kpi = (label, value, subtxt, cls = '') => h('div', { class: 'kpi ' + cls }, h('span', { class: 'kpi-l' }, label), h('strong', { class: 'kpi-v' }, value), subtxt != null && h('span', { class: 'kpi-s' }, subtxt));
const section = t => h('h2', { class: 'section' }, t);
const empty = (icon, text) => h('div', { class: 'empty' }, h('div', { class: 'empty-i' }, icon), h('p', {}, text));
function segmented(options, current, onChange) {
  return h('div', { class: 'seg' }, options.map(([k, l]) => h('button', { class: k === current ? 'on' : '', onclick: () => onChange(k) }, l)));
}
function table(cols, rows, onRow) {
  if (!rows.length) return h('p', { class: 'muted' }, 'Sin datos.');
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, cols.map(c => h('th', { class: c.cls || '' }, c.t)))),
    h('tbody', {}, rows.map(r => h('tr', { class: onRow ? 'tap' : '', onclick: onRow ? () => onRow(r) : null }, cols.map(c => h('td', { class: c.cls || '' }, c.f ? c.f(r) : r[c.k])))))));
}

// ═════════ Periodos (quincenas) ═════════
function periodoDe(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'); return `${y}-${m}-${d.getDate() <= 15 ? 1 : 2}`; }
function periodoInfo(id) {
  const [y, m, q] = id.split('-').map(Number);
  const ult = new Date(y, m, 0).getDate();
  const mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1];
  return { id, etiqueta: `${q === 1 ? '1ª' : '2ª'} quincena de ${mes}`, corta: `${q === 1 ? '1–15' : '16–' + ult} ${mes.slice(0, 3)}`, y };
}
function periodoMover(id, n) {
  let [y, m, q] = id.split('-').map(Number);
  let idx = y * 24 + (m - 1) * 2 + (q - 1) + n;
  y = Math.floor(idx / 24); idx %= 24; m = Math.floor(idx / 2) + 1; q = (idx % 2) + 1;
  return `${y}-${String(m).padStart(2, '0')}-${q}`;
}
function periodoPicker(current, onChange) {
  const actual = periodoDe(new Date());
  const p = periodoInfo(current);
  return h('div', { class: 'per-picker' },
    h('button', { class: 'icon-btn ghost', 'aria-label': 'Quincena anterior', onclick: () => onChange(periodoMover(current, -1)) }, '‹'),
    h('div', { class: 'per-label' }, h('strong', {}, p.etiqueta), h('span', { class: 'muted small' }, current === actual ? 'Quincena actual' : p.y)),
    h('button', { class: 'icon-btn ghost', 'aria-label': 'Quincena siguiente', disabled: current >= actual, onclick: () => onChange(periodoMover(current, 1)) }, '›'));
}

// ═════════ Login: RFC + PIN ═════════
async function login() {
  const card = h('div', { class: 'card' });
  $app.replaceChildren(h('div', { class: 'login' },
    h('div', { class: 'brand' }, h('div', { class: 'logo-big' }, '📦'), h('h1', {}, 'Mi Portal'), h('p', {}, 'Packatelas · Computenga')),
    DEMO && h('div', { class: 'banner info' }, h('strong', {}, 'Demostración. '), 'RFC del patrón: GUPC900101AB1 · empleado: LOAS950505H12 · PIN 482915 (o cualquier RFC nuevo con No. 4)'),
    card));
  pasoRfc(card);
}

function pasoRfc(card) {
  const rfc = h('input', { class: 'input big mono', placeholder: 'Tu RFC', autocapitalize: 'characters', autocomplete: 'username', maxlength: 13, value: session.lastRfc });
  const go = async () => {
    const v = rfc.value.toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(v)) return toast('Revisa tu RFC: son 13 caracteres (ej. LOAS950505H12)', 'warn');
    try {
      const r = await busy('Buscando…', () => api('estadoRfc', { rfc: v }));
      session.lastRfc = v;
      if (r.estado === 'bloqueado') return fill(card, h('h3', {}, 'Acceso bloqueado'), h('p', { class: 'muted' }, 'Tu PIN se bloqueó por intentos fallidos. Pide a RH que lo reinicie.'), h('button', { class: 'btn block', onclick: () => pasoRfc(card) }, 'Regresar'));
      r.estado === 'nuevo' ? pasoNuevo(card, v) : pasoPin(card, v);
    } catch (e) {
      if (/no está dado de alta/.test(e.message)) return altaView(v);
      toast(e.message, 'error', 5000);
    }
  };
  rfc.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  fill(card, h('label', { class: 'label' }, 'RFC'), rfc, h('button', { class: 'btn primary block', onclick: go }, 'Continuar'),
    h('p', { class: 'muted small center' }, '¿Primera vez? Escribe tu RFC y crea tu PIN.'),
    h('button', { class: 'btn block soy-nuevo', onclick: () => altaView('') }, '🆕 Soy nuevo, aún no tengo alta'));
}

// ═════════ Alta de personal nuevo (sin sesión) ═════════
const ALTA_KEY = (DEMO ? 'ppd_' : 'pp_') + 'alta';
const altaToken = { get: () => localStorage.getItem(ALTA_KEY), set: t => localStorage.setItem(ALTA_KEY, t), clear: () => localStorage.removeItem(ALTA_KEY) };

function altaShell(...children) {
  $app.replaceChildren(h('div', { class: 'login alta' },
    h('div', { class: 'brand' }, h('div', { class: 'logo-big' }, '📦'), h('h1', {}, 'Bienvenido a Packatelas'), h('p', {}, 'Tu alta como empleado')),
    ...children,
    h('button', { class: 'link center-block', onclick: () => login() }, 'Ya tengo acceso, entrar con mi RFC')));
}

async function altaView(rfcInicial) {
  const t = altaToken.get();
  if (t) {
    altaShell(h('div', { class: 'card' }, loading()));
    try { return altaEstadoView(await api('altaEstado', { alta_token: t })); }
    catch (e) { if (!(e instanceof NetworkError)) altaToken.clear(); else return altaShell(errorBox(e, () => altaView(rfcInicial))); }
  }
  const f = {
    nombre: h('input', { class: 'input', placeholder: 'Nombre(s) y apellidos', autocomplete: 'name' }),
    rfc: h('input', { class: 'input mono', placeholder: 'RFC con homoclave', maxlength: 13, autocapitalize: 'characters', value: rfcInicial || '' }),
    telefono: h('input', { class: 'input', type: 'tel', inputmode: 'numeric', maxlength: 10, placeholder: '10 dígitos' }),
  };
  let rol = '';
  const roles = h('div', { class: 'grid2' });
  const drawRoles = () => fill(roles, [['repartidor', '🛵 Repartidor'], ['otro', '🏢 Otro puesto']].map(([k, l]) =>
    h('button', { class: 'btn block' + (rol === k ? ' primary' : ''), onclick: () => { rol = k; drawRoles(); } }, l)));
  drawRoles();
  altaShell(h('div', { class: 'card' },
    h('p', { class: 'muted', style: 'margin-top:0' }, 'Llena tus datos y sube tus documentos con la cámara de tu celular. RH los revisa y te da tu número de empleado.'),
    h('label', { class: 'label' }, 'Nombre completo'), f.nombre,
    h('label', { class: 'label' }, 'RFC'), f.rfc,
    h('label', { class: 'label' }, 'Celular'), f.telefono,
    h('label', { class: 'label' }, '¿Cuál es tu puesto?'), roles,
    h('button', { class: 'btn primary block', onclick: async () => {
      if (!rol) return toast('Elige tu puesto', 'warn');
      try {
        const r = await busy('Guardando…', () => api('altaIniciar', { nombre: f.nombre.value, rfc: f.rfc.value.toUpperCase().replace(/[\s-]/g, ''), telefono: f.telefono.value, rol }));
        altaToken.set(r.alta_token);
        altaEstadoView(r.alta);
      } catch (e) { toast(e.message, 'error', 5000); }
    } }, 'Continuar'),
    h('p', { class: 'muted tiny' }, '¿Ya empezaste en otro celular? Pon el mismo RFC y celular y sigues donde te quedaste.')));
}

function altaEstadoView(a) {
  const d = a.docs;
  const head = {
    pendiente: h('div', { class: 'card' }, h('h3', {}, `Hola, ${primerNombre(a.nombre)} 👋`), h('div', { class: 'bar' }, h('span', { style: `width:${Math.round(d.subidos / Math.max(1, d.requeridos) * 100)}%` })),
      h('p', { class: 'muted small' }, `${d.subidos} de ${d.requeridos} documentos subidos. Puedes cerrar y regresar cuando quieras.`)),
    completa: h('div', { class: 'banner info' }, h('strong', {}, '✅ Ya subiste todo. '), 'RH está revisando tus documentos. Regresa más tarde para ver tu número de empleado.'),
    aprobada: h('div', { class: 'card done-card' }, h('div', { class: 'big-emoji' }, '🎉'), h('h3', {}, '¡Ya estás dado de alta!'),
      h('p', {}, 'Tu número de empleado es'), h('div', { class: 'no-emp' }, a.no_empleado),
      h('button', { class: 'btn primary block', onclick: () => { altaToken.clear(); session.lastRfc = a.rfc; login().then(() => pasoNuevo(document.querySelector('.login > .card'), a.rfc, a.no_empleado)); } }, 'Crear mi acceso')),
    rechazada: h('div', { class: 'banner error' }, h('strong', {}, 'Tu alta no fue aprobada. '), a.notas || 'Comunícate con RH.'),
  }[a.estatus];
  altaShell(head,
    a.estatus !== 'aprobada' && [h('h2', { class: 'section' }, 'Tus documentos'),
      docsList(d.documentos, { editable: ['pendiente', 'completa'].includes(a.estatus), onUpload: async (doc, file) => {
        const r = await api('altaSubir', { alta_token: altaToken.get(), doc_id: doc.doc_id, base64: file.base64, mime: file.mime });
        altaEstadoView(r);
      } })]);
}

/** Lista de documentos con estado; sube con cámara/archivo o revisa (patrón). */
function docsList(docs, { editable, onUpload, admin, onReview, onView } = {}) {
  const EST = { falta: ['Falta', 'muted', '📄'], subido: [admin ? 'Por revisar' : 'En revisión', 'warn', '🕓'], aprobado: ['Aprobado', 'ok', '✅'], rechazado: ['Corregir', 'err', '⚠️'] };
  return h('div', { class: 'docs' }, docs.map(d => {
    const [l, c, i] = EST[d.estatus] || [d.estatus, 'muted', '📄'];
    return h('div', { class: 'doc-row st-' + d.estatus },
      h('span', { class: 'doc-i' }, i),
      h('div', { class: 'grow' }, h('strong', {}, d.nombre, !d.requerido && h('small', { class: 'muted' }, ' · opcional')),
        d.descripcion && d.estatus === 'falta' && h('small', { class: 'muted block' }, d.descripcion),
        d.estatus === 'rechazado' && d.comentario && h('small', { class: 'block late' }, d.comentario),
        h('span', { class: 'badge b-' + c }, l)),
      h('div', { class: 'app-act' },
        editable && d.estatus !== 'aprobado' && h('button', { class: 'btn sm' + (d.estatus === 'falta' || d.estatus === 'rechazado' ? ' primary' : ''), onclick: async () => {
          const f = await pickFile('image/*,application/pdf');
          if (!f) return;
          try { const file = await readFile(f); await busy('Subiendo ' + d.nombre + '…', () => onUpload(d, file)); toast('Subido', 'ok'); } catch (e) { toast(e.message, 'error', 5000); }
        } }, d.estatus === 'falta' ? '📷 Subir' : 'Cambiar'),
        (admin || (!editable && d.archivo_id)) && d.archivo_id && h('button', { class: 'btn sm', onclick: () => onView ? onView(d) : verArchivo(d) }, 'Ver'),
        admin && d.archivo_id && d.estatus !== 'aprobado' && h('button', { class: 'chk on', onclick: () => onReview(d, 'aprobado') }, '✓ Aprobar'),
        admin && d.archivo_id && d.estatus !== 'rechazado' && h('button', { class: 'chk', onclick: () => onReview(d, 'rechazado') }, '✗ Rechazar')));
  }));
}

async function verArchivo(d) {
  try { openBase64(await busy('Abriendo…', () => api('archivo', { archivo_id: d.archivo_id }))); } catch (e) { toast(e.message, 'error'); }
}

async function revisarDoc(d, estatus, after) {
  let comentario = '';
  if (estatus === 'rechazado') {
    const inp = h('textarea', { class: 'input', rows: 2, placeholder: 'Qué debe corregir (ej. foto borrosa, comprobante viejo)' });
    const ok = await modal('Rechazar ' + d.nombre, inp, [['Cancelar', false], ['Rechazar', true, 'danger']]);
    if (!ok) return;
    comentario = inp.value;
  }
  try { await busy('Guardando…', () => api('revisarDocumento', { archivo_id: d.archivo_id, estatus, comentario })); toast(estatus === 'aprobado' ? 'Aprobado' : 'Rechazado, se le avisó', 'ok'); after(); }
  catch (e) { toast(e.message, 'error'); }
}

function keypad(onDone, { len = 6, label } = {}) {
  let pin = '';
  const dots = h('div', { class: 'pin-dots' });
  const draw = () => fill(dots, Array.from({ length: len }, (_, i) => h('span', { class: i < pin.length ? 'on' : '' })));
  draw();
  const press = k => () => {
    if (k === '⌫') pin = pin.slice(0, -1);
    else if (pin.length < len) pin += k;
    draw();
    if (pin.length === len) { const p = pin; setTimeout(async () => { const keep = await onDone(p); if (!keep) { pin = ''; draw(); } }, 120); }
  };
  return h('div', {}, label && h('p', { class: 'center muted' }, label), dots,
    h('div', { class: 'keypad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? h('button', { class: 'key', onclick: press(k) }, k) : h('span'))));
}

function pasoPin(card, rfc) {
  fill(card, h('div', { class: 'row between' }, h('span', { class: 'mono' }, rfc), h('button', { class: 'link', onclick: () => pasoRfc(card) }, 'Cambiar')),
    keypad(async pin => {
      try {
        const r = await busy('Entrando…', () => api('login', { rfc, pin }));
        session.set(r.token, r.usuario);
        start();
        return true;
      } catch (e) { toast(e.message, 'error', 5000); if (/bloquead/.test(e.message)) pasoRfc(card); return false; }
    }, { label: 'Escribe tu PIN de 6 dígitos' }),
    h('p', { class: 'muted small center' }, '¿Olvidaste tu PIN? Pide a RH que lo reinicie.'));
}

function pasoNuevo(card, rfc, noIni) {
  const no = h('input', { class: 'input big', inputmode: 'numeric', placeholder: 'Ej. 45', value: noIni || '' });
  fill(card, h('h3', {}, 'Bienvenido 👋'), h('p', { class: 'muted' }, 'Es tu primer acceso. Para confirmar que eres tú, escribe tu número de empleado (el mismo del checador).'),
    h('label', { class: 'label' }, 'Número de empleado'), no,
    h('button', { class: 'btn primary block', onclick: () => {
      if (!no.value.trim()) return toast('Escribe tu número de empleado', 'warn');
      let first = null;
      fill(card, h('h3', {}, 'Crea tu PIN'), h('p', { class: 'muted small' }, 'Lo usarás para entrar y para firmar tus recibos. No lo compartas.'),
        keypad(async pin => {
          if (!first) { if (/^(\d)\1{5}$|^123456$|^654321$/.test(pin)) { toast('Ese PIN es muy fácil, elige otro', 'warn'); return false; } first = pin; card.querySelector('.center.muted').textContent = 'Repite tu PIN'; return false; }
          if (pin !== first) { first = null; card.querySelector('.center.muted').textContent = 'No coincidió. Escribe un PIN nuevo'; toast('Los PIN no coinciden', 'warn'); return false; }
          try {
            const r = await busy('Creando acceso…', () => api('primerAcceso', { rfc, no_empleado: no.value.trim(), pin }));
            session.set(r.token, r.usuario);
            toast('¡Listo! Ya tienes acceso', 'ok');
            start();
            return true;
          } catch (e) { toast(e.message, 'error', 5000); pasoNuevo(card, rfc); return true; }
        }, { label: 'Escribe un PIN de 6 dígitos' }));
    } }, 'Continuar'),
    h('button', { class: 'link', onclick: () => pasoRfc(card) }, 'Regresar'));
}

// ═════════ Tarjetas comunes ═════════
function pushCard() {
  const st = pushState();
  if (st === 'granted') return null;
  if (isIOS() && !isStandalone()) return h('div', { class: 'card soft' }, h('h3', {}, '📲 Instala la app'),
    h('p', { class: 'muted' }, 'Para recibir avisos de tu nómina en iPhone: toca Compartir ', h('b', {}, '⬆︎'), ' → "Agregar a pantalla de inicio" y abre el portal desde ese ícono.'));
  if (st === 'no_soportado') return null;
  return h('div', { class: 'card soft' }, h('h3', {}, '🔔 Activa las notificaciones'),
    h('p', { class: 'muted' }, st === 'denied' ? 'Las bloqueaste. Actívalas en la configuración del sitio en tu navegador.' : 'Te avisamos cuando llegue tu recibo, tu depósito o la respuesta a tus solicitudes.'),
    st !== 'denied' && h('button', { class: 'btn primary', onclick: async () => {
      try { await busy('Activando…', enablePush); toast('Notificaciones activadas', 'ok'); go(state.tab); } catch (e) { toast(e.message, 'error'); }
    } }, 'Activar'));
}

const ESTADOS = {
  A_TIEMPO: ['A tiempo', 'ok'], RETARDO: ['Retardo', 'warn'], FALTA: ['Falta', 'err'], JUSTIFICADA: ['Justificada', 'info'],
  PENDIENTE: ['Sin checar aún', 'muted'], DESCANSO: ['Descanso', 'muted'], DESCANSO_TRABAJADO: ['Descanso (checó)', 'info'],
  FUTURO: ['—', 'muted'], ANTES: ['Antes del checador', 'muted'], SIN_DATOS: ['—', 'muted'], SIN_HORARIO: ['Sin horario', 'muted'],
};
const estadoBadge = e => { const [l, c] = ESTADOS[e] || [e, 'muted']; return h('span', { class: 'badge b-' + c }, l); };
const TIPO_MARCA = { ENTRADA: 'Entrada', SALIDA_COMIDA: 'Salió a comer', REGRESO_COMIDA: 'Regresó', SALIDA: 'Salida' };

function reciboBadges(r) {
  if (r.historico) return h('span', { class: 'row wrap gap4' }, h('span', { class: 'badge b-info' }, 'Histórico'), h('span', { class: 'badge b-ok' }, 'Pagado'));
  return h('span', { class: 'row wrap gap4' },
    r.estatus === 'cancelado' ? h('span', { class: 'badge b-err' }, 'Cancelado') : r.estatus === 'pagado' ? h('span', { class: 'badge b-ok' }, 'Pagado') : h('span', { class: 'badge b-warn' }, 'Por pagar'),
    r.estatus !== 'cancelado' && (r.firma_fecha ? h('span', { class: 'badge b-info' }, '✓ Firmado') : h('span', { class: 'badge b-warn' }, 'Por firmar')));
}

// ═════════════════════ EMPLEADO ═════════════════════

VIEWS.inicio = async function inicio() {
  const body = h('div', {}, h('p', { class: 'muted cap' }, hoyLargo()), loading());
  screen('Hola, ' + primerNombre(session.user.nombre), body);
  let d, offline;
  try { ({ data: d, offline } = await cached('inicio', {}, live(inicio))); } catch (e) { return fill(body, errorBox(e, inicio)); }
  setBadge(d.no_leidos);
  state.repartidor = !!d.repartidor;
  state.flotilla = d.flotilla || null;
  const a = d.asistencia, hd = d.hoy_detalle;
  fill(body,
    h('p', { class: 'muted cap' }, hoyLargo()),
    offline && h('div', { class: 'banner warn' }, 'Sin conexión: mostrando lo último que se cargó.'),
    d.bienvenida && !d.bienvenida.completa && h('button', { class: 'card tap welcome', onclick: () => bienvenidaView() },
      h('div', { class: 'row between' }, h('h3', {}, '👋 Tu bienvenida'), h('span', { class: 'muted small' }, `${d.bienvenida.hechos} de ${d.bienvenida.total}`)),
      h('div', { class: 'bar' }, h('span', { style: `width:${Math.round(d.bienvenida.hechos / d.bienvenida.total * 100)}%` })),
      h('p', { class: 'small' }, 'Siguiente: ', h('strong', {}, d.bienvenida.siguiente)), h('span', { class: 'btn primary sm' }, 'Continuar')),
    d.datos_pendientes && h('button', { class: 'banner action warn', onclick: () => perfilView() },
      h('strong', {}, '📍 Completa tu domicilio y tus 2 contactos de emergencia'), h('span', {}, 'Ponemos tu casa en el mapa y a quién llamar si te pasa algo →')),
    d.ruta && h('button', { class: 'card tap ruta-card', onclick: () => rutaView() },
      h('div', { class: 'row between' }, h('h3', {}, '🗺️ ' + (d.ruta.fecha === d.hoy ? 'Tu ruta de hoy' : 'Tu ruta del ' + fecha(d.ruta.fecha))), h('span', { class: 'chev' }, '›')),
      h('p', { class: 'small' }, h('strong', {}, `${d.ruta.paradas} paradas`), ` · ${d.ruta.envios} envíos · sales ${d.ruta.salida} · terminas aprox ${d.ruta.fin}`),
      h('span', { class: 'btn primary sm' }, 'Ver mapa y paradas')),
    flotillaCard(d.flotilla),
    desempenoCard(d.desempeno),
    d.recibos_sin_firmar > 0 && h('button', { class: 'banner action warn', onclick: () => go('nomina') },
      h('strong', {}, `🧾 Tienes ${d.recibos_sin_firmar} recibo${d.recibos_sin_firmar > 1 ? 's' : ''} por firmar`), h('span', {}, 'Revísalo y confirma de recibido →')),

    h('div', { class: 'hero ' + (hd ? 'st-' + hd.estado : '') },
      h('div', { class: 'hero-l' }, h('span', { class: 'hero-k' }, 'Hoy'),
        hd && hd.entrada ? h('strong', { class: 'hero-v' }, hd.entrada) : h('strong', { class: 'hero-v dim' }, hd && hd.laboral ? '--:--' : 'Descanso'),
        h('span', { class: 'hero-s' }, hd ? (hd.entrada ? `Entrada · debías ${hd.debia || '—'}` : hd.laboral ? `Entras a las ${hd.debia}` : 'No es día laboral') : 'Sin horario asignado')),
      h('div', { class: 'hero-r' }, hd && estadoBadge(hd.estado),
        hd && hd.min_tarde > 0 && h('span', { class: 'hero-late' }, `+${hd.min_tarde} min`),
        hd && hd.marcas.length > 1 && h('span', { class: 'muted small' }, hd.marcas.slice(1).map(m => `${TIPO_MARCA[m.tipo]} ${m.hora}`).join(' · ')))),

    (d.accesos || []).length > 0 && [section('Accesos directos'), accesosGrid(d.accesos.slice(0, 7), true)],
    section(d.periodo.etiqueta),
    h('button', { class: 'kpis plain', onclick: () => go('asistencia') },
      kpi('Retrasos', hm(a.min_total), `${a.retardos + a.retardos_comida} vez(es)`, a.min_total ? 'warn' : ''),
      kpi('Faltas', a.faltas, a.justificadas ? `${a.justificadas} justificada(s)` : 'en la quincena', a.faltas ? 'err' : ''),
      kpi('A descontar', num(a.horas_descuento, 2) + ' h', 'faltas + retrasos', a.horas_descuento ? 'warn' : ''),
      kpi('Asistencias', `${a.asistencias}/${a.dias_laborales}`, 'días laborales')),

    section('Nómina'),
    d.ultimo_pago ? h('button', { class: 'card tap row between', onclick: () => go('nomina', 'pagos') },
      h('div', {}, h('span', { class: 'muted small' }, 'Último depósito · ' + fechaHora(d.ultimo_pago.fecha)), h('h3', { class: 'amount big' }, money(d.ultimo_pago.monto)), h('span', { class: 'muted small' }, d.ultimo_pago.concepto)),
      h('span', { class: 'chev' }, '›')) : null,
    d.ultimo_recibo ? h('button', { class: 'card tap row between', onclick: () => reciboView(d.ultimo_recibo.recibo_id) },
      h('div', {}, h('span', { class: 'muted small' }, 'Último recibo · ' + d.ultimo_recibo.etiqueta), h('h3', { class: 'amount' }, money(d.ultimo_recibo.neto)), reciboBadges(d.ultimo_recibo)),
      h('span', { class: 'chev' }, '›')) : h('div', { class: 'card soft' }, h('p', { class: 'muted' }, 'Aún no tienes recibos en el portal.')),
    (d.saldo_adeudos > 0 || d.cargos_pendientes > 0) && h('button', { class: 'card tap row between', onclick: () => adeudosView() },
      h('div', {}, h('span', { class: 'muted small' }, 'Adeudos y cargos'), h('h3', { class: 'amount' }, money(d.saldo_adeudos + d.cargos_pendientes)),
        h('span', { class: 'muted small' }, [d.saldo_adeudos > 0 && `Préstamos ${money0(d.saldo_adeudos)}`, d.cargos_pendientes > 0 && `Flotilla ${money0(d.cargos_pendientes)} por descontar`].filter(Boolean).join(' · '))),
      h('span', { class: 'chev' }, '›')),
    d.solicitudes_pendientes > 0 && h('button', { class: 'card tap row between', onclick: () => go('solicitudes') },
      h('div', {}, h('h3', {}, `📝 ${d.solicitudes_pendientes} solicitud(es) en revisión`), h('span', { class: 'muted small' }, 'Te avisamos cuando RH responda')), h('span', { class: 'chev' }, '›')),
    pushCard(),
    h('div', { class: 'quick' },
      h('button', { class: 'q', onclick: () => nuevaSolicitud('justificante') }, h('span', {}, '🩺'), 'Justificar falta'),
      h('button', { class: 'q', onclick: () => nuevaSolicitud('vacaciones') }, h('span', {}, '🏖️'), 'Vacaciones'),
      h('button', { class: 'q', onclick: () => nuevaSolicitud('anticipo') }, h('span', {}, '💳'), 'Anticipo'),
      h('button', { class: 'q', onclick: () => documentosView() }, h('span', {}, '📄'), 'Documentos')),
  );
};

// ═════════ Flotilla (integrada) ═════════
// La app de flotilla vive en computenga.github.io/flotilla-packatelas y comparte el almacenamiento del
// navegador con el portal: entra sola con la sesión del portal (sin otro PIN). Aquí se muestra dentro del portal.
const FLOTILLA_URL = '../flotilla-packatelas/';

function flotillaCard(f) {
  if (!f) return null;
  if (f.rol !== 'repartidor') {
    return h('button', { class: 'card tap row between', onclick: () => flotillaView('fallas') },
      h('div', {}, h('h3', {}, '🛵 Flotilla'), h('span', { class: 'muted small' }, f.fallas_pendientes ? `${f.fallas_pendientes} falla(s) pendiente(s) de reparar` : 'Sin fallas pendientes')),
      h('span', { class: 'chev' }, '›'));
  }
  const paso = (okk, txt, sub, dest) => h('button', { class: 'fl-step ' + (okk ? 'ok' : 'todo'), onclick: e => { e.stopPropagation(); flotillaView(dest); } },
    h('span', { class: 'fl-dot' }, okk ? '✓' : '•'), h('span', {}, h('strong', {}, txt), h('small', { class: 'muted' }, sub)));
  return h('div', { class: 'card fl-card' },
    h('div', { class: 'row between' }, h('h3', {}, '🛵 Mi moto hoy'), h('button', { class: 'link', onclick: () => flotillaView() }, 'Abrir flotilla')),
    paso(!!f.check, 'Check matutino', f.check ? `Moto ${f.check.vehiculo_id} · ${f.check.hora}` : '4 fotos, odómetro y fallas', f.check ? 'jornada' : 'check'),
    paso(!!f.carga, 'Carga de gasolina', f.carga ? `Registrada · ${money(f.carga.monto)}` : f.check ? 'Monto, litros y ticket' : 'Después del check', f.check && !f.carga ? 'carga' : 'jornada'),
    h('div', { class: 'row', style: 'gap:8px;margin-top:8px' },
      h('button', { class: 'btn sm', onclick: () => flotillaView('ruta') }, '⚠️ Reportar daño'),
      h('button', { class: 'btn sm', onclick: () => flotillaView('historial') }, f.mis_fallas ? `Mis fallas (${f.mis_fallas})` : 'Mis fallas y cargos')));
}

function flotillaView(destino) {
  const prev = state.tab;
  state.seq++;
  const src = FLOTILLA_URL + '?embed=1' + (destino ? '#' + destino : '');
  const frame = h('iframe', { class: 'fl-frame', src, title: 'Flotilla', allow: 'camera; geolocation' });
  $app.replaceChildren(
    h('header', { class: 'topbar' + (modoPatron() ? ' patron' : '') },
      h('button', { class: 'icon-btn', 'aria-label': 'Regresar al portal', onclick: () => { go(prev || (modoPatron() ? 'pmas' : 'inicio')); } }, '←'),
      h('div', { class: 'tb-title' }, h('h1', {}, 'Flotilla'), h('span', { class: 'tb-sub' }, 'Regresar al portal')),
      h('button', { class: 'icon-btn', 'aria-label': 'Recargar', onclick: () => { frame.src = src; } }, '↻')),
    frame);
}

// ═════════ Bienvenida, apps y accesos ═════════
const isAndroid = () => /android/i.test(navigator.userAgent);
const absUrl = u => new URL(u, location.href).href;

// ¿Está instalada? En Android no hay forma de preguntarlo en silencio desde una página web: se valida al tocar
// "Abrir" (si la app abre, la página se oculta; si no está, Chrome regresa a esta página con #app-no-<id>).
// Lo comprobado se recuerda en este celular y en el servidor (lista/no lista).
const INST_KEY = 'pp_apps_inst';
const instLocal = {
  all() { try { return JSON.parse(localStorage.getItem(INST_KEY) || '{}'); } catch { return {}; } },
  set(id, v) { try { const o = instLocal.all(); o[id] = v; localStorage.setItem(INST_KEY, JSON.stringify(o)); } catch {} },
};
const verificable = a => isAndroid() && !!a.android_package && a.tipo !== 'web';
function instalada(a) { const o = instLocal.all(); return a.app_id in o ? !!o[a.app_id] : !!a.lista; }
function marcarInstalada(a, si) {
  instLocal.set(a.app_id, si);
  if (!!a.lista !== si) { a.lista = si; api('marcarApp', { app_id: a.app_id, lista: si }).catch(() => {}); }
}
/** Lanza la app. Resuelve 'abierta' | 'no_instalada' | 'externa' (sin forma de saber). */
function lanzarApp(a) {
  const instalar = a.url_instalar ? absUrl(a.url_instalar) : '';
  if (a.tipo === 'web') { window.open(a.url_abrir || instalar, '_blank', 'noopener'); return Promise.resolve('externa'); }
  if (!verificable(a)) { const u = a.url_abrir || instalar; if (u) window.open(u, '_blank', 'noopener'); return Promise.resolve('externa'); }
  return new Promise(res => {
    const marca = '#app-no-' + a.app_id;
    let listo = false;
    const fin = r => { if (listo) return; listo = true; clearTimeout(t); document.removeEventListener('visibilitychange', vis); window.removeEventListener('hashchange', hc); window.removeEventListener('blur', bl); res(r); };
    const vis = () => { if (document.hidden) fin('abierta'); };
    const bl = () => setTimeout(() => { if (document.hidden) fin('abierta'); }, 300);
    const hc = () => { if (location.hash === marca) { history.replaceState(null, '', location.pathname + location.search); fin('no_instalada'); } };
    document.addEventListener('visibilitychange', vis); window.addEventListener('hashchange', hc); window.addEventListener('blur', bl);
    const t = setTimeout(() => fin(document.hidden ? 'abierta' : 'no_instalada'), 4000);
    const vuelta = location.href.split('#')[0] + marca;
    location.href = `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${a.android_package};S.browser_fallback_url=${encodeURIComponent(vuelta)};end`;
  });
}
/** Abrir desde accesos directos o la lista: si no está instalada, ofrece instalarla. */
async function abrirApp(a, despues) {
  const r = await lanzarApp(a);
  if (r === 'abierta') marcarInstalada(a, true);
  if (r === 'no_instalada') {
    marcarInstalada(a, false);
    if (await modal(a.nombre + ' no está instalada', h('p', {}, 'No la encontramos en este celular. Instálala y luego toca "Abrir".'), [['Ahora no', false], ['Instalar', true, 'primary']])) instalarApp(a);
  }
  if (despues) despues(r);
  return r;
}
// Si Chrome regresó con la marca (la página se recargó en lugar de solo cambiar el #)
(() => { const m = location.hash.match(/^#app-no-(.+)$/); if (m) { instLocal.set(decodeURIComponent(m[1]), false); history.replaceState(null, '', location.pathname + location.search); } })();

async function instalarApp(a) {
  if (a.tipo === 'apk') {
    const ok = await modal('Instalar ' + a.nombre, h('div', {},
      h('ol', { class: 'small steps-ol' },
        h('li', {}, 'Toca ', h('b', {}, 'Descargar'), '. Es un archivo grande, espera a que termine.'),
        h('li', {}, 'Abre el archivo desde la notificación de descarga.'),
        h('li', {}, 'Si Android pide permiso para ', h('b', {}, 'instalar apps desconocidas'), ', actívalo para Chrome y regresa.'),
        h('li', {}, 'Toca ', h('b', {}, 'Instalar'), ', ábrela e inicia sesión con los datos que te dé RH.')),
      !isAndroid() && h('p', { class: 'banner warn small' }, 'Esta app solo funciona en celulares Android.')), [['Cancelar', false], ['Descargar', true, 'primary']]);
    if (!ok) return;
    const link = h('a', { href: absUrl(a.url_instalar), download: a.nombre.replace(/\W+/g, '') + '.apk' });
    document.body.append(link); link.click(); link.remove();
    return;
  }
  if (isAndroid() && a.android_package && a.tipo === 'playstore') {
    location.href = `intent://details?id=${a.android_package}#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=${encodeURIComponent(a.url_instalar || ('https://play.google.com/store/apps/details?id=' + a.android_package))};end`;
    return;
  }
  window.open(a.url_instalar || a.url_abrir, '_blank', 'noopener');
}

function appIcon(a, big) { return h('span', { class: 'app-ic' + (big ? ' big' : ''), style: `background:${a.color || '#2b4c78'}` }, a.icono || '📱'); }

function accesosGrid(list, conVerTodo) {
  return h('div', { class: 'acc-grid' },
    list.map(a => h('button', { class: 'acc', onclick: () => abrirApp(a) }, appIcon(a, true), h('span', {}, a.nombre))),
    conVerTodo && h('button', { class: 'acc', onclick: () => appsView('accesos') }, h('span', { class: 'app-ic big more' }, '＋'), h('span', {}, 'Ver todo')));
}

async function appsView(tab = 'instalar', back) {
  const prev = state.tab;
  back = back || (() => go(prev));
  const body = h('div', {}, loading());
  screen('Apps', body, { back });
  let l;
  try { l = await api('apps'); } catch (e) { return fill(body, errorBox(e)); }
  const boton = a => {
    if (a.tipo === 'web') return h('button', { class: 'btn sm primary', onclick: () => abrirApp(a) }, 'Abrir');
    if (instalada(a)) return h('button', { class: 'btn sm primary', onclick: () => abrirApp(a, () => draw()) }, 'Abrir');
    return h('button', { class: 'btn sm', onclick: () => { instalarApp(a); esperando = a.app_id; } }, a.tipo === 'apk' ? 'Descargar' : 'Instalar');
  };
  let esperando = null;
  // al volver de la Play Store, ofrece validar con "Abrir"
  const alVolver = () => { if (!document.hidden && esperando && document.body.contains(body)) draw(); };
  document.addEventListener('visibilitychange', alVolver);
  const draw = () => fill(body,
    segmented([['instalar', 'Instalar'], ['accesos', 'Accesos']], tab, t => { tab = t; draw(); }),
    !l.length ? empty('📱', 'No hay apps para tu puesto.') : tab === 'accesos'
      ? [accesosGrid(l, false), h('p', { class: 'muted small' }, isAndroid() ? 'Si la app no está instalada, te ofrece instalarla.' : 'En iPhone algunas abren su página en la tienda.')]
      : [h('p', { class: 'muted small' }, isAndroid() ? 'Instala cada una. Cuando ya la tengas, el botón cambia a "Abrir": al tocarlo se comprueba que esté instalada e inicias sesión.' : 'Instala cada una, inicia sesión y toca "Ya la tengo".'),
        l.map(a => h('div', { class: 'app-row' + (instalada(a) ? ' ok' : '') }, appIcon(a),
          h('div', { class: 'grow' }, h('strong', {}, a.nombre, a.requerida ? '' : h('small', { class: 'muted' }, ' · opcional')),
            h('small', { class: 'muted block' }, a.descripcion || ''),
            verificable(a) && esperando === a.app_id && !instalada(a) && h('button', { class: 'link small', onclick: () => abrirApp(a, () => { esperando = null; draw(); }) }, '¿Ya la instalaste? Toca para comprobar')),
          h('div', { class: 'app-act' }, boton(a),
            verificable(a) ? (instalada(a) ? h('span', { class: 'chk on' }, '✓ Instalada') : null)
              : h('button', { class: 'chk' + (a.lista ? ' on' : ''), onclick: async () => {
                try { await api('marcarApp', { app_id: a.app_id, lista: !a.lista }); a.lista = !a.lista; instLocal.set(a.app_id, a.lista); draw(); } catch (e) { toast(e.message, 'error'); }
              } }, a.lista ? '✓ Lista' : 'Ya la tengo'))))]);
  draw();
}

async function bienvenidaView() {
  const prev = state.tab === 'mas' ? 'mas' : 'inicio';
  const body = h('div', {}, loading());
  screen('Tu bienvenida', body, { back: () => go(prev) });
  let b;
  try { b = await api('bienvenida'); } catch (e) { return fill(body, errorBox(e)); }
  if (!b.rol) return fill(body, h('div', { class: 'card' }, h('h3', {}, '¿Cuál es tu puesto?'), h('p', { class: 'muted' }, 'Así te mostramos solo los pasos que te tocan.'),
    h('div', { class: 'grid2' }, [['repartidor', '🛵 Repartidor'], ['otro', '🏢 Otro puesto']].map(([k, l]) => h('button', { class: 'btn block', onclick: async () => {
      try { await busy('Guardando…', () => api('elegirRol', { rol: k })); bienvenidaView(); } catch (e) { toast(e.message, 'error'); }
    } }, l)))));
  const actual = b.pasos.findIndex(x => !x.hecho);
  const accion = x => {
    if (x.id === 'documentos') return [x.rechazados ? h('p', { class: 'small late' }, `${x.rechazados} documento(s) por corregir`) : null,
      h('button', { class: 'btn primary', onclick: () => documentosView(() => bienvenidaView()) }, '📷 Subir mis documentos'),
      h('p', { class: 'muted tiny' }, 'Con la cámara de tu celular o un PDF. RH los revisa aquí mismo.')];
    if (x.id === 'apps') return [x.faltan && x.faltan.length ? h('p', { class: 'small' }, 'Te faltan: ', x.faltan.join(', ')) : null,
      h('button', { class: 'btn primary', onclick: () => appsView('instalar', () => bienvenidaView()) }, 'Ver apps')];
    if (x.id === 'checador') return [h('ol', { class: 'small steps-ol' }, h('li', {}, 'En la base, pide a RH que registre tu huella en el checador (con tu número de empleado).'),
      h('li', {}, 'Haz tu primera checada poniendo tu dedo.'), h('li', {}, 'Este paso se marca solo cuando llega tu primera checada.')),
      h('button', { class: 'btn', onclick: () => bienvenidaView() }, 'Ya lo hice, revisar')];
    if (x.id === 'notificaciones') return pushCard() || h('button', { class: 'btn', onclick: () => bienvenidaView() }, 'Revisar');
    if (x.id === 'datos') return h('div', { class: 'row gap8 wrap' },
      h('button', { class: 'btn primary', onclick: async () => { try { const p = await api('perfil'); domicilioView({ domicilio: p.domicilio, back: () => bienvenidaView() }); } catch (e) { toast(e.message, 'error'); } } }, '🏠 Mi domicilio'),
      h('button', { class: 'btn', onclick: async () => { try { const p = await api('perfil'); contactosView({ contactos: p.contactos, back: () => bienvenidaView() }); } catch (e) { toast(e.message, 'error'); } } }, '🚨 Contactos'));
    return null;
  };
  fill(body,
    b.completa ? h('div', { class: 'card done-card' }, h('div', { class: 'big-emoji' }, '🎉'), h('h3', {}, '¡Listo, terminaste tu bienvenida!'), h('p', { class: 'muted' }, 'Ya tienes todo para trabajar. Tus apps están en Accesos directos.'))
      : h('div', {}, h('div', { class: 'bar' }, h('span', { style: `width:${Math.round(b.hechos / b.total * 100)}%` })), h('p', { class: 'muted small' }, `${b.hechos} de ${b.total} pasos · ${b.rol === 'repartidor' ? 'Repartidor' : 'Oficina / otro puesto'}`)),
    b.pasos.map((x, i) => h('div', { class: 'step ' + (x.hecho ? 'done' : i === actual ? 'todo' : 'locked') },
      h('div', { class: 'step-n' }, x.hecho ? '✓' : i + 1),
      h('div', { class: 'step-body' }, h('h3', {}, x.titulo),
        h('p', { class: 'muted' }, x.hecho ? (x.auto ? 'Listo' : x.fecha ? 'Listo · ' + fecha(x.fecha) : 'Listo') : x.detalle),
        !x.hecho && i === actual && accion(x),
        x.hecho && x.id === 'documentos' && h('button', { class: 'link', onclick: () => documentosView(() => bienvenidaView()) }, 'Ver mis documentos'),
        x.hecho && x.id === 'apps' && h('button', { class: 'link', onclick: () => appsView('instalar', () => bienvenidaView()) }, 'Ver mis apps')))));
}

VIEWS.asistencia = async function asistencia(periodo, noEmpleado, nombre) {
  periodo = periodo || periodoDe(new Date());
  const admin = !!noEmpleado;
  const body = h('div', {}, loading());
  screen(admin ? nombre : 'Mi asistencia', body, admin ? { back: () => go('equipo', periodo), sub: 'Asistencia' } : {});
  let a;
  try { a = admin ? await api('asistenciaDe', { no_empleado: noEmpleado, periodo }) : (await cached('asistencia', { periodo }, live(() => VIEWS.asistencia(periodo)))).data; }
  catch (e) { return fill(body, errorBox(e)); }
  const t = a.totales;
  const ver = p => admin ? VIEWS.asistencia(p, noEmpleado, nombre) : (state.tab = 'asistencia', VIEWS.asistencia(p));
  const dias = a.dias.filter(d => !['FUTURO', 'SIN_DATOS'].includes(d.estado) || d.marcas.length).reverse();
  fill(body,
    periodoPicker(periodo, ver),
    a.horario && !a.sin_horario ? h('p', { class: 'muted small center' }, `Horario: entrada ${a.horario.entrada} · ${a.horario.dias} · comida ${a.horario.comida} min · tolerancia 0 min`)
      : h('div', { class: 'banner warn' }, 'No tienes horario capturado en el checador; por eso no se calculan retardos ni faltas. Avísale a RH.'),
    a.cuenta_desde > a.periodo.desde && h('p', { class: 'muted small center' }, `Se cuenta desde el ${fecha(a.cuenta_desde)}.`),
    h('div', { class: 'kpis' },
      kpi('Minutos tarde', hm(t.min_tarde), `${t.retardos} entrada(s) tarde`, t.min_tarde ? 'warn' : ''),
      kpi('Comida extra', hm(t.min_comida_extra), `${t.retardos_comida} vez(es)`, t.min_comida_extra ? 'warn' : ''),
      kpi('Faltas', t.faltas, `${t.horas_faltas} h · ${t.justificadas} justificada(s)`, t.faltas ? 'err' : ''),
      kpi('Total a descontar', num(t.horas_descuento, 2) + ' h', `${hm(t.min_total)} retraso + faltas`, t.horas_descuento ? 'warn' : 'ok')),
    section('Día por día'),
    dias.length ? h('div', { class: 'days' }, dias.map(d => h('div', { class: 'day st-' + d.estado },
      h('div', { class: 'day-d' }, h('strong', {}, d.fecha.slice(8)), h('span', {}, d.dia)),
      h('div', { class: 'day-b' },
        h('div', { class: 'row between' }, estadoBadge(d.estado),
          d.min_tarde > 0 ? h('strong', { class: 'late' }, `+${d.min_tarde} min`) : d.entrada ? h('span', { class: 'ok-t' }, d.entrada) : null),
        d.entrada && h('p', { class: 'small' }, `Entró ${d.entrada}`, d.debia && h('span', { class: 'muted' }, ` · debía ${d.debia}`)),
        d.min_comida != null && h('p', { class: 'small' }, `Comida ${d.min_comida} min`, d.min_comida_extra > 0 && h('strong', { class: 'late' }, ` (+${d.min_comida_extra})`)),
        d.motivo && h('p', { class: 'small muted' }, d.motivo),
        d.marcas.length > 1 && h('p', { class: 'small muted' }, d.marcas.map(m => `${TIPO_MARCA[m.tipo]} ${m.hora}`).join(' · ')))))) : empty('🗓️', 'Sin días que mostrar en esta quincena.'),
    !admin && h('button', { class: 'btn block', onclick: () => nuevaSolicitud('justificante') }, '🩺 Justificar una falta'),
  );
};

VIEWS.nomina = async function nomina(tab = 'recibos') {
  state.tab = 'nomina';
  const body = h('div', {}, segmented([['recibos', 'Recibos'], ['pagos', 'Depósitos']], tab, t => VIEWS.nomina(t)), loading());
  screen('Mi nómina', body);
  try {
    if (tab === 'recibos') {
      const { data: l } = await cached('recibos', {}, live(() => VIEWS.nomina(tab)));
      fill(body, body.firstChild,
        l.length ? l.map(r => h('button', { class: 'card tap rec', onclick: () => reciboView(r.recibo_id) },
          h('div', { class: 'row between' }, h('div', {}, h('h3', {}, r.etiqueta), h('span', { class: 'muted small' }, `${fecha(r.desde)} – ${fecha(r.hasta)} · ${r.recibo_id}`)),
            h('strong', { class: 'amount big' }, money(r.neto))),
          h('div', { class: 'row between', style: 'margin-top:8px' }, reciboBadges(r), r.fecha_pago && h('span', { class: 'muted small' }, 'Pagado ' + fecha(r.fecha_pago)))))
          : empty('🧾', 'Cuando RH emita tu recibo de nómina aparecerá aquí y te llegará un aviso.'));
    } else {
      const { data: l } = await cached('pagos', {}, live(() => VIEWS.nomina(tab)));
      const total = l.filter(p => p.fecha.slice(0, 4) === String(new Date().getFullYear())).reduce((s, p) => s + p.monto, 0);
      fill(body, body.firstChild,
        l.length ? [h('div', { class: 'kpis one' }, kpi('Depositado este año', money(total), `${l.length} depósito(s) registrados`)),
          l.map(p => h('div', { class: 'card pay' },
            h('div', { class: 'row between' }, h('div', {}, h('h3', { class: 'amount' }, money(p.monto)), h('span', { class: 'muted small cap' }, p.concepto)),
              h('span', { class: 'muted small right' }, fecha(p.fecha), h('br'), p.fecha.slice(11, 16))),
            h('div', { class: 'row between small', style: 'margin-top:6px' },
              h('span', { class: 'muted mono' }, p.clave_rastreo && !/^MANUAL/.test(p.clave_rastreo) ? 'Rastreo ' + p.clave_rastreo : p.origen === 'manual' ? 'Pago registrado por RH' : ''),
              p.recibo_id ? h('button', { class: 'link', onclick: () => reciboView(p.recibo_id) }, 'Ver recibo') : null)))]
          : empty('💸', 'Aquí verás cada depósito de nómina en cuanto salga de la cuenta de la empresa.'));
    }
  } catch (e) { fill(body, body.firstChild, errorBox(e)); }
};

async function reciboView(id, back) {
  const body = h('div', {}, loading());
  screen('Recibo de nómina', body, { back: back || (() => go(modoPatron() ? 'pnomina' : 'nomina', modoPatron() ? 'recibos' : undefined)) });
  let r;
  try { r = await api('recibo', { recibo_id: id }); } catch (e) { return fill(body, errorBox(e)); }
  const propio = r.no_empleado === session.user.no_empleado;
  const a = r.detalle.asistencia || {};
  const line = (l, v, sub) => v ? h('div', { class: 'rl' }, h('span', {}, l, sub && h('small', { class: 'muted' }, ' ' + sub)), h('span', { class: 'amount' }, money(v))) : null;
  if (r.historico) return fill(body,
    h('div', { class: 'receipt' },
      h('div', { class: 'r-head' }, h('div', {}, h('span', { class: 'muted small' }, 'Comercializadora Computenga'), h('h2', {}, r.etiqueta), h('span', { class: 'muted small' }, `${r.nombre} · No. ${r.no_empleado}`)),
        h('span', { class: 'muted small mono' }, r.recibo_id)),
      h('div', { class: 'r-neto' }, h('span', {}, 'Neto pagado'), h('strong', {}, money(r.neto))),
      reciboBadges(r),
      h('p', { class: 'small', style: 'margin-top:12px' }, '📜 ', r.detalle.notas || 'Recibo histórico: monto neto que se pagó, sin desglose.'),
      r.desde && h('p', { class: 'muted small' }, `Periodo ${fecha(r.desde)} – ${fecha(r.hasta)}`),
      h('p', { class: 'muted tiny' }, 'Comprobante interno. No sustituye al CFDI de nómina.')));
  fill(body,
    h('div', { class: 'receipt' },
      h('div', { class: 'r-head' }, h('div', {}, h('span', { class: 'muted small' }, 'Comercializadora Computenga'), h('h2', {}, r.etiqueta), h('span', { class: 'muted small' }, `${r.nombre} · No. ${r.no_empleado}`)),
        h('span', { class: 'muted small mono' }, r.recibo_id)),
      h('div', { class: 'r-neto' }, h('span', {}, 'Neto a pagar'), h('strong', {}, money(r.neto))),
      reciboBadges(r),
      h('h3', { class: 'r-sec' }, 'Percepciones'),
      line(`Sueldo`, r.sueldo, `${r.dias} días × ${money(r.salario_diario)}`), line('Bonos', r.bonos, r.detalle.concepto_bonos), line('Otras percepciones', r.otras_percepciones, r.detalle.concepto_otras),
      h('div', { class: 'rl tot' }, h('span', {}, 'Total percepciones'), h('span', { class: 'amount' }, money(r.total_percepciones))),
      h('h3', { class: 'r-sec' }, 'Deducciones'),
      line('Faltas', r.desc_faltas, a.faltas != null ? `${a.faltas} día(s)` : ''), line('Retardos', r.desc_retardos, a.min_total != null ? hm(a.min_total) + ' h' : ''),
      line('Cargos de flotilla', r.desc_cargos), line('Abono a adeudos', r.desc_adeudos), line('Otras deducciones', r.otras_deducciones),
      !r.total_deducciones && h('p', { class: 'muted small' }, 'Sin deducciones 🎉'),
      h('div', { class: 'rl tot' }, h('span', {}, 'Total deducciones'), h('span', { class: 'amount' }, money(r.total_deducciones))),
      (r.detalle.cargos || []).length > 0 && h('div', {}, h('h3', { class: 'r-sec' }, 'Detalle de cargos'), r.detalle.cargos.map(c => line(`${c.vehiculo_id} · ${c.descripcion}`, c.monto, fecha(c.fecha)))),
      (r.detalle.abonos || []).length > 0 && h('div', {}, h('h3', { class: 'r-sec' }, 'Detalle de abonos'), r.detalle.abonos.map(x => line(x.concepto, x.monto))),
      r.detalle.notas && h('p', { class: 'small', style: 'margin-top:12px' }, '📝 ', r.detalle.notas),
      h('p', { class: 'muted small', style: 'margin-top:14px' }, `Emitido ${fechaHora(r.fecha_emision)}`, r.firma_fecha && ` · Firmado ${fechaHora(r.firma_fecha)}`, r.fecha_pago && ` · Pagado ${fechaHora(r.fecha_pago)}`),
      h('p', { class: 'muted tiny' }, 'Comprobante interno. No sustituye al CFDI de nómina.')),
    propio && !r.firma_fecha && r.estatus !== 'cancelado' && h('button', { class: 'btn primary block', onclick: async () => {
      const pin = await pinModal('Firmar de recibido', `Confirmas que revisaste tu recibo de la ${r.etiqueta} por ${money(r.neto)}.`);
      if (!pin) return;
      try { await busy('Firmando…', () => api('firmarRecibo', { recibo_id: id, pin, dispositivo: navigator.userAgent })); toast('Recibo firmado', 'ok'); reciboView(id, back); }
      catch (e) { toast(e.message, 'error'); }
    } }, '✍️ Firmar de recibido'),
    h('button', { class: 'btn block', onclick: async () => {
      try { const f = await busy('Descargando…', () => api('reciboPdf', { recibo_id: id })); openBase64(f); } catch (e) { toast(e.message, 'error'); }
    } }, '⬇️ Descargar PDF'),
    modoPatron() && r.estatus !== 'cancelado' && h('button', { class: 'btn danger-o block', onclick: async () => {
      if (!await confirmar('Cancelar recibo', `Se cancela ${r.recibo_id} de ${r.nombre}. Los abonos a adeudos se regresan y el pago (si tiene) queda sin recibo.`, 'Cancelar recibo', 'danger')) return;
      try { await busy('Cancelando…', () => api('cancelarRecibo', { recibo_id: id })); toast('Recibo cancelado', 'ok'); go('pnomina', 'recibos'); } catch (e) { toast(e.message, 'error'); }
    } }, 'Cancelar recibo'),
  );
}

VIEWS.solicitudes = async function solicitudes() {
  const body = h('div', {}, loading());
  screen('Solicitudes', body, { actions: h('button', { class: 'icon-btn', 'aria-label': 'Nueva', onclick: () => nuevaSolicitud() }, '＋') });
  try {
    const [{ data: l }, { data: pf }] = await Promise.all([cached('solicitudes', {}, live(solicitudes)), cached('perfil', {}, live(solicitudes))]);
    const v = pf.vacaciones;
    fill(body,
      h('div', { class: 'card vac' },
        h('div', { class: 'row between' }, h('h3', {}, '🏖️ Vacaciones'), v.sin_fecha ? null : h('strong', { class: 'big' }, v.disponibles, h('small', { class: 'muted' }, ' días'))),
        v.sin_fecha ? h('p', { class: 'muted small' }, 'RH aún no captura tu fecha de ingreso.')
          : v.derecho ? [h('div', { class: 'bar' }, h('span', { style: `width:${Math.min(100, (v.tomados / v.derecho) * 100)}%` })),
            h('p', { class: 'muted small' }, `${v.tomados} de ${v.derecho} usados en tu año ${v.anios} de servicio (desde ${fecha(v.desde)}). Próximo aniversario ${fecha(v.proximo_aniversario)}: ${v.dias_proximo} días.`)]
            : h('p', { class: 'muted small' }, `Al cumplir tu primer año (${fecha(v.proximo_aniversario)}) tendrás ${v.dias_proximo} días, según la LFT.`)),
      h('div', { class: 'quick' },
        [['justificante', '🩺', 'Justificar falta'], ['permiso', '🙋', 'Permiso'], ['vacaciones', '🏖️', 'Vacaciones'], ['anticipo', '💳', 'Anticipo']].map(([t, i, l]) =>
          h('button', { class: 'q', onclick: () => nuevaSolicitud(t) }, h('span', {}, i), l))),
      section('Mis solicitudes'),
      l.length ? l.map(s => solCard(s)) : empty('📝', 'No has hecho solicitudes.'));
  } catch (e) { fill(body, errorBox(e)); }
};

const SOL_EST = { pendiente: ['En revisión', 'warn'], aprobada: ['Aprobada', 'ok'], rechazada: ['Rechazada', 'err'] };
function solCard(s, actions) {
  const [l, c] = SOL_EST[s.estatus] || [s.estatus, 'muted'];
  return h('div', { class: 'card sol s-' + s.estatus },
    h('div', { class: 'row between' }, h('h3', {}, s.tipo_txt), h('span', { class: 'badge b-' + c }, l)),
    actions && h('p', { class: 'small' }, h('strong', {}, s.nombre), ` · No. ${s.no_empleado}`),
    s.fecha_desde && h('p', { class: 'small' }, '📅 ', fecha(s.fecha_desde), s.fecha_hasta && s.fecha_hasta !== s.fecha_desde ? ` → ${fecha(s.fecha_hasta)}` : '', s.dias ? ` · ${s.dias} día(s) laboral(es)` : ''),
    s.monto > 0 && h('p', { class: 'small' }, '💵 ', money(s.monto)),
    s.motivo && h('p', { class: 'small muted' }, s.motivo),
    s.evidencia && h('p', { class: 'small' }, '📎 Con evidencia adjunta'),
    s.comentario && h('p', { class: 'small' }, h('strong', {}, 'RH: '), s.comentario),
    h('p', { class: 'muted tiny' }, `${s.sol_id} · ${fechaHora(s.fecha_solicitud)}`, s.fecha_resolucion && ` · resuelta ${fechaHora(s.fecha_resolucion)}`),
    actions || null);
}

async function nuevaSolicitud(tipo = 'justificante') {
  const hoy = new Date().toISOString().slice(0, 10);
  let evidencia = null;
  const st = { tipo };
  const desde = h('input', { class: 'input', type: 'date', value: tipo === 'justificante' ? hoy : '' });
  const hasta = h('input', { class: 'input', type: 'date' });
  const monto = h('input', { class: 'input big', type: 'number', inputmode: 'decimal', placeholder: '0.00' });
  const motivo = h('textarea', { class: 'input', rows: 3, placeholder: 'Cuéntale a RH el motivo' });
  const evBox = h('div');
  const drawEv = () => fill(evBox, evidencia
    ? h('div', { class: 'row between card soft' }, h('span', {}, '📎 ', evidencia.name || 'Archivo'), h('button', { class: 'link danger', onclick: () => { evidencia = null; drawEv(); } }, 'Quitar'))
    : h('button', { class: 'btn', onclick: async () => { const f = await pickFile(); if (f) { evidencia = await readFile(f); drawEv(); } } }, '📎 Adjuntar foto o PDF (receta, comprobante…)'));
  drawEv();
  const form = h('div');
  const draw = () => fill(form,
    h('div', { class: 'chips' }, [['justificante', '🩺 Justificante'], ['permiso', '🙋 Permiso'], ['vacaciones', '🏖️ Vacaciones'], ['anticipo', '💳 Anticipo'], ['otro', 'Otro']].map(([k, l]) =>
      h('button', { class: 'chip ' + (st.tipo === k ? 'on' : ''), onclick: () => { st.tipo = k; draw(); } }, l))),
    st.tipo !== 'anticipo' && st.tipo !== 'otro' && h('div', { class: 'grid2' },
      h('div', {}, h('label', { class: 'label' }, st.tipo === 'justificante' ? 'Día de la falta' : 'Desde'), desde),
      h('div', {}, h('label', { class: 'label' }, 'Hasta (opcional)'), hasta)),
    st.tipo === 'anticipo' && h('div', {}, h('label', { class: 'label' }, 'Monto que necesitas'), monto,
      h('p', { class: 'muted small' }, 'Si se aprueba, se descuenta de tus siguientes quincenas.')),
    h('label', { class: 'label' }, st.tipo === 'vacaciones' ? 'Comentario (opcional)' : 'Motivo'), motivo,
    ['justificante', 'permiso', 'otro'].includes(st.tipo) && evBox,
    h('button', { class: 'btn primary block', onclick: enviar }, 'Enviar solicitud'));
  const enviar = async () => {
    try {
      await busy('Enviando…', async () => {
        let ev = '';
        if (evidencia && ['justificante', 'permiso', 'otro'].includes(st.tipo)) ev = (await api('subirEvidencia', { base64: evidencia.base64, mime: evidencia.mime })).id;
        await api('crearSolicitud', { tipo: st.tipo, fecha_desde: desde.value, fecha_hasta: hasta.value || desde.value, monto: monto.value, motivo: motivo.value, evidencia: ev });
      });
      toast('Solicitud enviada. Te avisamos cuando RH responda.', 'ok', 4500);
      go('solicitudes');
    } catch (e) { toast(e.message, 'error', 5000); }
  };
  draw();
  screen('Nueva solicitud', form, { back: () => go('solicitudes') });
}

VIEWS.mas = async function mas() {
  const u = session.user;
  const body = h('div', {},
    h('div', { class: 'card row', style: 'gap:12px' }, h('div', { class: 'avatar' }, iniciales(u.nombre)),
      h('div', {}, h('h3', {}, u.nombre), h('p', { class: 'muted small' }, `No. ${u.no_empleado}${u.puesto ? ' · ' + u.puesto : ''}`))),
    isPatron() && h('button', { class: 'card tap row between switch', onclick: () => { session.modo = 'patron'; start(); } },
      h('div', {}, h('h3', {}, '🏢 Cambiar a modo patrón'), h('p', { class: 'muted small' }, 'Panel, prenómina, recibos, pagos y personal')), h('span', { class: 'chev' }, '›')),
    menu([
      ['👋', 'Mi bienvenida', 'Pasos para empezar a trabajar', bienvenidaView],
      isAdmin() && !isPatron() && ['🧭', 'Rutas y reporte', 'Ruteador, rutas publicadas y reporte de Shipday', () => rutasAdminView()],
      isAdmin() && !isPatron() && ['📦', 'Recolecciones', 'Asignación de recolecciones del día', () => recoleccionesView()],
      isAdmin() && !isPatron() && ['🏆', 'Desempeño de repartidores', 'Entregas por día, semana y mes y jerarquía', () => entregasEquipoView()],
      isAdmin() && !isPatron() && ['🚨', 'Emergencias', 'Contactos de emergencia y domicilios', () => emergenciasView()],
      state.flotilla && ['🛵', 'Flotilla', state.flotilla.rol === 'repartidor' ? 'Check de moto, gasolina, fallas y cargos' : 'Fallas, reparaciones, documentos y métricas', () => flotillaView()],
      esRepartidor() && ['🗺️', 'Mi ruta', 'Paradas en orden y mapa', () => rutaView()],
      esRepartidor() && ['📦', 'Mis entregas', 'Entregas por día, semana y mes y tu lugar', () => desempenoView()],
      esRepartidor() && ['📱', 'Apps y accesos', 'Instala y abre tus apps de trabajo', () => appsView('instalar')],
      ['👤', 'Mis datos', 'Domicilio, contactos de emergencia, RFC, CLABE, horario', perfilView],
      ['💳', 'Adeudos y cargos', 'Préstamos, anticipos y cargos de flotilla', adeudosView],
      ['📄', 'Mis documentos', 'Sube tus documentos y ve los de RH', () => documentosView()],
      ['🔔', 'Notificaciones', 'Tu bandeja de avisos', () => bandeja()],
      ['🔑', 'Cambiar PIN', '', cambiarPin],
    ]),
    pushCard() || h('p', { class: 'muted small center' }, pushState() === 'granted' ? '🔔 Notificaciones activas en este teléfono' : ''),
    h('button', { class: 'btn danger-o block', onclick: () => { session.clear(); location.reload(); } }, 'Cerrar sesión'),
    h('p', { class: 'muted small center' }, 'Portal Packatelas · v' + (window.APP_VERSION || '1')));
  screen('Más', body);
};

function menu(items) {
  return h('div', { class: 'menu' }, items.filter(Boolean).map(([i, t, s, fn, badge]) => h('button', { class: 'mi', onclick: fn },
    h('span', { class: 'mi-i' }, i), h('span', { class: 'mi-t' }, h('strong', {}, t), s && h('small', { class: 'muted' }, s)),
    badge ? h('span', { class: 'badge b-warn' }, badge) : null, h('span', { class: 'chev' }, '›'))));
}

async function perfilView() {
  const body = h('div', {}, loading());
  screen('Mis datos', body, { back: () => go('mas') });
  try {
    const { data: p } = await cached('perfil', {}, live(perfilView));
    const row = (l, v) => h('div', { class: 'kv' }, h('span', { class: 'muted' }, l), h('strong', {}, v || '—'));
    fill(body,
      h('div', { class: 'card' }, row('Nombre', p.nombre), row('No. empleado', p.no_empleado), row('Puesto', p.puesto), row('Área', p.area),
        row('Ingreso', p.fecha_ingreso ? fecha(p.fecha_ingreso) : ''), row('Antigüedad', p.antiguedad)),
      h('div', { class: 'card' }, row('RFC', p.rfc), row('CURP', p.curp), row('NSS', p.nss)),
      h('div', { class: 'card' }, row('Cuenta de nómina', p.clabe ? `${p.banco || ''} ${p.clabe}` : ''), row('Teléfono', p.telefono), row('Correo', p.correo)),
      h('div', { class: 'card' }, row('Hora de entrada', p.horario.entrada), row('Días laborales', p.horario.dias), row('Comida', p.horario.comida ? p.horario.comida + ' min' : ''),
        row('Huella en checador', p.celular_checador ? 'Registrada ✓' : 'Sin checadas aún')),
      section('Domicilio y emergencias'),
      datosCards(p, { back: perfilView }),
      h('p', { class: 'muted small center' }, '¿Algún otro dato está mal? Avísale a RH para corregirlo.'));
  } catch (e) { fill(body, errorBox(e)); }
}

async function adeudosView() {
  const body = h('div', {}, loading());
  screen('Adeudos y cargos', body, { back: () => go(state.tab === 'inicio' ? 'inicio' : 'mas') });
  try {
    const { data: d } = await cached('adeudos', {}, live(adeudosView));
    const verCargos = esRepartidor() || d.cargos.length > 0;
    fill(body,
      h('div', { class: 'kpis' + (verCargos ? '' : ' one') }, kpi('Saldo de préstamos', money(d.saldo_total), 'se descuenta por quincena', d.saldo_total ? 'warn' : 'ok'),
        verCargos && kpi('Cargos flotilla', money(d.cargos_pendientes), 'por descontar', d.cargos_pendientes ? 'warn' : 'ok')),
      section('Préstamos y anticipos'),
      d.adeudos.length ? d.adeudos.map(a => h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('h3', {}, a.concepto), h('span', { class: 'badge b-' + (a.estatus === 'activo' ? 'warn' : 'ok') }, a.estatus === 'activo' ? 'Activo' : 'Liquidado')),
        h('div', { class: 'bar' }, h('span', { style: `width:${a.monto_total ? Math.round((1 - a.saldo / a.monto_total) * 100) : 100}%` })),
        h('p', { class: 'small' }, `Saldo ${money(a.saldo)} de ${money(a.monto_total)} · ${money(a.cuota)} por quincena`),
        h('p', { class: 'muted tiny' }, `${a.adeudo_id} · desde ${fecha(a.fecha_alta)}`),
        d.abonos.filter(x => x.adeudo_id === a.adeudo_id).length > 0 && h('details', {}, h('summary', { class: 'small' }, 'Abonos'),
          d.abonos.filter(x => x.adeudo_id === a.adeudo_id).map(x => h('p', { class: 'small row between' }, h('span', {}, fecha(x.fecha) + ' · ' + x.recibo_id), h('span', { class: 'amount' }, money(x.monto)))))))
        : empty('✅', 'Sin préstamos.'),
      verCargos && section('Cargos de flotilla'),
      !verCargos ? null : d.cargos.length ? d.cargos.map(c => h('div', { class: 'card falla' },
        h('div', { class: 'row between' }, h('h3', {}, `${c.vehiculo_id} · ${money(c.monto)}`), h('span', { class: 'badge b-' + (c.estatus === 'pendiente' ? 'warn' : 'ok') }, c.estatus === 'pendiente' ? 'Por descontar' : 'Descontado')),
        h('p', { class: 'small' }, c.descripcion), h('p', { class: 'muted tiny' }, `${c.rep_id} · ${fecha(c.fecha)}${c.recibo_id ? ' · ' + c.recibo_id : ''}${c.costo_total ? ' · costo total ' + money(c.costo_total) : ''}`)))
        : empty('🛵', 'Sin cargos de la flotilla.'));
  } catch (e) { fill(body, errorBox(e)); }
}

async function documentosView(back) {
  const prev = state.tab;
  const body = h('div', {}, loading());
  screen('Mis documentos', body, { back: back || (() => go(prev || 'mas')) });
  try {
    const [md, rh] = await Promise.all([api('misDocumentos'), api('documentos').catch(() => [])]);
    const redraw = () => documentosView(back);
    fill(body,
      md.rechazados > 0 && h('div', { class: 'banner error' }, `Tienes ${md.rechazados} documento(s) por corregir. Revisa el motivo y súbelo otra vez.`),
      h('p', { class: 'muted small' }, `${md.subidos} de ${md.requeridos} subidos · ${md.aprobados} aprobados por RH`),
      docsList(md.documentos, { editable: true, onUpload: async (d, file) => { await api('subirMiDocumento', { doc_id: d.doc_id, base64: file.base64, mime: file.mime }); redraw(); } }),
      rh.length > 0 && [section('De RH'), h('div', { class: 'menu' }, rh.map(d => h('button', { class: 'mi', onclick: async () => {
        try { openBase64(await busy('Abriendo…', () => api('documento', { id: d.id }))); } catch (e) { toast(e.message, 'error'); }
      } }, h('span', { class: 'mi-i' }, /pdf/.test(d.mime) ? '📕' : /image/.test(d.mime) ? '🖼️' : '📄'), h('span', { class: 'mi-t' }, h('strong', {}, d.nombre), h('small', { class: 'muted' }, `${fecha(d.fecha)} · ${Math.max(1, Math.round(d.tamano / 1024))} KB`)), h('span', { class: 'chev' }, '⬇︎'))))]);
  } catch (e) { fill(body, errorBox(e)); }
}

async function cambiarPin() {
  const actual = await pinModal('Cambiar PIN', 'Escribe tu PIN actual');
  if (!actual) return;
  const nuevo = await pinModal('Nuevo PIN', 'Escribe tu nuevo PIN de 6 dígitos');
  if (!nuevo) return;
  const rep = await pinModal('Confirma tu nuevo PIN', 'Escríbelo otra vez');
  if (rep !== nuevo) return toast('Los PIN no coinciden', 'warn');
  try { const s = await busy('Guardando…', () => api('cambiarPin', { actual, nuevo })); session.set(s.token, s.usuario); toast('PIN actualizado', 'ok'); } catch (e) { toast(e.message, 'error'); }
}

async function bandeja() {
  const prev = state.tab;
  const body = h('div', {}, loading());
  screen('Notificaciones', body, { back: () => go(prev) });
  try {
    const { data: l } = await cached('bandeja', {}, live(bandeja));
    const ICON = { alta: '🆕', documentos: '📄', documento_rechazado: '⚠️', bienvenida: '👋', recibo: '🧾', pago: '💸', solicitud: '📝', aviso: '📢', adeudo: '💳', documento: '📄', alerta: '⚠️' };
    fill(body,
      l.some(n => !n.leido) && h('div', { class: 'row', style: 'justify-content:flex-end' }, h('button', { class: 'link', onclick: async () => { await api('marcarLeido', { todos: true }); setBadge(0); bandeja(); } }, 'Marcar todo como leído')),
      l.length ? l.map(n => h('button', { class: 'card tap notif' + (n.leido ? '' : ' unread'), onclick: async () => {
        if (!n.leido) { api('marcarLeido', { ids: [n.notif_id] }).catch(() => {}); setBadge(Math.max(0, state.noLeidos - 1)); }
        if (n.tipo === 'recibo' && n.ref) return reciboView(n.ref, () => bandeja());
        if (n.tipo === 'pago') return go('nomina', 'pagos');
        if (n.tipo === 'solicitud') return go(modoPatron() ? 'pmas' : 'solicitudes');
        if (n.tipo === 'documento' || n.tipo === 'documento_rechazado') return documentosView(() => bandeja());
        if (n.tipo === 'alta' && modoPatron()) return altasAdmin();
        if (n.tipo === 'adeudo') return adeudosView();
        if (n.tipo === 'bienvenida' && !modoPatron()) return bienvenidaView();
        n.leido = true; bandeja();
      } }, h('span', { class: 'n-i' }, ICON[n.tipo] || '🔔'),
        h('span', { class: 'n-b' }, h('strong', {}, String(n.titulo).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '')), h('span', { class: 'small' }, n.mensaje), h('span', { class: 'muted tiny' }, fechaHora(n.fecha)))))
        : empty('🔕', 'No tienes notificaciones.'));
  } catch (e) { fill(body, errorBox(e)); }
}
function setBadge(n) {
  state.noLeidos = n || 0;
  const b = document.querySelector('.bell');
  if (b) fill(b, '🔔', state.noLeidos ? h('span', { class: 'dot' }, state.noLeidos > 9 ? '9+' : state.noLeidos) : null);
  if (navigator.setAppBadge) (state.noLeidos ? navigator.setAppBadge(state.noLeidos) : navigator.clearAppBadge()).catch(() => {});
}

// ═════════════════════ PATRÓN ═════════════════════

VIEWS.panel = async function panel() {
  const body = h('div', {}, h('p', { class: 'muted cap' }, hoyLargo()), loading());
  screen('Panel', body, { actions: h('button', { class: 'icon-btn', 'aria-label': 'Actualizar', onclick: () => panel() }, '↻') });
  let d;
  try { d = (await cached('panel', {}, live(panel))).data; } catch (e) { return fill(body, errorBox(e, panel)); }
  const hr = d.hoy_resumen, q = d.quincena, n = d.nomina, df = d.datos_faltantes;
  const faltan = [df.sin_rfc && `${df.sin_rfc} sin RFC`, df.sin_clabe && `${df.sin_clabe} sin CLABE`, df.sin_salario && `${df.sin_salario} sin salario`, df.sin_horario && `${df.sin_horario} sin horario en checador`].filter(Boolean);
  fill(body,
    h('p', { class: 'muted cap' }, hoyLargo()),
    faltan.length > 0 && h('button', { class: 'banner action warn', onclick: () => go('personal', 'incompletos') }, h('strong', {}, 'Completa los expedientes'), h('span', {}, faltan.join(' · ') + ' →')),
    d.altas_por_revisar > 0 && h('button', { class: 'banner action warn', onclick: () => altasAdmin() }, h('strong', {}, `🆕 ${d.altas_por_revisar} alta(s) lista(s) para revisar`), h('span', {}, (d.altas_en_proceso ? `${d.altas_en_proceso} más subiendo documentos · ` : '') + 'Revisar →')),
    d.docs_por_revisar > 0 && h('button', { class: 'banner action info', onclick: () => go('personal', 'docs') }, h('strong', {}, `📄 ${d.docs_por_revisar} documento(s) por revisar`), h('span', {}, 'Ver quiénes →')),
    d.bienvenida_pendiente > 0 && h('button', { class: 'banner action info', onclick: () => go('personal', 'bienvenida') }, h('strong', {}, `👋 ${d.bienvenida_pendiente} sin terminar su bienvenida`), h('span', {}, 'Ver quiénes →')),
    d.solicitudes_pendientes > 0 && h('button', { class: 'banner action info', onclick: () => solicitudesAdmin() }, h('strong', {}, `📝 ${d.solicitudes_pendientes} solicitud(es) por resolver`), h('span', {}, 'Revisar →')),
    n.pagos_no_cuadran > 0 && h('button', { class: 'banner action error', onclick: () => go('pnomina', 'pagos') }, h('strong', {}, `⚠️ ${n.pagos_no_cuadran} depósito(s) no cuadran con su recibo`), h('span', {}, 'Revisar →')),

    section('Hoy'),
    h('div', { class: 'kpis' },
      kpi('Presentes', `${hr.presentes}/${hr.esperados}`, 'checaron entrada', hr.presentes < hr.esperados ? 'warn' : 'ok'),
      kpi('Llegaron tarde', hr.tarde, 'tolerancia 0', hr.tarde ? 'warn' : ''),
      kpi('Sin checar', hr.faltan.length, 'de los esperados', hr.faltan.length ? 'err' : ''),
      kpi('Con push', `${d.con_push}/${d.total_personal}`, 'empleados con avisos')),
    hr.faltan.length > 0 && h('div', { class: 'card' }, h('h3', { class: 'small muted' }, 'SIN CHECAR'), h('div', { class: 'chips wrap' }, hr.faltan.map(f => h('span', { class: 'chip' }, `${f.nombre} · ${f.debia}`)))),
    hr.llegadas.length > 0 && h('details', { class: 'card' }, h('summary', {}, `Llegadas de hoy (${hr.llegadas.length})`),
      hr.llegadas.map(l => h('div', { class: 'kv' }, h('span', {}, l.nombre), h('strong', { class: l.min_tarde ? 'late' : 'ok-t' }, l.entrada + (l.min_tarde ? ` (+${l.min_tarde})` : ''))))),

    section(d.periodo.etiqueta),
    h('button', { class: 'kpis plain', onclick: () => go('equipo') },
      kpi('Retardos', q.retardos, `${num(q.horas_retraso, 2)} h acumuladas`, q.retardos ? 'warn' : ''),
      kpi('Faltas', q.faltas, 'sin justificar', q.faltas ? 'err' : ''),
      kpi('Recibos emitidos', n.recibos_periodo, 'esta quincena'),
      kpi('Anterior', n.recibos_periodo_anterior, d.periodo_anterior.etiqueta)),
    q.top.length > 0 && h('div', { class: 'card' }, h('h3', { class: 'small muted' }, 'MÁS DESCUENTOS EN LA QUINCENA'),
      q.top.map(t => h('div', { class: 'kv' }, h('span', {}, t.nombre), h('strong', { class: 'late' }, [t.faltas && `${t.faltas} falta(s)`, t.min_total && hm(t.min_total) + ' tarde'].filter(Boolean).join(' · '))))),

    section('Nómina'),
    h('div', { class: 'kpis' },
      kpi('Sin firmar', n.sin_firmar, 'recibos', n.sin_firmar ? 'warn' : 'ok'),
      kpi('Sin pagar', n.sin_pagar, 'recibos emitidos', n.sin_pagar ? 'warn' : 'ok'),
      kpi('Pagado 7 días', money0(n.pagos_semana), 'detectado en Fondeadora'),
      kpi('Expedientes', `${d.total_personal - df.sin_pin}/${d.total_personal}`, 'con acceso al portal')),
    h('div', { class: 'quick' },
      h('button', { class: 'q', onclick: () => go('pnomina', 'prenomina') }, h('span', {}, '🧮'), 'Prenómina'),
      h('button', { class: 'q', onclick: () => enviarAvisoView() }, h('span', {}, '📢'), 'Enviar aviso'),
      h('button', { class: 'q', onclick: () => solicitudesAdmin() }, h('span', {}, '📝'), 'Solicitudes'),
      h('button', { class: 'q', onclick: () => adeudosAdmin() }, h('span', {}, '💳'), 'Adeudos')),
    pushCard(),
  );
};

VIEWS.equipo = async function equipo(periodo) {
  periodo = periodo || periodoDe(new Date());
  const body = h('div', {}, loading());
  screen('Asistencia del equipo', body);
  let d;
  try { d = (await cached('asistenciaGeneral', { periodo }, live(() => VIEWS.equipo(periodo)))).data; } catch (e) { return fill(body, errorBox(e)); }
  const tot = d.empleados.reduce((a, e) => ({ f: a.f + e.totales.faltas, m: a.m + e.totales.min_total, j: a.j + e.totales.justificadas }), { f: 0, m: 0, j: 0 });
  fill(body,
    periodoPicker(periodo, p => VIEWS.equipo(p)),
    h('div', { class: 'kpis' }, kpi('Faltas', tot.f, `${tot.j} justificadas`, tot.f ? 'err' : ''), kpi('Retraso total', hm(tot.m) + ' h', 'entrada + comida', tot.m ? 'warn' : '')),
    section('Por empleado · toca para ver el detalle'),
    table([
      { t: 'Empleado', f: e => h('div', {}, h('strong', {}, e.nombre), h('div', { class: 'muted tiny' }, e.sin_horario ? '⚠️ sin horario' : e.hoy ? (e.hoy.entrada ? `hoy ${e.hoy.entrada}` + (e.hoy.min_tarde ? ` (+${e.hoy.min_tarde})` : '') : e.hoy.laboral ? 'hoy sin checar' : 'hoy descansa') : '')) },
      { t: 'Faltas', cls: 'num', f: e => e.totales.faltas || '—' },
      { t: 'Tarde', cls: 'num', f: e => e.totales.min_tarde ? hm(e.totales.min_tarde) : '—' },
      { t: 'Comida', cls: 'num', f: e => e.totales.min_comida_extra ? hm(e.totales.min_comida_extra) : '—' },
      { t: 'Desc. h', cls: 'num', f: e => e.totales.horas_descuento ? h('strong', { class: 'late' }, num(e.totales.horas_descuento, 2)) : '—' },
    ], d.empleados, e => { state.tab = 'equipo'; VIEWS.asistencia(periodo, e.no_empleado, e.nombre); }),
    h('p', { class: 'muted small' }, 'Mismas reglas que el dashboard del checador: tolerancia 0, minutos de entrada tarde + minutos extra de comida, cada falta vale 8 h. Las justificadas se toman de la pestaña Justificadas.'));
};

VIEWS.pnomina = async function pnomina(tab = 'prenomina', periodo) {
  state.tab = 'pnomina';
  const now = new Date();
  // Por defecto: la quincena que está por cerrar (desde el día 13 / 28) o la anterior
  periodo = periodo || (now.getDate() >= 13 && now.getDate() <= 15 || now.getDate() >= 28 ? periodoDe(now) : periodoMover(periodoDe(now), -1));
  const body = h('div', {}, segmented([['prenomina', 'Prenómina'], ['recibos', 'Recibos'], ['pagos', 'Pagos']], tab, t => VIEWS.pnomina(t, periodo)), loading());
  screen('Nómina', body);
  const head = body.firstChild;
  try {
    if (tab === 'prenomina') await prenominaView(body, head, periodo);
    else if (tab === 'recibos') await recibosAdminView(body, head, periodo);
    else await pagosAdminView(body, head);
  } catch (e) { fill(body, head, errorBox(e)); }
};

async function prenominaView(body, head, periodo) {
  const d = await api('prenomina', { periodo });
  const filas = d.filas.map(f => ({ ...f, incluir: !f.recibo_existente && !f.sin_salario }));
  const totalBox = h('div', { class: 'sticky-total' });
  const calc = f => {
    const n = k => Number(f[k] || 0);
    f.total_percepciones = n('sueldo') + n('bonos') + n('otras_percepciones');
    f.total_deducciones = n('desc_faltas') + n('desc_retardos') + n('desc_cargos') + n('desc_adeudos') + n('otras_deducciones');
    f.neto = Math.max(0, Math.round((f.total_percepciones - f.total_deducciones) * 100) / 100);
  };
  const drawTotal = () => {
    const sel = filas.filter(f => f.incluir);
    fill(totalBox, h('div', {}, h('strong', {}, `${sel.length} recibo(s)`), h('span', { class: 'muted small' }, ' · neto ' + money(sel.reduce((s, f) => s + f.neto, 0)))),
      h('button', { class: 'btn primary', disabled: !sel.length, onclick: emitir }, 'Emitir'));
  };
  const field = (f, k, label, netoEl) => {
    const inp = h('input', { class: 'input sm num', type: 'number', inputmode: 'decimal', step: '0.01', value: f[k] || '' , placeholder: '0' });
    inp.addEventListener('input', () => { f[k] = Number(inp.value || 0); calc(f); fill(netoEl, money(f.neto)); drawTotal(); });
    return h('label', { class: 'pf' }, h('span', {}, label), inp);
  };
  const card = f => {
    const netoEl = h('strong', { class: 'amount big' }, money(f.neto));
    const chk = h('input', { type: 'checkbox', checked: f.incluir || null });
    chk.addEventListener('change', () => { f.incluir = chk.checked; c.classList.toggle('off', !f.incluir); drawTotal(); });
    const a = f.asistencia;
    const notas = h('input', { class: 'input sm', placeholder: 'Nota para el recibo (opcional)', value: f.notas || '' });
    notas.addEventListener('input', () => f.notas = notas.value);
    const cb = h('input', { class: 'input sm', placeholder: 'Concepto del bono', value: f.concepto_bonos || '' });
    cb.addEventListener('input', () => f.concepto_bonos = cb.value);
    const c = h('div', { class: 'card pre' + (f.incluir ? '' : ' off') },
      h('div', { class: 'row between' },
        h('label', { class: 'row', style: 'gap:10px' }, chk, h('div', {}, h('h3', {}, f.nombre), h('span', { class: 'muted tiny' }, `No. ${f.no_empleado} · ${money(f.salario_diario)}/día${f.puesto ? ' · ' + f.puesto : ''}`))),
        netoEl),
      h('div', { class: 'row wrap gap4', style: 'margin:6px 0' },
        f.recibo_existente && h('span', { class: 'badge b-info' }, `Ya emitido ${f.recibo_existente.recibo_id} · ${money(f.recibo_existente.neto)}`),
        f.sin_salario && h('span', { class: 'badge b-err' }, 'Sin salario'), f.sin_clabe && h('span', { class: 'badge b-warn' }, 'Sin CLABE'),
        f.sin_horario && h('span', { class: 'badge b-warn' }, 'Sin horario'),
        h('span', { class: 'badge' }, `${a.faltas} falta(s) · ${hm(a.min_total)} tarde`)),
      h('details', {}, h('summary', { class: 'small' }, 'Editar importes'),
        h('div', { class: 'pgrid' },
          field(f, 'sueldo', 'Sueldo', netoEl), field(f, 'bonos', 'Bonos', netoEl), field(f, 'otras_percepciones', 'Otras percep.', netoEl),
          field(f, 'desc_faltas', `Faltas (${a.faltas})`, netoEl), field(f, 'desc_retardos', `Retardos (${hm(a.min_total)})`, netoEl),
          field(f, 'desc_cargos', `Flotilla (${f.cargos.length})`, netoEl), field(f, 'desc_adeudos', `Adeudos (${f.abonos.length})`, netoEl), field(f, 'otras_deducciones', 'Otras deduc.', netoEl)),
        cb, notas,
        f.cargos.length > 0 && h('p', { class: 'muted tiny' }, 'Cargos: ' + f.cargos.map(x => `${x.vehiculo_id} ${x.descripcion} ${money(x.monto)}`).join(' · ')),
        f.abonos.length > 0 && h('p', { class: 'muted tiny' }, 'Abonos: ' + f.abonos.map(x => `${x.concepto} ${money(x.monto)} (saldo ${money(x.saldo)})`).join(' · '))));
    return c;
  };
  const emitir = async () => {
    const sel = filas.filter(f => f.incluir);
    const reemplazo = sel.some(f => f.recibo_existente);
    if (!await confirmar('Emitir recibos', `Se generan ${sel.length} recibo(s) de la ${d.periodo.etiqueta} por ${money(sel.reduce((s, f) => s + f.neto, 0))} en total. Cada empleado recibe un aviso para revisarlo y firmarlo.${reemplazo ? ' Los recibos ya emitidos que marcaste se cancelan y se reemplazan.' : ''}`, 'Emitir')) return;
    try {
      const r = await busy('Generando recibos…', () => api('emitirRecibos', { periodo, filas: sel, reemplazar: reemplazo }));
      toast(`${r.emitidos} recibo(s) emitidos`, 'ok');
      VIEWS.pnomina('recibos', periodo);
    } catch (e) { toast(e.message, 'error', 6000); }
  };
  fill(body, head, periodoPicker(periodo, p => VIEWS.pnomina('prenomina', p)),
    h('p', { class: 'muted small' }, 'Calculado con la asistencia del checador, los cargos de la flotilla y los adeudos activos. Revisa, ajusta y emite.'),
    filas.map(card), totalBox);
  drawTotal();
}

async function recibosAdminView(body, head, periodo) {
  const l = await api('recibosAdmin', { periodo });
  const vivos = l.filter(r => r.estatus !== 'cancelado');
  fill(body, head, periodoPicker(periodo, p => VIEWS.pnomina('recibos', p)),
    h('div', { class: 'kpis' }, kpi('Recibos', vivos.length, money0(vivos.reduce((s, r) => s + r.neto, 0)) + ' neto'),
      kpi('Firmados', `${vivos.filter(r => r.firma_fecha).length}/${vivos.length}`, 'por los empleados'),
      kpi('Pagados', `${vivos.filter(r => r.estatus === 'pagado').length}/${vivos.length}`, 'match con Fondeadora')),
    l.length ? table([
      { t: 'Empleado', f: r => h('div', {}, h('strong', {}, r.nombre), h('div', { class: 'muted tiny' }, r.recibo_id)) },
      { t: 'Neto', cls: 'num', f: r => money(r.neto) },
      { t: 'Estado', f: r => reciboBadges(r) },
    ], l, r => reciboView(r.recibo_id, () => VIEWS.pnomina('recibos', periodo))) : empty('🧾', 'Sin recibos en esta quincena. Genéralos desde Prenómina.'));
}

async function pagosAdminView(body, head) {
  const l = await api('pagosAdmin', {});
  const CU = { SI: ['Cuadra', 'ok'], NO: ['No cuadra', 'err'], 'SIN RECIBO': ['Sin recibo', 'muted'], MANUAL: ['Ligado a mano', 'info'] };
  fill(body, head,
    h('div', { class: 'row wrap', style: 'gap:8px;margin-bottom:12px' },
      h('button', { class: 'btn sm', onclick: async () => {
        try { const r = await busy('Revisando correos de Fondeadora…', () => api('revisarAhora')); toast(`${r.pagos_nuevos} pago(s) nuevo(s) de ${r.revisados} correo(s)`, 'ok'); VIEWS.pnomina('pagos'); } catch (e) { toast(e.message, 'error'); }
      } }, '↻ Revisar correos ahora'),
      h('button', { class: 'btn sm', onclick: pagoManualView }, '＋ Pago manual')),
    h('p', { class: 'muted small' }, 'Cada 5 minutos se leen los correos "Transferencia exitosa" de Fondeadora; si la CLABE destino es de un empleado se registra aquí y se le avisa por push.'),
    l.length ? l.map(p => {
      const [cl, cc] = CU[p.cuadra] || [p.cuadra, 'muted'];
      return h('div', { class: 'card pay' },
        h('div', { class: 'row between' }, h('div', {}, h('h3', {}, p.nombre), h('span', { class: 'muted small cap' }, p.concepto)), h('strong', { class: 'amount' }, money(p.monto))),
        h('div', { class: 'row between small', style: 'margin-top:6px' }, h('span', { class: 'row gap4' }, h('span', { class: 'badge b-' + cc }, cl), p.recibo_id && h('span', { class: 'muted' }, p.recibo_id)),
          h('span', { class: 'muted' }, fechaHora(p.fecha))),
        p.cuadra !== 'SI' && h('button', { class: 'link', onclick: () => ligarPago(p) }, p.recibo_id ? 'Cambiar recibo' : 'Ligar a un recibo'));
    }) : empty('💸', 'Sin pagos a empleados en los últimos 45 días.'));
}

async function ligarPago(p) {
  const recibos = (await busy('Cargando…', () => api('recibosAdmin', {}))).filter(r => r.no_empleado === p.no_empleado && r.estatus !== 'cancelado');
  const sel = h('select', { class: 'input' }, h('option', { value: '' }, '— Sin recibo —'),
    recibos.map(r => h('option', { value: r.recibo_id, selected: r.recibo_id === p.recibo_id || null }, `${r.recibo_id} · ${r.etiqueta} · ${money(r.neto)}${r.estatus === 'pagado' && r.pago_id !== p.pago_id ? ' (ya pagado)' : ''}`)));
  const ok = await modal(`Depósito de ${money(p.monto)}`, h('div', {}, h('p', { class: 'muted' }, `${p.nombre} · ${p.concepto}`), sel), [['Cancelar', false], ['Guardar', true, 'primary']]);
  if (!ok) return;
  try { await busy('Guardando…', () => api('asignarPago', { pago_id: p.pago_id, recibo_id: sel.value })); toast('Listo', 'ok'); VIEWS.pnomina('pagos'); } catch (e) { toast(e.message, 'error'); }
}

async function pagoManualView() {
  const personas = (await busy('Cargando…', () => api('personal'))).filter(p => p.estatus !== 'baja');
  const sel = h('select', { class: 'input' }, personas.map(p => h('option', { value: p.no_empleado }, `${p.nombre} (No. ${p.no_empleado})`)));
  const monto = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'Monto' });
  const concepto = h('input', { class: 'input', placeholder: 'Concepto (ej. nómina en efectivo)', value: 'Nómina en efectivo' });
  const ok = await modal('Registrar pago manual', h('div', {}, h('p', { class: 'muted small' }, 'Para pagos que no salieron por Fondeadora (efectivo u otra cuenta). Si coincide con un recibo pendiente se marca como pagado.'), sel, monto, concepto), [['Cancelar', false], ['Registrar', true, 'primary']]);
  if (!ok) return;
  try { await busy('Guardando…', () => api('pagoManual', { no_empleado: sel.value, monto: monto.value, concepto: concepto.value })); toast('Pago registrado', 'ok'); VIEWS.pnomina('pagos'); } catch (e) { toast(e.message, 'error'); }
}

VIEWS.personal = async function personal(filtro = 'activos', q = '') {
  const body = h('div', {}, loading());
  screen('Personal', body, { actions: h('button', { class: 'icon-btn', 'aria-label': 'Nuevo', onclick: () => personaView(null) }, '＋') });
  let l;
  try { l = (await cached('personal', {}, live(() => VIEWS.personal(filtro, q)))).data; } catch (e) { return fill(body, errorBox(e)); }
  const incompleto = p => !p.rfc || !p.clabe || !p.salario_diario || !p.horario?.entrada;
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre o número', value: q });
  const list = h('div');
  const draw = () => {
    const s = search.value.trim().toLowerCase();
    const r = l.filter(p => (filtro === 'activos' ? p.estatus !== 'baja' : filtro === 'incompletos' ? p.estatus !== 'baja' && incompleto(p) : filtro === 'bienvenida' ? p.bienvenida && !p.bienvenida.completa : filtro === 'docs' ? p.docs_por_revisar > 0 : filtro === 'bajas' ? p.estatus === 'baja' : true)
      && (!s || p.nombre.toLowerCase().includes(s) || p.no_empleado === s));
    fill(list, r.length ? r.map(p => h('button', { class: 'card tap person', onclick: () => personaView(p) },
      h('div', { class: 'avatar sm' + (p.estatus === 'baja' ? ' off' : '') }, iniciales(p.nombre)),
      h('div', { class: 'grow' }, h('strong', {}, p.nombre), h('div', { class: 'muted tiny' }, `No. ${p.no_empleado}${p.puesto ? ' · ' + p.puesto : ''}${p.rol === 'patron' ? ' · patrón' : p.rol === 'admin' ? ' · admin' : ''}`),
        h('div', { class: 'row wrap gap4', style: 'margin-top:4px' },
          !p.rfc && h('span', { class: 'badge b-warn' }, 'Sin RFC'), !p.clabe && h('span', { class: 'badge b-warn' }, 'Sin CLABE'),
          !p.salario_diario && h('span', { class: 'badge b-warn' }, 'Sin salario'), !p.horario?.entrada && h('span', { class: 'badge b-warn' }, 'Sin horario'),
          p.bloqueado ? h('span', { class: 'badge b-err' }, 'Bloqueado') : p.tiene_pin ? h('span', { class: 'badge b-ok' }, 'Con acceso') : h('span', { class: 'badge' }, 'Sin acceso'),
          p.bienvenida && h('span', { class: 'badge b-' + (p.bienvenida.completa ? 'ok' : 'warn') }, p.bienvenida.completa ? 'Bienvenida ✓' : `Bienvenida ${p.bienvenida.hechos}/${p.bienvenida.total}`),
          p.docs_por_revisar > 0 && h('span', { class: 'badge b-warn' }, `📄 ${p.docs_por_revisar} por revisar`),
          p.push && h('span', { class: 'badge b-info' }, '🔔'))),
      h('span', { class: 'chev' }, '›'))) : empty('👥', 'Nadie en este filtro.'));
  };
  search.addEventListener('input', draw);
  fill(body, h('div', { class: 'chips' }, [['activos', 'Activos'], ['incompletos', `Incompletos (${l.filter(p => p.estatus !== 'baja' && incompleto(p)).length})`], ['bienvenida', `Bienvenida (${l.filter(p => p.bienvenida && !p.bienvenida.completa).length})`], ['docs', `Docs por revisar (${l.filter(p => p.docs_por_revisar).length})`], ['bajas', 'Bajas'], ['todos', 'Todos']].map(([k, t]) =>
    h('button', { class: 'chip ' + (filtro === k ? 'on' : ''), onclick: () => VIEWS.personal(k, search.value) }, t))),
    h('button', { class: 'card tap row between', onclick: () => altasAdmin() }, h('div', {}, h('strong', {}, '🆕 Altas de personal nuevo'), h('div', { class: 'muted tiny' }, 'Gente que subió sus documentos y espera su número de empleado')), h('span', { class: 'chev' }, '›')),
    search, list,
    h('p', { class: 'muted small' }, 'Horario y checadas de cada empleado se capturan aquí y pasan solos al checador. En el checador ZKTeco solo registras su huella con el mismo número de empleado.'));
  draw();
};

async function personaView(p) {
  const nuevo = !p;
  p = p || { estatus: 'activo', rol: 'empleado' };
  const f = {};
  const inp = (k, label, attrs = {}) => { f[k] = h('input', { class: 'input', value: p[k] ?? '', ...attrs }); return h('div', {}, h('label', { class: 'label' }, label), f[k]); };
  const sel = (k, label, ops) => { f[k] = h('select', { class: 'input' }, ops.map(([v, t]) => h('option', { value: v, selected: p[k] === v || null }, t))); return h('div', {}, h('label', { class: 'label' }, label), f[k]); };
  const body = h('div', {},
    !nuevo && h('div', { class: 'card row', style: 'gap:12px' }, h('div', { class: 'avatar' }, iniciales(p.nombre)),
      h('div', { class: 'grow' }, h('h3', {}, p.nombre), h('p', { class: 'muted small' }, p.tiene_pin ? `Último acceso ${p.ultimo_acceso ? fechaHora(p.ultimo_acceso) : '—'}` : 'Aún no entra al portal'),
        p.horario && h('p', { class: 'muted tiny' }, `Checador: entrada ${p.horario.entrada || '—'} · ${p.horario.dias || 'sin días'} · huella ${p.celular_checador ? '✓' : '✗'}`))),
    !nuevo && h('div', { class: 'quick' },
      h('button', { class: 'q', onclick: () => { state.tab = 'personal'; VIEWS.asistencia(null, p.no_empleado, p.nombre); } }, h('span', {}, '⏱️'), 'Asistencia'),
      h('button', { class: 'q', onclick: () => subirDoc(p) }, h('span', {}, '📤'), 'Subir doc.'),
      h('button', { class: 'q', onclick: () => nuevoAdeudo(p) }, h('span', {}, '💳'), 'Adeudo'),
      h('button', { class: 'q', disabled: !p.tiene_pin && !p.bloqueado, onclick: async () => {
        if (!await confirmar('Reiniciar PIN', `${p.nombre} volverá a crear su PIN con su RFC y número de empleado. Se cierran sus sesiones.`, 'Reiniciar')) return;
        try { await busy('Reiniciando…', () => api('resetPin', { no_empleado: p.no_empleado })); toast('PIN reiniciado', 'ok'); go('personal'); } catch (e) { toast(e.message, 'error'); }
      } }, h('span', {}, '🔑'), 'Reset PIN')),
    !nuevo && p.estatus !== 'baja' && [section('Bienvenida'), bienvenidaAdminBox(p), section('Documentos'), docsAdminBox(p)],
    section('Identificación'),
    nuevo && inp('no_empleado', 'No. de empleado (el mismo del checador)', { inputmode: 'numeric' }),
    inp('nombre', 'Nombre completo'),
    h('div', { class: 'grid2' }, inp('rfc', 'RFC', { autocapitalize: 'characters', maxlength: 13, class: 'input mono' }), inp('curp', 'CURP', { autocapitalize: 'characters', maxlength: 18, class: 'input mono' })),
    h('div', { class: 'grid2' }, inp('nss', 'NSS', { inputmode: 'numeric', maxlength: 11 }), inp('telefono', 'Teléfono', { inputmode: 'tel' })),
    inp('correo', 'Correo', { type: 'email' }),
    section('Puesto y nómina'),
    h('div', { class: 'grid2' }, inp('puesto', 'Puesto'), inp('area', 'Área')),
    h('div', { class: 'grid2' }, inp('fecha_ingreso', 'Fecha de ingreso', { type: 'date' }), inp('salario_diario', 'Salario diario', { type: 'number', inputmode: 'decimal', step: '0.01' })),
    h('div', { class: 'grid2' }, inp('clabe', 'CLABE (18 dígitos)', { inputmode: 'numeric', maxlength: 18, class: 'input mono' }), inp('banco', 'Banco')),
    h('p', { class: 'muted tiny' }, 'Con la CLABE se reconocen sus depósitos de Fondeadora automáticamente.'),
    section('Horario y checador'),
    horarioCampos(p, f),
    h('p', { class: 'muted tiny' }, 'Se copia sola al checador. En el checador ZKTeco registra su huella con este mismo número de empleado.'),
    h('div', { class: 'grid2' }, inp('flotilla_id', 'ID en la flotilla (ej. U-004)', { autocapitalize: 'characters' }), inp('shipday_id', 'ID(s) de repartidor en Shipday (separados por coma)')),
    sel('moto_tipo', 'Moto que usa (para el ruteador)', [['', 'Sin definir'], ['grande', '🏍️ Grande'], ['chica', '🛵 Chica']]),
    !nuevo && [section('Domicilio y emergencias'), datosCards(p, { no_empleado: p.no_empleado, nombre: p.nombre, back: () => go('personal') })],
    section('Acceso'),
    h('div', { class: 'grid2' }, sel('rol', 'Rol', [['empleado', 'Empleado'], ['admin', 'Admin (rutas y reporte)'], ['patron', 'Patrón (super admin)']]), sel('estatus', 'Estatus', [['activo', 'Activo'], ['baja', 'Baja']])),
    inp('fecha_baja', 'Fecha de baja', { type: 'date' }),
    h('label', { class: 'label' }, 'Notas internas'), (f.notas = h('textarea', { class: 'input', rows: 2 }, p.notas || '')),
    h('button', { class: 'btn primary block', onclick: async () => {
      const persona = { no_empleado: nuevo ? f.no_empleado.value.trim() : p.no_empleado };
      Object.keys(f).forEach(k => { if (k !== 'no_empleado') persona[k] = f[k].value; });
      try { await busy('Guardando…', () => api('guardarPersona', { persona })); toast('Guardado', 'ok'); go('personal'); } catch (e) { toast(e.message, 'error', 5000); }
    } }, 'Guardar'));
  screen(nuevo ? 'Nuevo empleado' : 'Expediente', body, { back: () => go('personal') });
  if (nuevo) api('siguienteNumero').then(n => { if (!f.no_empleado.value) f.no_empleado.value = n; }).catch(() => {});
}

/** Hora de entrada, días, comida y checadas; agrega a f objetos con .value para que el guardado los lea igual que inputs. */
function horarioCampos(p, f) {
  const DIAS = [['L', 'Lun'], ['M', 'Mar'], ['Mi', 'Mié'], ['J', 'Jue'], ['V', 'Vie'], ['S', 'Sáb'], ['D', 'Dom']];
  const CHK = [['ENTRADA', 'Entrada'], ['SALIDA_COMIDA', 'Salir a comer'], ['REGRESO_COMIDA', 'Regresar de comer'], ['SALIDA', 'Salida']];
  const PRESETS = { Oficina: ['ENTRADA', 'SALIDA_COMIDA', 'REGRESO_COMIDA', 'SALIDA'], Repartidor: ['ENTRADA', 'SALIDA_COMIDA', 'REGRESO_COMIDA'], Campo: ['ENTRADA', 'SALIDA'] };
  const norm = x => x.toUpperCase() === 'MI' ? 'Mi' : x.toUpperCase();
  const dias = new Set(String(p.dias_laborales || '').split(/[,\s]+/).filter(String).map(norm));
  const esRep = /repart/i.test(p.puesto || '');
  const chk = new Set(String(p.checadas || '').split(',').filter(String));
  if (!chk.size) (esRep ? PRESETS.Repartidor : PRESETS.Oficina).forEach(c => chk.add(c));
  if (!dias.size && !p.no_empleado) ['L', 'M', 'Mi', 'J', 'V', 'S'].forEach(d => dias.add(d));
  const hora = h('input', { class: 'input', type: 'time', value: p.hora_entrada ? String(p.hora_entrada).padStart(5, '0') : '' });
  const comida = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: 0, max: 240, value: p.minutos_comida ?? (p.no_empleado ? '' : 60), placeholder: '60' });
  const diasBox = h('div', { class: 'chips wrap' }), chkBox = h('div', { class: 'chips wrap' }), preBox = h('div', { class: 'row wrap gap4', style: 'margin-bottom:6px' });
  const draw = () => {
    fill(diasBox, DIAS.map(([k, l]) => h('button', { class: 'chip ' + (dias.has(k) ? 'on' : ''), onclick: () => { dias.has(k) ? dias.delete(k) : dias.add(k); draw(); } }, l)));
    fill(chkBox, CHK.map(([k, l]) => h('button', { class: 'chip ' + (chk.has(k) ? 'on' : ''), onclick: () => { chk.has(k) ? chk.delete(k) : chk.add(k); draw(); } }, l)));
    fill(preBox, h('span', { class: 'muted tiny' }, 'Atajos:'), Object.entries(PRESETS).map(([n, l]) => h('button', { class: 'chip sm' + (l.length === chk.size && l.every(c => chk.has(c)) ? ' on' : ''), onclick: () => { chk.clear(); l.forEach(c => chk.add(c)); draw(); } }, n)));
  };
  draw();
  f.hora_entrada = { get value() { return hora.value ? hora.value.replace(/^0(\d)/, '$1') : ''; } };
  f.minutos_comida = comida;
  f.dias_laborales = { get value() { return DIAS.map(d => d[0]).filter(d => dias.has(d)).join(','); } };
  f.checadas = { get value() { return CHK.map(c => c[0]).filter(c => chk.has(c)).join(','); } };
  return h('div', {},
    h('div', { class: 'grid2' }, h('div', {}, h('label', { class: 'label' }, 'Hora de entrada'), hora), h('div', {}, h('label', { class: 'label' }, 'Minutos de comida'), comida)),
    h('label', { class: 'label' }, 'Días que trabaja'), diasBox,
    h('label', { class: 'label' }, 'Checadas que le tocan'), preBox, chkBox);
}

function bienvenidaAdminBox(p) {
  const box = h('div', { class: 'card' }, loading());
  const load = async () => {
    try {
      const b = await api('bienvenidaDe', { no_empleado: p.no_empleado });
      const docs = b.pasos.find(x => x.id === 'documentos');
      fill(box, b.pasos.map(x => h('div', { class: 'kv' }, h('span', {}, (x.hecho ? '✅ ' : '⬜ ') + x.titulo), h('span', { class: 'muted small' }, x.hecho ? (x.fecha ? fecha(x.fecha) : 'listo') : (x.faltan ? 'faltan ' + x.faltan.length : 'pendiente')))),
        h('div', { class: 'row wrap', style: 'gap:8px;margin-top:10px' },
          h('button', { class: 'btn sm', onclick: async () => { try { await api('docsRecibidos', { no_empleado: p.no_empleado, recibidos: !docs.hecho }); load(); } catch (e) { toast(e.message, 'error'); } } },
            docs.hecho ? 'Marcar docs como pendientes' : '✓ Recibí sus documentos'),
          !b.completa && h('button', { class: 'btn sm primary', onclick: async () => { try { await busy('Enviando…', () => api('recordarBienvenida', { no_empleado: p.no_empleado })); toast('Recordatorio enviado', 'ok'); } catch (e) { toast(e.message, 'error'); } } }, '🔔 Recordarle')),
        b.rol === '' && h('p', { class: 'muted tiny' }, 'Sin puesto: el empleado elegirá si es repartidor. Captura el puesto abajo para decidirlo tú.'));
    } catch (e) { fill(box, errorBox(e)); }
  };
  load();
  return box;
}

function docsAdminBox(p) {
  const box = h('div', {}, loading());
  const load = async () => {
    try {
      const d = await api('docsDeEmpleado', { no_empleado: p.no_empleado });
      fill(box, h('p', { class: 'muted small' }, `${d.subidos} de ${d.requeridos} subidos · ${d.aprobados} aprobados`),
        docsList(d.documentos, { admin: true, onReview: (doc, est) => revisarDoc(doc, est, load) }));
    } catch (e) { fill(box, errorBox(e)); }
  };
  load();
  return box;
}

async function altasAdmin(estatus = 'abiertas') {
  state.tab = 'personal';
  const body = h('div', {}, loading());
  screen('Altas', body, { back: () => go('personal') });
  let l;
  try { l = await api('altasAdmin', { estatus }); } catch (e) { return fill(body, errorBox(e)); }
  const EST = { pendiente: ['Subiendo documentos', 'muted'], completa: ['Lista para revisar', 'warn'], aprobada: ['Aprobada', 'ok'], rechazada: ['Rechazada', 'err'] };
  fill(body,
    h('div', { class: 'chips' }, [['abiertas', 'Abiertas'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas'], ['todas', 'Todas']].map(([k, t]) =>
      h('button', { class: 'chip ' + (estatus === k ? 'on' : ''), onclick: () => altasAdmin(k) }, t))),
    h('p', { class: 'muted small' }, 'Comparte el portal con la gente nueva: tocan "Soy nuevo", llenan sus datos y suben sus documentos. Aquí los revisas y les das su número de empleado.'),
    l.length ? l.map(a => {
      const [lt, lc] = EST[a.estatus] || [a.estatus, 'muted'];
      return h('div', { class: 'card alta-card' },
        h('div', { class: 'row between' }, h('div', {}, h('h3', {}, a.nombre), h('span', { class: 'muted tiny mono' }, a.rfc)), h('span', { class: 'badge b-' + lc }, lt)),
        h('p', { class: 'small' }, `${a.rol === 'repartidor' ? '🛵 Repartidor' : '🏢 Otro puesto'} · 📱 ${a.telefono} · ${fechaHora(a.fecha)}`),
        a.no_empleado && h('p', { class: 'small' }, 'No. empleado: ', h('strong', {}, a.no_empleado)),
        a.notas && h('p', { class: 'small muted' }, a.notas),
        h('details', { open: a.estatus === 'completa' || null }, h('summary', { class: 'small' }, `Documentos (${a.docs.subidos}/${a.docs.requeridos})`),
          docsList(a.docs.documentos, { admin: true, onReview: (doc, est) => revisarDoc(doc, est, () => altasAdmin(estatus)) })),
        ['pendiente', 'completa'].includes(a.estatus) && h('div', { class: 'row', style: 'margin-top:10px;gap:8px' },
          h('button', { class: 'btn sm danger-o', onclick: () => resolverAltaUI(a, false, estatus) }, 'Rechazar'),
          h('button', { class: 'btn sm primary', onclick: () => resolverAltaUI(a, true, estatus) }, 'Aprobar y asignar número')));
    }) : empty('🆕', 'No hay altas en este filtro.'));
}

async function resolverAltaUI(a, aprobar, estatus) {
  const com = h('textarea', { class: 'input', rows: 2, placeholder: aprobar ? 'Nota (opcional)' : 'Motivo (lo verá la persona)' });
  let extra = null, no, puesto;
  if (aprobar) {
    const per = await busy('Cargando…', () => api('personal'));
    const libres = per.filter(p => !p.rfc && p.estatus !== 'baja');
    no = h('input', { class: 'input big', inputmode: 'numeric', placeholder: 'No. empleado' });
    puesto = h('input', { class: 'input', placeholder: 'Puesto', value: a.rol === 'repartidor' ? 'Repartidor' : '' });
    const sug = libres.filter(p => p.nombre.toLowerCase().split(' ')[0] === a.nombre.toLowerCase().split(' ')[0]);
    extra = h('div', {},
      h('p', { class: 'muted small' }, 'Usa el mismo número que tiene (o tendrá) su huella en el checador ZKTeco. Si ya está en la lista de empleados, elígelo:'),
      (sug.length ? sug : libres).slice(0, 8).map(p => h('button', { class: 'chip', style: 'margin:2px', onclick: () => { no.value = p.no_empleado; } }, `${p.no_empleado} · ${primerNombre(p.nombre)}`)),
      h('label', { class: 'label' }, 'Número de empleado'), no, h('label', { class: 'label' }, 'Puesto'), puesto);
  }
  const ok = await modal((aprobar ? 'Aprobar alta · ' : 'Rechazar alta · ') + primerNombre(a.nombre), h('div', { class: 'scroll-sheet' }, extra, com),
    [['Cancelar', false], [aprobar ? 'Aprobar' : 'Rechazar', true, aprobar ? 'primary' : 'danger']]);
  if (!ok) return;
  try {
    const r = await busy('Guardando…', () => api('resolverAlta', { alta_id: a.alta_id, aprobar, no_empleado: no && no.value, puesto: puesto && puesto.value, comentario: com.value }));
    toast(aprobar ? `Aprobada · No. ${r.no_empleado}. Ya puede crear su acceso.` : 'Alta rechazada', 'ok', 5000);
    altasAdmin(estatus);
  } catch (e) { toast(e.message, 'error', 6000); }
}

async function appsAdmin() {
  state.tab = 'pmas';
  const body = h('div', {}, loading());
  screen('Apps y accesos', body, { back: () => go('pmas'), actions: h('button', { class: 'icon-btn', 'aria-label': 'Nueva', onclick: () => editarApp(null) }, '＋') });
  try {
    const l = await api('appsAdmin');
    fill(body, h('p', { class: 'muted small' }, 'Lo que ven los empleados en Bienvenida → Instalar y en Accesos directos. "Requerida" cuenta para terminar la bienvenida.'),
      l.map(a => h('button', { class: 'card tap app-row' + (a.activo ? '' : ' off'), onclick: () => editarApp(a) }, appIcon(a),
        h('div', { class: 'grow' }, h('strong', {}, a.nombre), h('small', { class: 'muted block' }, `${a.tipo} · ${a.puestos === 'todos' ? 'todos los puestos' : 'repartidores'}`),
          h('div', { class: 'row wrap gap4', style: 'margin-top:4px' }, a.requerida && h('span', { class: 'badge b-warn' }, 'Requerida'), a.acceso_directo && h('span', { class: 'badge b-info' }, 'Acceso directo'), !a.activo && h('span', { class: 'badge' }, 'Oculta'))),
        h('span', { class: 'chev' }, '›'))));
  } catch (e) { fill(body, errorBox(e)); }
}

async function editarApp(a) {
  const nueva = !a;
  a = a || { tipo: 'playstore', puestos: 'repartidor', requerida: true, acceso_directo: true, activo: true, icono: '📱', color: '#2b4c78', orden: 999 };
  const f = {};
  const inp = (k, label, attrs = {}) => { f[k] = h('input', { class: 'input', value: a[k] ?? '', ...attrs }); return h('div', {}, h('label', { class: 'label' }, label), f[k]); };
  const sel = (k, label, ops) => { f[k] = h('select', { class: 'input' }, ops.map(([v, t]) => h('option', { value: v, selected: a[k] === v || null }, t))); return h('div', {}, h('label', { class: 'label' }, label), f[k]); };
  const chk = (k, label) => { f[k] = h('input', { type: 'checkbox', checked: a[k] || null }); return h('label', { class: 'row small', style: 'margin:6px 0' }, f[k], ' ' + label); };
  const ok = await modal(nueva ? 'Nueva app' : a.nombre, h('div', { class: 'scroll-sheet' },
    nueva && inp('app_id', 'ID (sin espacios)'), inp('nombre', 'Nombre'), inp('descripcion', 'Para qué sirve'),
    h('div', { class: 'grid2' }, inp('icono', 'Ícono (emoji)'), inp('color', 'Color', { type: 'color' })),
    h('div', { class: 'grid2' }, sel('tipo', 'Tipo', [['playstore', 'Play Store'], ['apk', 'APK propio'], ['web', 'Página web']]), sel('puestos', 'Para', [['repartidor', 'Repartidores'], ['todos', 'Todos']])),
    inp('url_instalar', 'Link para instalar (Play Store, APK o página)'), inp('android_package', 'Paquete Android (para abrirla, ej. com.waze)'),
    inp('url_abrir', 'Link para abrir en iPhone / web (opcional)'), inp('orden', 'Orden', { type: 'number' }),
    chk('requerida', 'Requerida en la bienvenida'), chk('acceso_directo', 'Mostrar en Accesos directos'), chk('activo', 'Visible')), [['Cancelar', false], ['Guardar', true, 'primary']]);
  if (!ok) return;
  const app = { app_id: nueva ? f.app_id.value : a.app_id };
  Object.keys(f).forEach(k => { if (k !== 'app_id') app[k] = f[k].type === 'checkbox' ? f[k].checked : f[k].value; });
  try { await busy('Guardando…', () => api('guardarApp', { app })); toast('Guardado', 'ok'); appsAdmin(); } catch (e) { toast(e.message, 'error', 5000); }
}

async function subirDoc(p) {
  const file = await pickFile('*/*');
  if (!file) return;
  const nombre = h('input', { class: 'input', value: file.name });
  const avisar = h('input', { type: 'checkbox', checked: true });
  const ok = await modal('Subir al expediente', h('div', {}, h('p', { class: 'muted small' }, `Para ${p.nombre}. El empleado lo podrá ver y descargar en "Mis documentos".`), nombre,
    h('label', { class: 'row small' }, avisar, ' Avisarle por notificación')), [['Cancelar', false], ['Subir', true, 'primary']]);
  if (!ok) return;
  try {
    const f = await readFile(file);
    await busy('Subiendo…', () => api('subirDocumento', { no_empleado: p.no_empleado, nombre: nombre.value || f.name, base64: f.base64, mime: f.mime, avisar: avisar.checked }));
    toast('Documento subido', 'ok');
  } catch (e) { toast(e.message, 'error'); }
}

async function nuevoAdeudo(p) {
  const personas = p ? null : (await busy('Cargando…', () => api('personal'))).filter(x => x.estatus !== 'baja');
  const who = p ? null : h('select', { class: 'input' }, personas.map(x => h('option', { value: x.no_empleado }, x.nombre)));
  const concepto = h('input', { class: 'input', placeholder: 'Concepto (ej. préstamo, herramienta, uniforme)', value: 'Préstamo' });
  const monto = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'Monto total' });
  const cuota = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'Descuento por quincena' });
  const ok = await modal('Nuevo adeudo' + (p ? ' · ' + primerNombre(p.nombre) : ''), h('div', {}, who, concepto, monto, cuota,
    h('p', { class: 'muted small' }, 'Se descuenta en cada prenómina hasta liquidarlo. Al empleado le llega un aviso.')), [['Cancelar', false], ['Guardar', true, 'primary']]);
  if (!ok) return;
  try { await busy('Guardando…', () => api('guardarAdeudo', { no_empleado: p ? p.no_empleado : who.value, concepto: concepto.value, monto_total: monto.value, cuota: cuota.value })); toast('Adeudo registrado', 'ok'); if (!p) adeudosAdmin(); }
  catch (e) { toast(e.message, 'error'); }
}

VIEWS.pmas = function pmas() {
  const u = session.user;
  screen('Más', h('div', {},
    h('div', { class: 'card row', style: 'gap:12px' }, h('div', { class: 'avatar' }, iniciales(u.nombre)), h('div', {}, h('h3', {}, u.nombre), h('p', { class: 'muted small' }, 'Modo patrón'))),
    h('button', { class: 'card tap row between switch emp', onclick: () => { session.modo = 'empleado'; start(); } },
      h('div', {}, h('h3', {}, '👤 Ver mi portal de empleado'), h('p', { class: 'muted small' }, 'Tu asistencia, tus recibos y depósitos')), h('span', { class: 'chev' }, '›')),
    menu([
      ['🗺️', 'Rutas y reporte', 'Ruteador, rutas publicadas y reporte de Shipday', () => rutasAdminView()],
      ['🛵', 'Flotilla', 'Fallas, reparaciones, documentos y métricas de motos', () => flotillaView('dashboard')],
      ['📦', 'Recolecciones', 'Asignación automática de recolecciones del día', () => recoleccionesView()],
      ['🔗', 'Repartidores en Shipday', 'Vincula cada repartidor de Shipday con su empleado', () => shipdayVincularView()],
      ['🏆', 'Desempeño de repartidores', 'Entregas por día, semana y mes y jerarquía', () => entregasEquipoView()],
      ['🚨', 'Emergencias', 'Contactos de emergencia y domicilios', () => emergenciasView()],
      ['🛰️', 'GPS y alertas', 'Fuera de ruta, sin entregar y paradas detectadas', () => gpsPruebaView()],
      ['📝', 'Solicitudes', 'Justificantes, vacaciones, permisos, anticipos', () => solicitudesAdmin()],
      ['📢', 'Avisos', 'Comunicados por notificación', enviarAvisoView],
      ['💳', 'Adeudos y cargos', 'Préstamos y cargos de flotilla', () => adeudosAdmin()],
      ['📱', 'Apps y accesos', 'Apps que instalan y abren los empleados', appsAdmin],
      ['🔔', 'Mis notificaciones', '', () => bandeja()],
      ['🔑', 'Cambiar PIN', '', cambiarPin],
    ]),
    pushCard(),
    h('button', { class: 'btn danger-o block', onclick: () => { session.clear(); location.reload(); } }, 'Cerrar sesión'),
    h('p', { class: 'muted small center' }, 'Portal Packatelas · v' + (window.APP_VERSION || '1'))));
};

async function solicitudesAdmin(estatus = 'pendiente') {
  state.tab = 'pmas';
  const body = h('div', {}, loading());
  screen('Solicitudes', body, { back: () => go('pmas') });
  try {
    const l = (await cached('solicitudesAdmin', { estatus: estatus === 'todas' ? '' : estatus }, live(() => solicitudesAdmin(estatus)))).data;
    fill(body, h('div', { class: 'chips' }, [['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas'], ['todas', 'Todas']].map(([k, t]) =>
      h('button', { class: 'chip ' + (estatus === k ? 'on' : ''), onclick: () => solicitudesAdmin(k) }, t))),
      l.length ? l.map(s => solCard(s, s.estatus === 'pendiente' && h('div', { class: 'row', style: 'margin-top:10px' },
        s.evidencia && h('a', { class: 'btn sm', href: 'https://drive.google.com/file/d/' + s.evidencia + '/view', target: '_blank', rel: 'noopener' }, '📎 Evidencia'),
        h('button', { class: 'btn sm danger-o', onclick: () => resolver(s, false) }, 'Rechazar'),
        h('button', { class: 'btn sm primary', onclick: () => resolver(s, true) }, 'Aprobar')))) : empty('✅', 'Nada pendiente.'));
  } catch (e) { fill(body, errorBox(e)); }
}

async function resolver(s, aprobar) {
  const com = h('textarea', { class: 'input', rows: 2, placeholder: 'Comentario para el empleado (opcional)' });
  const cuota = h('input', { class: 'input', type: 'number', inputmode: 'decimal', placeholder: 'Descuento por quincena', value: s.monto || '' });
  const extra = aprobar && ['justificante', 'vacaciones', 'permiso'].includes(s.tipo) ? h('p', { class: 'muted small' }, 'Se agrega a la pestaña Justificadas del checador: esos días no cuentan como falta.')
    : aprobar && s.tipo === 'anticipo' ? h('div', {}, h('p', { class: 'muted small' }, 'Se crea un adeudo que se descuenta en la prenómina.'), cuota) : null;
  const ok = await modal((aprobar ? 'Aprobar' : 'Rechazar') + ' · ' + s.tipo_txt, h('div', {}, h('p', {}, `${s.nombre}${s.fecha_desde ? ' · ' + fecha(s.fecha_desde) : ''}${s.monto ? ' · ' + money(s.monto) : ''}`), extra, com),
    [['Cancelar', false], [aprobar ? 'Aprobar' : 'Rechazar', true, aprobar ? 'primary' : 'danger']]);
  if (!ok) return;
  try { await busy('Guardando…', () => api('resolverSolicitud', { sol_id: s.sol_id, aprobar, comentario: com.value, cuota: cuota.value })); toast(aprobar ? 'Aprobada' : 'Rechazada', 'ok'); solicitudesAdmin(); }
  catch (e) { toast(e.message, 'error'); }
}

async function enviarAvisoView() {
  state.tab = 'pmas';
  const body = h('div', {}, loading());
  screen('Avisos', body, { back: () => go('pmas') });
  let personas, hist;
  try { [personas, hist] = await Promise.all([api('personal'), api('avisosEnviados')]); } catch (e) { return fill(body, errorBox(e)); }
  personas = personas.filter(p => p.estatus !== 'baja');
  const titulo = h('input', { class: 'input', placeholder: 'Título (ej. Junta el lunes)', maxlength: 60 });
  const msg = h('textarea', { class: 'input', rows: 3, placeholder: 'Mensaje' });
  const marcados = new Set();
  const todos = h('input', { type: 'checkbox', checked: true });
  const lista = h('div', { class: 'chips wrap hidden' }, personas.map(p => {
    const c = h('button', { class: 'chip', onclick: () => { marcados.has(p.no_empleado) ? marcados.delete(p.no_empleado) : marcados.add(p.no_empleado); c.classList.toggle('on'); } }, primerNombre(p.nombre) + (p.push ? ' 🔔' : ''));
    return c;
  }));
  todos.addEventListener('change', () => lista.classList.toggle('hidden', todos.checked));
  fill(body,
    h('div', { class: 'card' }, titulo, msg,
      h('label', { class: 'row small', style: 'margin:6px 0' }, todos, ' Enviar a todo el personal activo'), lista,
      h('button', { class: 'btn primary block', onclick: async () => {
        const dest = todos.checked ? 'todos' : [...marcados];
        if (!todos.checked && !dest.length) return toast('Elige a quién enviarlo', 'warn');
        try { const r = await busy('Enviando…', () => api('enviarAviso', { titulo: titulo.value, mensaje: msg.value, destinatarios: dest })); toast(`Enviado a ${r.enviados} (${r.con_push} con push)`, 'ok'); enviarAvisoView(); }
        catch (e) { toast(e.message, 'error'); }
      } }, '📢 Enviar aviso'),
      h('p', { class: 'muted tiny' }, `${personas.filter(p => p.push).length} de ${personas.length} tienen notificaciones activas; los demás lo ven en su bandeja al abrir el portal.`)),
    section('Enviados'),
    hist.length ? hist.map(a => h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', {}, a.titulo.replace(/^📢 /, '')), h('span', { class: 'muted tiny' }, fechaHora(a.fecha))),
      h('p', { class: 'small' }, a.mensaje), h('div', { class: 'bar' }, h('span', { style: `width:${Math.round(a.leidos / a.total * 100)}%` })), h('p', { class: 'muted tiny' }, `Leído por ${a.leidos} de ${a.total}`)))
      : empty('📢', 'Aún no envías avisos.'));
}

async function adeudosAdmin() {
  state.tab = 'pmas';
  const body = h('div', {}, loading());
  screen('Adeudos y cargos', body, { back: () => go('pmas'), actions: h('button', { class: 'icon-btn', 'aria-label': 'Nuevo', onclick: () => nuevoAdeudo(null) }, '＋') });
  try {
    const d = (await cached('adeudosAdmin', {}, live(adeudosAdmin))).data;
    const act = d.adeudos.filter(a => a.estatus === 'activo');
    fill(body,
      h('div', { class: 'kpis' }, kpi('Por cobrar', money0(act.reduce((s, a) => s + a.saldo, 0)), `${act.length} adeudo(s) activos`),
        kpi('Cargos flotilla', money0(d.cargos.reduce((s, c) => s + c.monto, 0)), `${d.cargos.length} reparación(es)`)),
      section('Adeudos'),
      d.adeudos.length ? table([
        { t: 'Empleado', f: a => h('div', {}, h('strong', {}, a.nombre), h('div', { class: 'muted tiny' }, `${a.concepto} · ${a.adeudo_id}`)) },
        { t: 'Saldo', cls: 'num', f: a => money(a.saldo) },
        { t: 'Cuota', cls: 'num', f: a => money(a.cuota) },
        { t: '', f: a => h('span', { class: 'badge b-' + (a.estatus === 'activo' ? 'warn' : 'ok') }, a.estatus) },
      ], d.adeudos, async a => {
        const cuota = h('input', { class: 'input', type: 'number', value: a.cuota });
        const saldo = h('input', { class: 'input', type: 'number', value: a.saldo });
        const est = h('select', { class: 'input' }, [['activo', 'Activo'], ['liquidado', 'Liquidado'], ['cancelado', 'Cancelado']].map(([v, t]) => h('option', { value: v, selected: a.estatus === v || null }, t)));
        const ok = await modal(a.concepto + ' · ' + a.nombre, h('div', {}, h('label', { class: 'label' }, 'Cuota por quincena'), cuota, h('label', { class: 'label' }, 'Saldo'), saldo, h('label', { class: 'label' }, 'Estatus'), est), [['Cancelar', false], ['Guardar', true, 'primary']]);
        if (!ok) return;
        try { await busy('Guardando…', () => api('guardarAdeudo', { adeudo_id: a.adeudo_id, cuota: cuota.value, saldo: saldo.value, estatus: est.value })); adeudosAdmin(); } catch (e) { toast(e.message, 'error'); }
      }) : empty('💳', 'Sin adeudos.'),
      section('Cargos de flotilla a empleados'),
      d.cargos.length ? table([
        { t: 'Empleado', f: c => h('div', {}, h('strong', {}, c.nombre), h('div', { class: 'muted tiny' }, `${c.vehiculo_id} · ${c.descripcion}`)) },
        { t: 'Monto', cls: 'num', f: c => money(c.monto) },
        { t: 'Fecha', f: c => fecha(c.fecha) },
      ], d.cargos) : empty('🛵', 'La flotilla no tiene cargos a empleados.'),
      h('p', { class: 'muted small' }, 'Los cargos vienen de las reparaciones cerradas en la app de flotilla con monto al empleado. Se descuentan en la siguiente prenómina. Para ligarlos, captura el ID de flotilla en el expediente de cada empleado.'));
  } catch (e) { fill(body, errorBox(e)); }
}


// ═════════ Rutas ═════════
let leafletP = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return (leafletP = leafletP || new Promise((res, rej) => {
    document.head.append(h('link', { rel: 'stylesheet', href: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css' }));
    const sc = h('script', { src: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js' });
    sc.onload = () => res(window.L);
    sc.onerror = () => { leafletP = null; rej(new Error('No se pudo cargar el mapa (revisa tu señal).')); };
    document.head.append(sc);
  }));
}
const navUrl = p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;
const wazeUrl = p => `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
const isoHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Mapa de la ruta: círculos numerados, línea del recorrido y la base. Devuelve una función para enfocar una parada. */
async function rutaMapa(el, r) {
  const L = await loadLeaflet();
  const color = r.color || '#e4572e';
  const map = L.map(el, { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const dep = r.deposito || [19.4182, -99.1369];
  const line = r.geom && r.geom.length > 1 ? r.geom : [dep].concat(r.paradas.map(p => [p.lat, p.lng]));
  L.polyline(line, { color, weight: 5, opacity: 0.75 }).addTo(map);
  L.marker(dep, { icon: L.divIcon({ className: 'map-dep', html: '<div>C</div>', iconSize: [26, 26] }), zIndexOffset: 1000 }).addTo(map).bindTooltip('Salida: Lassaga 54');
  const marks = r.paradas.map((p, i) => L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'map-pin', html: `<div style="background:${color}">${i + 1}</div>`, iconSize: [26, 26] }) })
    .addTo(map).bindPopup(`<b>${i + 1}. ~${p.eta || ''}</b><br>${(p.envios || []).join(', ')}<br>${String(p.ref || '').replace(/</g, '&lt;')}`));
  map.fitBounds(L.latLngBounds([dep].concat(r.paradas.map(p => [p.lat, p.lng]))), { padding: [24, 24] });
  setTimeout(() => map.invalidateSize(), 200);
  return i => { map.setView([r.paradas[i].lat, r.paradas[i].lng], 16); marks[i].openPopup(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
}

async function rutaView(back) {
  const prev = state.tab;
  back = back || (() => go(prev === 'mas' ? 'mas' : 'inicio'));
  const body = h('div', {}, loading());
  screen('Mi ruta', body, { back, actions: h('button', { class: 'icon-btn', 'aria-label': 'Actualizar', onclick: () => rutaView(back) }, '↻') });
  let r, offline;
  try { ({ data: r, offline } = await cached('miRuta', {}, live(() => rutaView(back)))); } catch (e) { return fill(body, errorBox(e, () => rutaView(back))); }
  if (!r) return fill(body, empty('🗺️', 'Todavía no tienes ruta asignada. Te llega una notificación cuando esté lista.'));
  const color = r.color || '#e4572e';
  const mapEl = h('div', { class: 'ruta-map' }, h('div', { class: 'spinner' }));
  let enfocar = null;
  fill(body,
    offline && h('div', { class: 'banner warn' }, 'Sin conexión: mostrando la última ruta que se cargó.'),
    r.fecha !== isoHoy() && h('div', { class: 'banner info' }, 'Esta es tu ruta del ' + fecha(r.fecha) + '.'),
    h('div', { class: 'kpis' },
      kpi('Paradas', r.paradas.length, `${r.envios} envíos`),
      kpi('Salida', r.salida, 'desde Lassaga 54'),
      kpi('Terminas', r.fin, 'aprox.'),
      kpi('Distancia', num(r.km, 1) + ' km', `Ruta ${r.num} de ${r.total}`)),
    mapEl,
    section('Paradas en orden · toca una para verla en el mapa'),
    r.paradas.map((p, i) => h('div', { class: 'card parada', onclick: () => enfocar && enfocar(i) },
      h('div', { class: 'row gap8' },
        h('span', { class: 'pnum', style: `background:${color}` }, i + 1),
        h('div', { class: 'grow' },
          h('div', { class: 'row between' }, h('strong', {}, '~' + (p.eta || '')), p.tipo === 'same_day' ? h('span', { class: 'badge b-warn' }, 'Mismo día') : null),
          h('div', { class: 'small' }, h('strong', {}, (p.envios || []).length > 1 ? `Envíos (${p.envios.length}): ` : 'Envío: '), (p.envios || []).join(', ')),
          p.ref && h('div', { class: 'small' }, p.ref),
          h('div', { class: 'muted small' }, p.dir || `${p.lat}, ${p.lng}`),
          p.compromiso ? h('div', { class: 'small' }, h('strong', {}, 'Compromiso: '), p.compromiso) : null,
          p.espera ? h('div', { class: 'muted tiny' }, `Espera ${p.espera} min`) : null)),
      h('div', { class: 'row gap8 wrap', style: 'margin-top:8px' },
        h('a', { class: 'btn sm primary', href: navUrl(p), target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() }, '🧭 Navegar'),
        h('a', { class: 'btn sm', href: wazeUrl(p), target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() }, 'Waze'),
        p.tel && h('a', { class: 'btn sm', href: 'tel:' + p.tel, onclick: e => e.stopPropagation() }, '📞 Llamar')))),
    h('p', { class: 'muted small center' }, 'Si una dirección está mal, avísale a tu coordinador antes de salir.'));
  try { mapEl.replaceChildren(); enfocar = await rutaMapa(mapEl, r); } catch (e) { fill(mapEl, h('p', { class: 'muted small center', style: 'padding:20px' }, e.message)); }
}

async function shipdayVincularView() {
  state.tab = 'pmas';
  const body = h('div', {}, loading());
  screen('Repartidores en Shipday', body, { back: () => go('pmas') });
  let d;
  try { d = await api('shipdayRepartidores'); } catch (e) { return fill(body, errorBox(e, shipdayVincularView)); }
  const nombre = no => (d.empleados.find(e => e.no_empleado === no) || {}).nombre || '';
  const guardar = async (c, no) => {
    try { await api('vincularShipday', { shipday_id: c.id, no_empleado: no }); toast(no ? `${c.nombre} → ${nombre(no)}` : 'Desvinculado', 'ok'); shipdayVincularView(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const opts = sel => [h('option', { value: '' }, '— Sin vincular —')].concat(
    h('optgroup', { label: 'Repartidores' }, d.empleados.filter(e => e.repartidor).map(e => h('option', { value: e.no_empleado, selected: e.no_empleado === sel }, `${e.nombre} (No. ${e.no_empleado})`))),
    h('optgroup', { label: 'Otros' }, d.empleados.filter(e => !e.repartidor).map(e => h('option', { value: e.no_empleado, selected: e.no_empleado === sel }, `${e.nombre} (No. ${e.no_empleado})`))));
  const sin = d.repartidores.filter(c => c.activo && !c.no_empleado).length;
  fill(body,
    h('p', { class: 'muted small' }, 'El reporte y el seguimiento comparan por el ID de Shipday, no por nombre. Elige el empleado de cada repartidor; la sugerencia solo se guarda si la confirmas. Si alguien tiene dos cuentas en Shipday, vincula las dos al mismo empleado.'),
    sin > 0 && h('div', { class: 'banner warn' }, `${sin} repartidor(es) activos de Shipday sin vincular.`),
    d.repartidores.map(c => h('div', { class: 'card', style: c.activo ? '' : 'opacity:.6' },
      h('div', { class: 'row between' }, h('strong', {}, c.nombre || 'Sin nombre'), h('span', { class: 'muted tiny' }, 'ID ' + c.id + (c.activo ? '' : ' · inactivo'))),
      (c.telefono || c.correo) && h('div', { class: 'muted small' }, [c.telefono, c.correo].filter(Boolean).join(' · ')),
      h('select', { class: 'input', style: 'margin-top:8px', onchange: e => guardar(c, e.target.value) }, opts(c.no_empleado)),
      c.sugerido && h('div', { class: 'row between small', style: 'margin-top:6px' },
        h('span', { class: 'muted' }, 'Sugerido: ' + nombre(c.sugerido)), h('button', { class: 'btn sm primary', onclick: () => guardar(c, c.sugerido) }, 'Vincular')))));
}

const REC_EST = { propuesta: ['Por aprobar', 'warn'], asignada: ['Asignada', 'ok'], sin_capacidad: ['Sin capacidad', 'err'], sin_repartidor: ['Sin repartidor', 'err'], error: ['Error', 'err'], descartada: ['Descartada', 'muted'] };
const VOL = { bajo: ['Bajo', 'ok'], medio: ['Medio', 'warn'], alto: ['Alto', 'err'] };
async function recoleccionesView() {
  state.tab = modoPatron() ? 'pmas' : 'mas';
  const back = () => go(modoPatron() ? 'pmas' : 'mas');
  const body = h('div', {}, loading());
  screen('Recolecciones', body, { back, actions: h('button', { class: 'icon-btn', 'aria-label': 'Actualizar', onclick: () => recoleccionesView() }, '↻') });
  let d;
  try { d = await api('recolecciones'); } catch (e) { return fill(body, errorBox(e, recoleccionesView)); }
  const accion = async (label, fn, ok) => { try { const r = await busy(label, fn); toast(ok(r), 'ok', 5000); recoleccionesView(); } catch (e) { toast(e.message, 'error', 6000); } };
  const pend = d.recolecciones.filter(r => r.estado === 'propuesta');
  const prob = d.recolecciones.filter(r => ['sin_capacidad', 'sin_repartidor', 'error'].includes(r.estado));
  const sinVol = d.clientes.filter(c => !c.volumen);
  const optsRep = sel => [h('option', { value: '' }, '— Sin repartidor —')].concat(d.disponibles.map(x => h('option', { value: x.no_empleado, selected: x.no_empleado === sel }, `${x.nombre} (${x.puntos}/${d.capacidad})`)));
  const tarjeta = r => { const [l, c] = REC_EST[r.estado] || [r.estado, 'muted']; const [vl, vc] = VOL[r.volumen] || ['Sin clasificar', 'muted'];
    return h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, r.cliente), h('span', { class: 'badge b-' + c }, l)),
      h('div', { class: 'muted small' }, (r.order_number ? r.order_number + ' · ' : '') + (r.direccion || 'Sin dirección')),
      h('div', { class: 'row gap8 small', style: 'margin:6px 0' }, h('span', { class: 'badge b-' + vc }, `Volumen ${vl} · ${r.puntos} pt`), r.creada && h('span', { class: 'muted' }, 'creada ' + r.creada),
        r.lat != null && h('a', { href: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`, target: '_blank', rel: 'noopener' }, 'mapa')),
      r.nota && h('div', { class: 'muted tiny' }, r.nota),
      r.estado === 'asignada' ? h('div', { class: 'small' }, '✅ ' + r.nombre)
        : r.estado !== 'descartada' && [
          h('select', { class: 'input', onchange: e => accion('Cambiando…', () => api('recoleccionCambiar', { rec_id: r.rec_id, no_empleado: e.target.value }), () => 'Repartidor cambiado') }, optsRep(r.no_empleado)),
          h('div', { class: 'row gap8', style: 'margin-top:6px' },
            r.no_empleado && h('button', { class: 'btn sm primary', onclick: () => accion('Asignando en Shipday…', () => api('recoleccionAprobar', { rec_id: r.rec_id }), x => x.asignadas ? 'Asignada en Shipday' : x.errores.join(' · ')) }, 'Aprobar'),
            h('button', { class: 'btn sm', onclick: () => accion('Descartando…', () => api('recoleccionRechazar', { rec_id: r.rec_id }), () => 'Descartada') }, 'Descartar'))]); };
  fill(body,
    !d.shipday && h('div', { class: 'banner warn' }, 'Falta la key de Shipday (ruteador → Claves del servidor).'),
    d.proceso && d.proceso.en_proceso && h('div', { class: 'banner info small' }, `⏳ Recalculando desde Shipday del ${fecha(d.proceso.desde)} al ${fecha(d.proceso.hasta)} (va en ${fecha(d.proceso.va_en)}). Vuelve a abrir en unos minutos.`),
    h('div', { class: 'banner info small' }, `Modo: ${d.modo === 'automatico' ? 'automático' : d.modo === 'apagado' ? 'apagado' : 'con aprobación'} · se buscan cada 5 min hasta las ${d.hasta} · tope ${d.capacidad} puntos por repartidor (bajo 1 · medio 2 · alto 3).`),
    h('div', { class: 'row gap8' },
      h('button', { class: 'btn grow', onclick: () => accion('Buscando en Shipday…', () => api('recoleccionesBuscar'), r => r.nuevas ? `${r.nuevas} nueva(s)` : 'No hay recolecciones nuevas') }, '🔎 Buscar ahora'),
      pend.length > 0 && h('button', { class: 'btn primary grow', onclick: () => accion('Asignando en Shipday…', () => api('recoleccionAprobar', { todas: true }), r => `${r.asignadas} asignada(s)` + (r.errores.length ? ' · ' + r.errores.length + ' con error' : '')) }, `✅ Aprobar todas (${pend.length})`)),
    section(`Repartidores disponibles (${d.disponibles.length})`),
    d.disponibles.length ? h('div', { class: 'chips wrap' }, d.disponibles.map(x => h('span', { class: 'chip' }, `${primerNombre(x.nombre)} · llegó ${x.entrada} · ${x.puntos}/${d.capacidad} pt`)))
      : h('p', { class: 'muted small' }, 'Nadie ha checado entrada (o no tienen su cuenta de Shipday vinculada).'),
    sinVol.length > 0 && [section(`Clientes sin volumen (${sinVol.length})`), h('p', { class: 'muted small' }, 'Mientras no se clasifiquen cuentan como volumen medio.'),
      sinVol.map(c => h('div', { class: 'card row between' }, h('strong', {}, c.cliente),
        h('div', { class: 'row gap8' }, ['bajo', 'medio', 'alto'].map(v => h('button', { class: 'btn sm', onclick: () => accion('Guardando…', () => api('clienteVolumen', { cliente: c.cliente, volumen: v }), () => c.cliente + ': ' + v) }, VOL[v][0])))))],
    prob.length > 0 && [section(`Requieren atención (${prob.length})`), prob.map(tarjeta)],
    section(`Por aprobar (${pend.length})`), pend.length ? pend.map(tarjeta) : h('p', { class: 'muted small' }, 'Nada pendiente.'),
    section('Asignadas y descartadas'), d.recolecciones.filter(r => ['asignada', 'descartada'].includes(r.estado)).map(tarjeta),
    d.clientes.some(c => c.volumen) && h('details', { class: 'card' }, h('summary', {}, 'Volumen de todos los clientes'),
      d.clientes.filter(c => c.volumen).map(c => h('div', { class: 'row between small', style: 'margin-top:6px' }, h('span', {}, c.cliente),
        h('select', { class: 'input', style: 'width:auto', onchange: e => accion('Guardando…', () => api('clienteVolumen', { cliente: c.cliente, volumen: e.target.value }), () => 'Guardado') },
          ['bajo', 'medio', 'alto'].map(v => h('option', { value: v, selected: v === c.volumen }, VOL[v][0])))))));
}

async function gpsPruebaView(f) {
  state.tab = 'pmas';
  f = f || isoHoy();
  const body = h('div', {}, loading());
  screen('GPS y alertas', body, { back: () => go('pmas') });
  let d;
  try { d = await api('gpsPrueba', { fecha: f }); } catch (e) { return fill(body, errorBox(e)); }
  const TIPO = { detenido: ['Detenido', 'warn'], sin_senal: ['Sin señal (coordenada congelada)', 'err'], base: ['En la base', 'muted'] };
  fill(body,
    h('div', { class: 'row gap8' }, h('input', { type: 'date', value: f, class: 'grow', onchange: e => gpsPruebaView(e.target.value) }),
      h('button', { class: 'btn', onclick: async () => { try { const r = await api('gpsAhora'); toast(`${r.muestras} ubicación(es) guardadas`, 'ok'); gpsPruebaView(f); } catch (e) { toast(e.message, 'error'); } } }, 'Tomar muestra')),
    h('div', { class: 'banner ' + (d.modo === 'produccion' ? 'info' : 'warn') + ' small' }, d.modo === 'produccion'
      ? 'En producción: cada 5 min se toma la ubicación de Shipday. Si alguien con ruta activa queda 2 muestras seguidas a más de 800 m de su recorrido, o pasa 1 hora sin entregar ni marcar fallido, les llega un push a admins y patrón. La hora de comida (checada) no cuenta.'
      : d.modo === 'prueba' ? 'En prueba (GPS_MODO en ConfigPortal): se guarda la ubicación pero no se avisa de salidas de ruta.' : 'Apagado (GPS_MODO en ConfigPortal).'),
    (d.alertas || []).length > 0 && [section('Rutas de hoy'), d.alertas.map(a => h('div', { class: 'card', style: a.fuera ? 'border-left:5px solid var(--err)' : '' },
      h('div', {}, h('strong', {}, `Ruta ${a.num} · ${primerNombre(a.nombre)}`), h('small', { class: 'muted block' }, a.revisado ? `GPS ${a.revisado}${a.dist_m != null ? ' · a ' + kmTxt(a.dist_m) + ' de su recorrido' : ''}` : 'Sin GPS todavía')),
      h('div', { class: 'row gap8 wrap', style: 'margin-top:6px' }, a.fuera ? h('span', { class: 'badge b-err' }, 'Fuera de ruta desde ' + a.desde) : h('span', { class: 'badge b-ok' }, 'En ruta'),
        a.sin_entregar_h > 0 && h('span', { class: 'badge b-warn' }, `${a.sin_entregar_h} h sin entregar (${a.ina_hora})`),
        a.pos && h('a', { href: mapsQ(a.pos[0], a.pos[1]), target: '_blank', rel: 'noopener' }, 'mapa'))))],
    section('Muestras por repartidor'),
    !d.repartidores.length ? empty('🛰️', 'Aún no hay muestras para este día.') : d.repartidores.map(x => h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('strong', {}, x.empleado || x.nombre), h('span', { class: 'muted tiny' }, 'ID ' + x.carrier_id + (x.empleado ? '' : ' · sin vincular'))),
      h('div', { class: 'kpis', style: 'margin-top:6px' },
        kpi('Muestras', x.muestras, `${x.primera}–${x.ultima}`), kpi('Con GPS', x.con_gps, `${x.en_turno} en turno`, x.con_gps ? '' : 'err'),
        kpi('% con cambio', x.pct_cambio + '%', 'entre muestras', x.pct_cambio >= 50 ? 'ok' : 'warn'), kpi('Máx. congelado', x.max_congelado_min + ' min', 'misma coordenada exacta', x.max_congelado_min >= 30 ? 'err' : '')),
      x.paradas.length ? x.paradas.map(p => { const [l, c] = TIPO[p.tipo]; return h('div', { class: 'row between small', style: 'margin-top:6px' },
        h('span', {}, `${p.desde}–${p.hasta} · ${p.min} min`), h('span', { class: 'row gap8' }, h('span', { class: 'badge b-' + c }, l),
          h('a', { href: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`, target: '_blank', rel: 'noopener' }, 'mapa'))); })
        : h('p', { class: 'muted small' }, 'Sin paradas de 15+ min.'))));
}

async function rutaSegView(r, f) {
  const body = h('div', {}, loading());
  screen(`Ruta ${r.num} · ${primerNombre(r.nombre)}`, body, { back: () => rutasAdminView(f) });
  let d;
  try { d = await api('seguimientoRuta', { ruta_id: r.ruta_id }); } catch (e) { return fill(body, errorBox(e)); }
  const x = d.seguimiento;
  const EST = { entregado: ['Entregado', 'ok', '✅'], fallido: ['Fallido', 'err', '❌'], pendiente: ['Pendiente', 'muted', '⏳'] };
  fill(body,
    h('div', { class: 'kpis' }, kpi('Entregados', `${x.entregados}/${x.total}`, '', 'ok'), kpi('Pendientes', x.pendientes, '', x.pendientes ? 'warn' : 'ok'),
      kpi('Fallidos', x.fallidos, '', x.fallidos ? 'err' : ''), kpi('Fin aprox', x.fin_estimado || '—', 'límite ' + x.limite, x.estado === 'tarde' ? 'err' : 'ok')),
    x.estado === 'tarde' && h('div', { class: 'banner error' }, `Con el tráfico actual terminaría ${x.retraso_min} min después del límite.`),
    section('Paradas'),
    d.paradas.map(p => { const done = p.envios.every(e => e.estado !== 'pendiente');
      return h('div', { class: 'card', style: done ? 'opacity:.72' : '' },
        h('div', { class: 'row between' }, h('strong', {}, `${p.orden}. ~${p.eta}`), h('span', { class: 'muted small' }, p.ref || '')),
        h('div', { class: 'muted small' }, p.dir || ''),
        p.envios.map(e => { const [l, c, i] = EST[e.estado] || EST.pendiente; return h('div', { class: 'row between small', style: 'margin-top:4px' },
          h('span', {}, `${i} ${e.envio}`), h('span', { class: 'badge b-' + c }, l + (e.hora && e.estado !== 'pendiente' ? ' ' + e.hora : ''))); })); }),
    h('p', { class: 'muted small center' }, 'Revisado ' + (x.actualizado || '—') + ' · estado tomado de Shipday (ML-envío)'));
}

const CAL = { Bien: 'ok', Regular: 'warn', Mal: 'err', 'Sin datos': 'muted' };
const EST_PARADA = { entregado: ['Entregado', 'ok'], parcial: ['Parcial', 'warn'], fallido: ['Fallido', 'err'], pendiente: ['Sin entregar', 'err'], no_en_shipday: ['No está en Shipday', 'muted'] };
async function rutasAdminView(f) {
  state.tab = modoPatron() ? 'pmas' : 'mas';
  f = f || isoHoy();
  const body = h('div', {}, loading());
  screen('Rutas y reporte', body, { back: () => go(modoPatron() ? 'pmas' : 'mas') });
  let d;
  try { d = (await cached('rutasAdmin', { fecha: f }, live(() => rutasAdminView(f)))).data; } catch (e) { return fill(body, errorBox(e, () => rutasAdminView(f))); }
  const rep = {}; (d.reporte || []).forEach(x => rep[x.ruta_id] = x);
  const generar = async () => { try { await busy('Consultando Shipday…', () => api('reporteRutas', { fecha: f })); toast('Reporte actualizado', 'ok'); rutasAdminView(f); } catch (e) { toast(e.message, 'error', 6000); } };
  const esHoy = f === isoHoy();
  const vivo = async () => { try { const r = await busy('Revisando Shipday…', () => api('seguimientoAhora')); toast(r.avisos ? `${r.avisos} aviso(s) nuevos` : 'Sin cambios', 'ok'); rutasAdminView(f); } catch (e) { toast(e.message, 'error', 6000); } };
  const seg = d.rutas.map(r => r.seguimiento || {});
  const tot = seg.reduce((a, x) => ({ t: a.t + (x.total || 0), e: a.e + (x.entregados || 0), f: a.f + (x.fallidos || 0), p: a.p + (x.pendientes || 0), tarde: a.tarde + (x.estado === 'tarde' ? 1 : 0) }), { t: 0, e: 0, f: 0, p: 0, tarde: 0 });
  if (esHoy && d.rutas.length) { const sq = state.seq; setTimeout(() => { if (state.seq === sq) rutasAdminView(f); }, 90000); }
  fill(body,
    h('div', { class: 'row gap8' }, h('input', { type: 'date', value: f, class: 'grow', onchange: e => rutasAdminView(e.target.value) }),
      h('a', { class: 'btn primary', href: 'ruteador.html' }, '🧭 Ruteador')),
    esHoy && d.rutas.length > 0 && d.shipday && [
      section('En vivo'),
      tot.tarde > 0 && h('div', { class: 'banner error' }, h('strong', {}, `⚠️ ${tot.tarde} ruta(s) ya no alcanzan a terminar a tiempo`), h('div', { class: 'small' }, 'Con el tráfico actual y lo que les queda. Considera mandar apoyo.')),
      h('div', { class: 'kpis' }, kpi('Entregados', `${tot.e}/${tot.t}`, tot.t ? Math.round(tot.e / tot.t * 100) + '%' : '', 'ok'), kpi('Pendientes', tot.p, 'por entregar', tot.p ? 'warn' : 'ok'),
        kpi('Fallidos', tot.f, 'marcados en Shipday', tot.f ? 'err' : ''), kpi('Rutas tarde', tot.tarde, 'según recálculo', tot.tarde ? 'err' : 'ok')),
      h('div', { class: 'row between' }, h('span', { class: 'muted small' }, 'Se revisa Shipday cada 10 min · se actualiza solo'), h('button', { class: 'btn sm', onclick: vivo }, '↻ Revisar ahora'))],
    section(`Rutas publicadas (${d.rutas.length})`),
    d.rutas.length ? d.rutas.map(r => { const x = r.seguimiento || {}; const pct = x.total ? Math.round((x.entregados + x.fallidos) / x.total * 100) : 0;
      const est = x.estado === 'tarde' ? h('span', { class: 'badge b-err' }, `Tarde +${x.retraso_min} min`) : x.estado === 'a_tiempo' ? h('span', { class: 'badge b-ok' }, 'A tiempo') : x.estado === 'terminada' ? h('span', { class: 'badge b-info' }, 'Terminada') : h('span', { class: 'badge b-muted' }, r.visto ? 'Vista' : 'Sin abrir');
      return h('button', { class: 'card tap ruta-live', style: x.estado === 'tarde' ? 'border-left:5px solid var(--err)' : '', onclick: () => rutaSegView(r, f) },
        h('div', { class: 'row between' }, h('strong', {}, `Ruta ${r.num} · ${r.nombre}`), est),
        h('div', { class: 'bar' }, h('span', { style: `width:${pct}%` })),
        h('div', { class: 'row between small' },
          h('span', {}, `✅ ${x.entregados || 0}  ❌ ${x.fallidos || 0}  ⏳ ${x.pendientes ?? r.envios}`),
          h('span', { class: 'muted' }, x.actualizado ? `Fin aprox ${x.fin_estimado} · límite ${x.limite}` : `${r.salida}–${r.fin} · límite ${x.limite || ''}`)),
        x.actualizado && h('div', { class: 'muted tiny' }, 'Revisado ' + x.actualizado + (rep[r.ruta_id] ? ' · reporte: ' + rep[r.ruta_id].calificacion : ''))); })
      : empty('🗺️', 'No hay rutas publicadas para este día. Ármalas en el ruteador y toca "Publicar en la super app".'),
    section('Reporte contra Shipday'),
    !d.shipday ? h('div', { class: 'banner warn' }, 'Falta la key de Shipday. Guárdala en el ruteador → Claves del servidor.')
      : d.rutas.length ? h('div', {},
        h('button', { class: 'btn block', onclick: generar }, d.reporte.length ? '↻ Actualizar reporte' : 'Generar reporte ahora'),
        h('p', { class: 'muted small' }, 'Se genera solo después de las 23:00 (límite de entrega) y te llega por correo. Compara el orden y la hora de cada entrega en Shipday (ML-número) contra lo planeado.')) : null,
    (d.reporte || []).sort((a, b) => a.nombre.localeCompare(b.nombre)).map(x => h('details', { class: 'card' },
      h('summary', { class: 'row between' }, h('strong', {}, x.nombre), h('span', { class: 'badge b-' + CAL[x.calificacion] }, x.calificacion)),
      h('div', { class: 'kpis', style: 'margin-top:8px' },
        kpi('Entregados', `${x.entregados}/${x.envios}`, x.no_entregados ? `${x.no_entregados} sin entregar` : 'todos', x.no_entregados ? 'err' : 'ok'),
        kpi('En orden', x.pct_orden + '%', x.fuera_orden ? `${x.fuera_orden} parada(s) fuera de orden` : 'siguió el orden', x.pct_orden < 85 ? 'warn' : 'ok'),
        kpi('Tarde', x.tarde, `retraso prom. ${x.retraso_prom} min`, x.tarde ? 'warn' : ''),
        kpi('Terminó', x.fin_real || '—', 'planeado ' + x.fin_plan, x.fin_real && x.fin_real > x.fin_plan ? 'warn' : '')),
      x.otros_repartidores && h('div', { class: 'banner warn small' }, 'En Shipday aparece entregado por: ' + x.otros_repartidores),
      table([
        { t: '#', f: p => p.o },
        { t: 'Plan', f: p => p.eta },
        { t: 'Real', f: p => p.real || '—' },
        { t: 'Dif.', cls: 'num', f: p => p.dif == null ? '' : h('span', { class: p.dif > 20 ? 'late' : '' }, (p.dif > 0 ? '+' : '') + p.dif + ' min') },
        { t: 'Estado', f: p => { const [l, c] = EST_PARADA[p.estado] || [p.estado, 'muted']; return h('span', { class: 'badge b-' + c }, l + (p.envios > 1 ? ` ${p.entregados}/${p.envios}` : '')); } },
      ], x.detalle || []),
      h('p', { class: 'muted tiny' }, 'Generado ' + x.generado))));
}

// ═════════ Mis datos: domicilio con pin y contactos de emergencia ═════════
const ESTADOS_MX = ['Ciudad de México', 'Estado de México', 'Hidalgo', 'Morelos', 'Puebla', 'Tlaxcala', 'Otro'];
const PARENTESCOS = ['Mamá', 'Papá', 'Esposa', 'Esposo', 'Pareja', 'Hermana', 'Hermano', 'Hija', 'Hijo', 'Tía', 'Tío', 'Abuela', 'Abuelo', 'Prima', 'Primo', 'Suegra', 'Suegro', 'Cuñada', 'Cuñado', 'Amiga', 'Amigo', 'Otro'];
const enZona = (lat, lng) => lat > 18.3 && lat < 20.7 && lng > -100.7 && lng < -97.7;
function distM(a, b) { const R = 6371000, t = Math.PI / 180; const x = Math.sin((b[0] - a[0]) * t / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin((b[1] - a[1]) * t / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
const kmTxt = m => m >= 1000 ? num(m / 1000, 1) + ' km' : Math.round(m) + ' m';
const mapsQ = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
const telFmt = t => { const d = String(t || '').replace(/\D/g, '').slice(-10); return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}` : t; };
const waUrl = t => `https://wa.me/52${String(t || '').replace(/\D/g, '').slice(-10)}`;

let nomUlt = 0;
async function nominatim(path) {
  const espera = 1100 - (Date.now() - nomUlt); if (espera > 0) await new Promise(r => setTimeout(r, espera)); // máx. 1 consulta por segundo
  nomUlt = Date.now();
  const r = await fetch('https://nominatim.openstreetmap.org/' + path + '&format=jsonv2&addressdetails=1&accept-language=es', { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('No se pudo consultar el mapa');
  return r.json();
}
function partesNominatim(a = {}) {
  return { calle: [a.road, a.house_number].filter(Boolean).join(' '), colonia: a.neighbourhood || a.suburb || a.quarter || a.hamlet || '',
    cp: a.postcode || '', municipio: a.city_district || a.borough || a.municipality || a.town || a.city || a.county || '',
    estado: /ciudad de m/i.test(a.state || a.city || '') ? 'Ciudad de México' : /^(estado de )?m[eé]xico$/i.test(a.state || '') ? 'Estado de México' : (ESTADOS_MX.find(e => e === a.state) || '') };
}

/** Domicilio con mapa: el empleado escribe su dirección, se ubica en el mapa y ajusta el pin a su puerta. */
async function domicilioView(opt = {}) {
  const back = opt.back || (() => perfilView());
  const d = Object.assign({ estado: 'Ciudad de México' }, opt.domicilio || {});
  const body = h('div', {});
  screen(opt.nombre ? 'Domicilio · ' + primerNombre(opt.nombre) : 'Mi domicilio', body, { back });
  const f = {};
  const inp = (k, label, attrs = {}) => { f[k] = h('input', { class: 'input', value: d[k] ?? '', ...attrs }); return h('div', {}, h('label', { class: 'label' }, label), f[k]); };
  f.estado = h('select', { class: 'input' }, ESTADOS_MX.map(e => h('option', { value: e, selected: d.estado === e || null }, e)));
  const mapEl = h('div', { class: 'ruta-map casa-map' }, h('div', { class: 'spinner' }));
  const info = h('div', { class: 'small', style: 'min-height:20px;margin-top:4px' });
  const aviso = h('div', {});
  let pin = d.lat != null ? [d.lat, d.lng] : null, geo = null, rev = null, map = null, marker = null, L = null, revT = null;
  const datosForm = () => ({ calle: f.calle.value.trim(), colonia: f.colonia.value.trim(), cp: f.cp.value.replace(/\D/g, ''), municipio: f.municipio.value.trim(), estado: f.estado.value, referencias: f.referencias.value.trim() });
  const pintarAviso = () => {
    const x = datosForm(), w = [];
    if (pin && geo) { const dd = distM(pin, geo); if (dd > 1500) w.push(`El pin está a ${kmTxt(dd)} de donde el mapa ubica la dirección que escribiste. Revisa que esté en tu casa.`); }
    if (rev && rev.cp && x.cp.length === 5 && rev.cp.replace(/\D/g, '') !== x.cp) w.push(`Según el mapa, el pin está en el CP ${rev.cp} y escribiste ${x.cp}.`);
    fill(aviso, w.length ? h('div', { class: 'banner warn small' }, w.map(t => h('div', {}, '⚠️ ' + t))) : null);
  };
  const ponerPin = (ll, zoom) => {
    pin = [+ll[0].toFixed(6), +ll[1].toFixed(6)];
    if (map) { if (!marker) { marker = L.marker(pin, { draggable: true, autoPan: true }).addTo(map); marker.on('dragend', () => ponerPin([marker.getLatLng().lat, marker.getLatLng().lng])); } else marker.setLatLng(pin); if (zoom) map.setView(pin, zoom); }
    clearTimeout(revT);
    fill(info, h('span', { class: 'muted' }, 'Revisando el lugar del pin…'));
    revT = setTimeout(async () => {
      try {
        const r = await nominatim(`reverse?lat=${pin[0]}&lon=${pin[1]}&zoom=18`);
        rev = partesNominatim(r.address);
        const llenar = ['colonia', 'cp', 'municipio'].some(k => !f[k].value.trim() && rev[k]);
        fill(info, h('span', {}, '📍 El pin está en: ', h('strong', {}, [rev.calle, rev.colonia, rev.municipio, rev.cp && 'CP ' + rev.cp].filter(Boolean).join(', ') || 'un lugar sin nombre en el mapa')),
          llenar && h('button', { class: 'link', style: 'margin-left:6px', onclick: () => { ['colonia', 'cp', 'municipio'].forEach(k => { if (!f[k].value.trim() && rev[k]) f[k].value = rev[k]; }); if (rev.estado) f.estado.value = rev.estado; if (!f.calle.value.trim() && rev.calle) f.calle.value = rev.calle; pintarAviso(); } }, 'Llenar con esto'));
      } catch { fill(info, h('span', { class: 'muted' }, `📍 ${pin[0]}, ${pin[1]}`)); rev = null; }
      pintarAviso();
    }, 700);
  };
  const buscar = async () => {
    const x = datosForm();
    if (!x.calle && !x.cp) return toast('Escribe tu calle y número o tu código postal', 'error');
    try {
      let r = [];
      await busy('Buscando en el mapa…', async () => {
        const base = 'search?countrycodes=mx&limit=1';
        if (x.calle) r = await nominatim(`${base}&street=${encodeURIComponent(x.calle)}${x.cp ? '&postalcode=' + x.cp : ''}${x.municipio ? '&city=' + encodeURIComponent(x.municipio) : ''}&state=${encodeURIComponent(x.estado === 'Otro' ? '' : x.estado)}`);
        if (!r.length && x.calle) r = await nominatim(`${base}&q=${encodeURIComponent([x.calle, x.colonia, x.municipio, x.estado !== 'Otro' && x.estado, x.cp].filter(Boolean).join(', '))}`);
        if (!r.length && x.cp) { r = await nominatim(`${base}&postalcode=${x.cp}`); if (r.length) r[0].soloCp = true; }
      });
      if (!r.length) return toast('No encontré esa dirección. Mueve el mapa y toca tu casa.', 'error', 5000);
      geo = [+r[0].lat, +r[0].lon];
      if (!enZona(geo[0], geo[1])) { geo = null; return toast('Esa dirección quedó fuera de la zona; revisa estado y CP.', 'error', 5000); }
      ponerPin(geo, r[0].soloCp ? 15 : 18);
      toast(r[0].soloCp ? 'No encontré la calle exacta: te dejé en tu código postal. Mueve el pin a tu casa.' : 'Listo. Ajusta el pin justo en tu puerta.', 'info', 5000);
    } catch (e) { toast(e.message, 'error'); }
  };
  const miUbicacion = () => {
    if (!navigator.geolocation) return toast('Tu celular no permite ubicarte desde aquí', 'error');
    toast('Buscando tu ubicación…', 'info', 2500);
    navigator.geolocation.getCurrentPosition(p => {
      if (!enZona(p.coords.latitude, p.coords.longitude)) return toast('Tu ubicación quedó fuera de la zona. Pon el pin a mano.', 'error');
      ponerPin([p.coords.latitude, p.coords.longitude], 18);
      if (p.coords.accuracy > 80) toast(`Tu ubicación tiene ±${Math.round(p.coords.accuracy)} m de error: acomoda el pin en tu puerta.`, 'info', 5000);
    }, () => toast('No pude obtener tu ubicación (revisa el permiso de ubicación)', 'error'), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const guardar = async () => {
    const x = datosForm();
    if (x.calle.length < 4) return toast('Escribe tu calle y número', 'error');
    if (!/^\d{5}$/.test(x.cp)) return toast('El código postal debe tener 5 dígitos', 'error');
    if (!x.colonia || !x.municipio) return toast('Falta la colonia o la alcaldía/municipio', 'error');
    if (!pin) return toast('Coloca el pin de tu casa en el mapa (toca "Buscar en el mapa" o toca el mapa)', 'error', 5000);
    if (!geo) { try { const r = await nominatim(`search?countrycodes=mx&limit=1&q=${encodeURIComponent([x.calle, x.colonia, x.municipio, x.cp].join(', '))}`); if (r.length) geo = [+r[0].lat, +r[0].lon]; } catch {} }
    const dist = geo ? Math.round(distM(pin, geo)) : '';
    if (dist !== '' && dist > 1500 && !await confirmar('¿El pin está bien?', `El pin está a ${kmTxt(dist)} de donde el mapa ubica la dirección que escribiste. Si el pin está en tu casa, guárdalo así.`, 'Sí, está en mi casa')) return;
    try {
      const data = { domicilio: Object.assign(x, { lat: pin[0], lng: pin[1], dist_m: dist }) };
      if (opt.no_empleado) data.no_empleado = opt.no_empleado;
      await busy('Guardando…', () => api(opt.no_empleado ? 'guardarDatosDe' : 'guardarMisDatos', data));
      toast('Domicilio guardado', 'ok'); back();
    } catch (e) { toast(e.message, 'error', 5000); }
  };
  fill(body,
    h('p', { class: 'muted small' }, opt.no_empleado ? 'Domicilio del empleado. El pin debe quedar en la puerta de su casa.' : 'Lo usamos para darte rutas que terminen cerca de tu casa y para cualquier emergencia. Solo lo ven RH y los coordinadores.'),
    inp('calle', 'Calle y número (exterior e interior)', { placeholder: 'Ej. Av. Central 123 int. 4', autocomplete: 'address-line1' }),
    h('div', { class: 'grid2' }, inp('colonia', 'Colonia'), inp('cp', 'Código postal', { inputmode: 'numeric', maxlength: 5, autocomplete: 'postal-code' })),
    h('div', { class: 'grid2' }, inp('municipio', 'Alcaldía o municipio'), h('div', {}, h('label', { class: 'label' }, 'Estado'), f.estado)),
    inp('referencias', 'Referencias (opcional)', { placeholder: 'Entre calles, color de la casa, portón…' }),
    h('div', { class: 'row gap8 wrap', style: 'margin-top:10px' }, h('button', { class: 'btn', onclick: buscar }, '🔎 Buscar en el mapa'), !opt.no_empleado && h('button', { class: 'btn', onclick: miUbicacion }, '📍 Estoy en mi casa')),
    mapEl, info, aviso,
    h('p', { class: 'muted tiny' }, 'Arrastra el pin o toca el mapa para dejarlo justo en la puerta de la casa.'),
    h('button', { class: 'btn primary block', onclick: guardar }, 'Guardar domicilio'));
  f.cp.addEventListener('input', () => { f.cp.value = f.cp.value.replace(/\D/g, '').slice(0, 5); pintarAviso(); });
  try {
    L = await loadLeaflet();
    mapEl.replaceChildren();
    map = L.map(mapEl, { zoomControl: true }).setView(pin || [19.4326, -99.1332], pin ? 18 : 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    map.on('click', e => ponerPin([e.latlng.lat, e.latlng.lng]));
    if (pin) ponerPin(pin);
    setTimeout(() => map.invalidateSize(), 200);
  } catch (e) { fill(mapEl, h('p', { class: 'muted small center', style: 'padding:20px' }, e.message)); }
}

/** Dos contactos de emergencia: nombre, teléfono y parentesco. */
function contactosView(opt = {}) {
  const back = opt.back || (() => perfilView());
  const cs = [0, 1].map(i => Object.assign({ nombre: '', telefono: '', parentesco: '' }, (opt.contactos || [])[i] || {}));
  const campos = cs.map((c, i) => {
    const enLista = !c.parentesco || PARENTESCOS.includes(c.parentesco);
    const x = {
      nombre: h('input', { class: 'input', value: c.nombre, placeholder: 'Nombre y apellido', autocomplete: 'off' }),
      tel: h('input', { class: 'input', value: c.telefono ? telFmt(c.telefono) : '', type: 'tel', inputmode: 'tel', placeholder: '55 1234 5678' }),
      par: h('select', { class: 'input' }, h('option', { value: '' }, '— Elige —'), PARENTESCOS.map(p => h('option', { value: p, selected: (enLista ? c.parentesco === p : p === 'Otro') || null }, p))),
      otro: h('input', { class: 'input', value: enLista ? '' : c.parentesco, placeholder: '¿Qué es de ti?', style: enLista ? 'display:none' : '' }),
    };
    x.par.onchange = () => { x.otro.style.display = x.par.value === 'Otro' ? '' : 'none'; };
    const pick = 'contacts' in navigator && navigator.contacts && 'select' in navigator.contacts && h('button', { class: 'btn sm', onclick: async () => {
      try { const [k] = await navigator.contacts.select(['name', 'tel'], { multiple: false }); if (!k) return; if (k.name && k.name[0]) x.nombre.value = k.name[0]; if (k.tel && k.tel[0]) x.tel.value = telFmt(k.tel[0]); } catch {}
    } }, '📇 Elegir de mis contactos');
    x.el = h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', {}, `Contacto ${i + 1}`), pick || null),
      h('label', { class: 'label' }, 'Nombre completo'), x.nombre, h('div', { class: 'grid2' }, h('div', {}, h('label', { class: 'label' }, 'Teléfono (10 dígitos)'), x.tel),
        h('div', {}, h('label', { class: 'label' }, 'Parentesco'), x.par, x.otro)));
    return x;
  });
  const guardar = async () => {
    const contactos = campos.map(x => ({ nombre: x.nombre.value.trim(), telefono: x.tel.value.replace(/\D/g, '').slice(-10), parentesco: x.par.value === 'Otro' ? (x.otro.value.trim() || '') : x.par.value }));
    for (const [i, c] of contactos.entries()) {
      if (c.nombre.split(/\s+/).length < 2) return toast(`Contacto ${i + 1}: escribe nombre y apellido`, 'error');
      if (c.telefono.length !== 10) return toast(`Contacto ${i + 1}: el teléfono debe tener 10 dígitos`, 'error');
      if (!c.parentesco) return toast(`Contacto ${i + 1}: elige el parentesco`, 'error');
    }
    if (contactos[0].telefono === contactos[1].telefono) return toast('Pon a dos personas distintas (los teléfonos son iguales)', 'error');
    try {
      const data = { contactos }; if (opt.no_empleado) data.no_empleado = opt.no_empleado;
      await busy('Guardando…', () => api(opt.no_empleado ? 'guardarDatosDe' : 'guardarMisDatos', data));
      toast('Contactos guardados', 'ok'); back();
    } catch (e) { toast(e.message, 'error', 5000); }
  };
  screen(opt.nombre ? 'Emergencias · ' + primerNombre(opt.nombre) : 'Contactos de emergencia', h('div', {},
    h('p', { class: 'muted small' }, 'Dos personas a quienes llamar si te pasa algo en la calle, para avisarles cómo estás. Que sean de confianza y que contesten.'),
    campos.map(x => x.el),
    h('button', { class: 'btn primary block', onclick: guardar }, 'Guardar contactos')), { back });
}

function datosCards(p, opt = {}) {
  const dm = p.domicilio || {}, cs = p.contactos || [];
  const ed = Object.assign({}, opt);
  return [
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, '🏠 Domicilio'), h('button', { class: 'btn sm', onclick: () => domicilioView(Object.assign({ domicilio: dm }, ed)) }, dm.texto ? 'Editar' : 'Agregar')),
      dm.texto ? [h('p', { class: 'small' }, dm.texto), dm.referencias && h('p', { class: 'muted small' }, dm.referencias),
        dm.lat != null && h('a', { class: 'small', href: mapsQ(dm.lat, dm.lng), target: '_blank', rel: 'noopener' }, '📍 Ver el pin en el mapa'),
        dm.dist_m > 1500 && h('p', { class: 'tiny late' }, `El pin está a ${kmTxt(dm.dist_m)} de la dirección escrita.`)]
        : h('p', { class: 'small late' }, 'Falta el domicilio con su pin en el mapa.')),
    h('div', { class: 'card' },
      h('div', { class: 'row between' }, h('h3', {}, '🚨 Contactos de emergencia'), h('button', { class: 'btn sm', onclick: () => contactosView(Object.assign({ contactos: cs }, ed)) }, cs.some(c => c.nombre) ? 'Editar' : 'Agregar')),
      cs.some(c => c.nombre) ? cs.map(c => c.nombre && h('div', { class: 'kv' }, h('span', {}, h('strong', {}, c.nombre), h('small', { class: 'muted block' }, c.parentesco)),
        h('a', { href: 'tel:' + c.telefono }, telFmt(c.telefono)))) : h('p', { class: 'small late' }, 'Faltan los 2 contactos de emergencia.')),
  ];
}

// ═════════ Desempeño (entregas exitosas por día, semana y mes) ═════════
const pctTxt = v => v == null ? '—' : num(v, 1) + '%';
function serieBarras(serie) {
  if (!serie || !serie.length) return null;
  const mx = Math.max(1, ...serie.map(s => s.ent + s.fal));
  return h('div', { class: 'barras' }, serie.map(s => h('div', { class: 'barra', title: `${fecha(s.fecha)}: ${s.ent} entregados, ${s.fal} fallidos` },
    h('span', { class: 'b-fal', style: `height:${s.fal / mx * 100}%` }), h('span', { class: 'b-ent', style: `height:${s.ent / mx * 100}%` }), h('small', {}, Number(s.fecha.slice(8))))));
}
function desempenoCard(d) {
  if (!d) return null;
  const j = d.jerarquia;
  return h('button', { class: 'card tap', onclick: () => desempenoView() },
    h('div', { class: 'row between' }, h('h3', {}, '📦 Tus entregas'), j ? h('span', { class: 'badge b-info' }, `Lugar ${j.rank} de ${j.de}`) : h('span', { class: 'chev' }, '›')),
    h('div', { class: 'kpis', style: 'margin-top:6px' }, kpi('Hoy', d.dia.ent, d.dia.fal ? `${d.dia.fal} fallido(s)` : 'entregados', 'ok'),
      kpi('Semana', d.semana.ent, pctTxt(d.semana.pct) + ' de éxito', d.semana.pct != null && d.semana.pct < 90 ? 'warn' : '')));
}
async function desempenoView(f) {
  const prev = state.tab;
  const body = h('div', {}, loading());
  screen('Mis entregas', body, { back: () => go(prev === 'mas' ? 'mas' : 'inicio') });
  let d;
  try { d = (await cached('desempeno', f ? { fecha: f } : {}, live(() => desempenoView(f)))).data; } catch (e) { return fill(body, errorBox(e)); }
  const j = d.jerarquia;
  fill(body,
    h('div', { class: 'kpis' },
      kpi('Hoy', d.dia.ent, d.dia.fal ? `${d.dia.fal} fallido(s) · ${pctTxt(d.dia.pct)}` : 'entregados', 'ok'),
      kpi('Esta semana', d.semana.ent, `${pctTxt(d.semana.pct)} de éxito`),
      kpi('Este mes', d.mes.ent, `${pctTxt(d.mes.pct)} · ${d.mes.dias} día(s)`),
      kpi('Tu lugar', j ? `${j.rank} de ${j.de}` : '—', j ? `${num(j.score, 1)} puntos` : 'sin entregas aún', j && j.rank <= 3 ? 'ok' : '')),
    section('Últimos 14 días'),
    d.serie.length ? h('div', { class: 'card' }, serieBarras(d.serie), h('p', { class: 'muted tiny' }, '🟩 entregados · 🟥 fallidos o incompletos')) : empty('📦', 'Aún no hay entregas registradas.'),
    h('div', { class: 'card soft' }, h('h3', {}, '¿Cómo se calcula tu lugar?'),
      h('p', { class: 'small' }, `Cuenta los últimos ${d.dias_jerarquia} días en Shipday: tu % de entregas exitosas y cuántos paquetes entregaste. Los primeros lugares tienen preferencia al repartir las rutas (por ejemplo, rutas que terminan cerca de su casa).`)));
}

async function entregasEquipoView(f, per = 'dia') {
  state.tab = modoPatron() ? 'pmas' : 'mas';
  f = f || isoHoy();
  const body = h('div', {}, loading());
  screen('Desempeño de repartidores', body, { back: () => go(state.tab) });
  let d;
  try { d = (await cached('historialEntregas', { fecha: f }, live(() => entregasEquipoView(f, per)))).data; } catch (e) { return fill(body, errorBox(e, () => entregasEquipoView(f, per))); }
  const actualizar = async (desde) => {
    try { const r = await busy(desde ? 'Programando…' : 'Consultando Shipday (≈1 min)…', () => api('historialActualizar', { desde: desde || f, hasta: f }));
      toast(r.programado ? 'Se está recalculando en segundo plano (Shipday permite 5 consultas por minuto). Tarda unos minutos.' : `${r.entregados} entregas en ${r.filas} registro(s)` + (r.sin_vincular ? ` · ${r.sin_vincular} sin vincular` : ''), 'ok', 6000); entregasEquipoView(f, per); }
    catch (e) { toast(e.message, 'error', 6000); }
  };
  const etiqueta = { dia: fecha(f), semana: `${fecha(d.semana[0])} – ${fecha(d.semana[1])}`, mes: `${fecha(d.mes[0])} – ${fecha(d.mes[1])}` }[per];
  const lista = d.repartidores.filter(r => r.vinculado || r[per].total);
  fill(body,
    h('div', { class: 'row gap8' }, h('input', { type: 'date', value: f, class: 'grow input sm', onchange: e => entregasEquipoView(e.target.value, per) }),
      h('button', { class: 'btn sm', onclick: () => actualizar() }, '↻ Shipday')),
    segmented([['dia', 'Día'], ['semana', 'Semana'], ['mes', 'Mes']], per, v => entregasEquipoView(f, v)),
    !d.shipday && h('div', { class: 'banner warn' }, 'Falta la key de Shipday (ruteador → Claves del servidor).'),
    d.proceso && d.proceso.en_proceso && h('div', { class: 'banner info small' }, `⏳ Recalculando desde Shipday del ${fecha(d.proceso.desde)} al ${fecha(d.proceso.hasta)} (va en ${fecha(d.proceso.va_en)}). Vuelve a abrir en unos minutos.`),
    h('p', { class: 'muted small' }, `${etiqueta} · lugar según los últimos ${d.jerarquia.dias} días (${Math.round(d.jerarquia.peso_exito * 100)}% éxito, ${Math.round((1 - d.jerarquia.peso_exito) * 100)}% volumen)` + (d.actualizado ? ` · actualizado ${fechaHora(d.actualizado)}` : '')),
    lista.length ? lista.map(r => { const x = r[per], j = r.jerarquia;
      return h('details', { class: 'card' },
        h('summary', { class: 'row between' }, h('span', { class: 'row gap8' }, h('span', { class: 'rank' + (j && j.rank <= 3 ? ' top' : '') }, j ? j.rank : '–'),
          h('span', {}, h('strong', {}, r.nombre), !r.vinculado && h('small', { class: 'late block' }, 'Sin vincular · Shipday ' + r.carrier_ids))),
          h('span', { class: 'right' }, h('strong', {}, x.ent), h('small', { class: 'muted block' }, x.total ? pctTxt(x.pct) : 'sin envíos'))),
        h('div', { class: 'kpis', style: 'margin-top:8px' }, kpi('Entregados', x.ent, `${x.dias} día(s)`, 'ok'), kpi('Fallidos', x.fal, 'o incompletos', x.fal ? 'err' : ''),
          kpi('Éxito', pctTxt(x.pct), x.dias ? `${num(x.prom_dia, 1)} por día` : '', x.pct != null && x.pct < 90 ? 'warn' : ''), kpi('Puntos', j ? num(j.score, 1) : '—', j ? `${j.entregados} ent. · ${pctTxt(j.pct)}` : '')),
        serieBarras(r.serie)); })
      : empty('📦', 'No hay entregas registradas. Toca "↻ Shipday" para traerlas.'),
    isPatron() && h('button', { class: 'btn block', onclick: () => actualizar(d.mes[0] < addDiasIso(f, -30) ? addDiasIso(f, -30) : d.mes[0]) }, 'Recalcular el mes desde Shipday'),
    h('p', { class: 'muted tiny' }, 'Se guarda solo todos los días a las 23:00 y se vuelve a cerrar en la mañana. Las recolecciones no cuentan.'));
}
const addDiasIso = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ═════════ Emergencias (admins y patrón) ═════════
async function emergenciasView(q = '') {
  state.tab = modoPatron() ? 'pmas' : 'mas';
  const body = h('div', {}, loading());
  screen('Emergencias', body, { back: () => go(state.tab) });
  let l;
  try { l = (await cached('emergencias', {}, live(() => emergenciasView(q)))).data; } catch (e) { return fill(body, errorBox(e)); }
  const lista = h('div', {});
  const pintar = () => {
    const t = q.toLowerCase();
    const sel = l.filter(x => !t || x.nombre.toLowerCase().includes(t) || String(x.no_empleado) === t);
    fill(lista, sel.map(x => { const cs = x.contactos.filter(c => c.nombre);
      return h('div', { class: 'card' },
        h('div', { class: 'row between' }, h('span', {}, h('strong', {}, x.nombre), h('small', { class: 'muted block' }, `No. ${x.no_empleado}${x.puesto ? ' · ' + x.puesto : ''}`)),
          x.telefono && h('a', { class: 'btn sm nw', href: 'tel:' + x.telefono }, '📞 ' + telFmt(x.telefono))),
        cs.length ? cs.map(c => h('div', { class: 'contacto' }, h('div', {}, h('strong', {}, c.nombre), h('small', { class: 'muted' }, ' · ' + c.parentesco)),
          h('div', { class: 'row gap8 wrap' }, h('a', { class: 'btn sm primary nw', href: 'tel:' + c.telefono }, '📞 ' + telFmt(c.telefono)), h('a', { class: 'btn sm nw', href: waUrl(c.telefono), target: '_blank', rel: 'noopener' }, 'WhatsApp'))))
          : h('p', { class: 'small late' }, 'Sin contactos de emergencia registrados.'),
        x.domicilio.texto ? h('p', { class: 'small muted', style: 'margin-top:6px' }, '🏠 ', x.domicilio.texto, ' ', x.domicilio.lat != null && h('a', { href: mapsQ(x.domicilio.lat, x.domicilio.lng), target: '_blank', rel: 'noopener' }, 'mapa'))
          : h('p', { class: 'tiny late' }, 'Sin domicilio.')); }));
  };
  const faltan = l.filter(x => x.contactos.filter(c => c.nombre).length < 2).length;
  fill(body,
    h('input', { class: 'input', type: 'search', placeholder: 'Buscar empleado…', value: q, oninput: e => { q = e.target.value; pintar(); } }),
    faltan > 0 && h('div', { class: 'banner warn small' }, `${faltan} empleado(s) sin sus 2 contactos de emergencia. Les aparece el aviso en su Inicio.`),
    lista);
  pintar();
}

// ═════════ Arranque ═════════
function start() {
  if (!session.token || !session.user) return login();
  if (!DEMO && !state.yo) { state.yo = true; api('yo').then(u => { if (u && (u.rol !== session.user.rol || u.repartidor !== session.user.repartidor)) { session.set(session.token, u); start(); } }).catch(() => {}); }
  state.tab = modoPatron() ? 'panel' : 'inicio';
  go(state.tab);
  setTimeout(() => {
    const per = periodoDe(new Date());
    prefetch(modoPatron()
      ? [['asistenciaGeneral', { periodo: per }], ['personal'], ['solicitudesAdmin', { estatus: 'pendiente' }], ['rutasAdmin', { fecha: isoHoy() }], ['bandeja']]
      : [['asistencia', { periodo: per }], ['recibos'], ['pagos'], ['solicitudes'], ['perfil'], ['bandeja'], ['adeudos']].concat(esRepartidor() ? [['miRuta']] : []));
  }, 1500);
  refreshPush((n, data) => {
    toast(`🔔 ${n.title || ''}${n.body ? ' — ' + n.body : ''}`, 'info', 6000);
    setBadge(state.noLeidos + 1);
    if (['inicio', 'panel'].includes(state.tab)) go(state.tab);
  });
  if (!modoPatron()) return;
  api('bandeja').then(l => setBadge(l.filter(n => !n.leido).length)).catch(() => {});
}

if ('serviceWorker' in navigator && !DEMO) navigator.serviceWorker.register('./sw.js', { scope: './' });
start();

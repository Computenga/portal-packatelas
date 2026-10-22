// Llamadas a Apps Script. Con ?demo en la URL usa datos simulados (para ver la app sin backend).
import { CONFIG } from './config.js';

export const DEMO = new URLSearchParams(location.search).has('demo');
const K = DEMO ? 'ppd_' : 'pp_';

export const session = {
  get token() { return localStorage.getItem(K + 'token'); },
  get user() { try { return JSON.parse(localStorage.getItem(K + 'user')); } catch { return null; } },
  set(token, user) { localStorage.setItem(K + 'token', token); localStorage.setItem(K + 'user', JSON.stringify(user)); },
  clear() { localStorage.removeItem(K + 'token'); localStorage.removeItem(K + 'user'); limpiarCache(); },
  get modo() { return localStorage.getItem(K + 'modo') || 'patron'; },
  set modo(v) { localStorage.setItem(K + 'modo', v); },
  get lastRfc() { return localStorage.getItem(K + 'rfc') || ''; },
  set lastRfc(v) { localStorage.setItem(K + 'rfc', v); },
};

export class NetworkError extends Error {}

let mock = null;
export async function api(action, data = {}) {
  if (DEMO) {
    mock = mock || await import('./mock.js');
    await new Promise(r => setTimeout(r, 180));
    try { return mock.handle(action, data, session.token); } catch (e) { throw new Error(e.message); }
  }
  if (CONFIG.API_URL.startsWith('PENDIENTE')) throw new Error('Falta configurar la URL de Apps Script en js/config.js (o abre la app con ?demo para verla con datos de ejemplo)');
  let res;
  try {
    res = await fetch(CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, token: session.token, ...data }) });
  } catch { throw new NetworkError('Sin conexión'); }
  if (!res.ok) throw new NetworkError('Servidor no disponible (' + res.status + ')');
  const j = await res.json();
  if (!j.ok) {
    if (/Sesión (requerida|inválida|expirada)|Usuario inactivo/.test(j.error)) { session.clear(); setTimeout(() => location.reload(), 1500); }
    throw new Error(j.error);
  }
  if (!LECTURAS.has(action)) limpiarCache(); // algo cambió: lo guardado ya no es confiable
  return j.data;
}

// ── Caché "muestra primero, actualiza después" ──
// Al entrar a una sección se pinta al instante lo último que se cargó y en segundo plano se pide lo nuevo;
// si cambió, la sección se vuelve a pintar sola. Cualquier acción que modifica datos borra la caché.
const LECTURAS = new Set(['inicio', 'perfil', 'asistencia', 'recibos', 'pagos', 'adeudos', 'solicitudes', 'bandeja', 'documentos', 'misDocumentos',
  'bienvenida', 'apps', 'miRuta', 'yo', 'recibo', 'reciboPdf', 'documento', 'archivo', 'estadoRfc', 'altaEstado',
  'panel', 'personal', 'asistenciaGeneral', 'asistenciaDe', 'prenomina', 'recibosAdmin', 'pagosAdmin', 'adeudosAdmin', 'solicitudesAdmin',
  'avisosEnviados', 'bienvenidaDe', 'appsAdmin', 'altasAdmin', 'docsDeEmpleado', 'rutasAdmin', 'rutasConfig', 'tomtomRutas', 'shipdayMuestra', 'desempeno', 'historialEntregas', 'emergencias', 'gpsPrueba']);
const FRESCO_MS = 20000;
const mem = new Map(); // key → { data, t }
const ckey = (action, data) => K + 'c_' + action + JSON.stringify(data);
function limpiarCache() {
  mem.clear();
  try { Object.keys(localStorage).filter(k => k.startsWith(K + 'c_')).forEach(k => localStorage.removeItem(k)); } catch {}
}
function guardar(key, data) {
  mem.set(key, { data, t: Date.now() });
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}
function leer(key) {
  const m = mem.get(key);
  if (m) return m;
  try { const s = localStorage.getItem(key); if (s) return { data: JSON.parse(s), t: 0 }; } catch {}
  return null;
}

/**
 * Lectura con caché. Si hay copia guardada la devuelve de inmediato y, si no es reciente, pide la nueva en segundo plano;
 * cuando llega distinta llama a onUpdate. Sin copia, espera al servidor. offline = el teléfono no tiene señal.
 */
export async function cached(action, data = {}, { onUpdate } = {}) {
  const key = ckey(action, data);
  const c = leer(key);
  if (c) {
    if (Date.now() - c.t > FRESCO_MS) {
      const antes = JSON.stringify(c.data);
      api(action, data).then(r => { guardar(key, r); if (onUpdate && JSON.stringify(r) !== antes) onUpdate(r); }).catch(() => {});
    }
    return { data: c.data, offline: !navigator.onLine };
  }
  const r = await api(action, data);
  guardar(key, r);
  return { data: r, offline: false };
}

/** Precarga en segundo plano las secciones que probablemente se abran después (una a la vez). */
export async function prefetch(list) {
  if (DEMO) return;
  for (const [action, data = {}] of list) {
    const c = leer(ckey(action, data));
    if (c && Date.now() - c.t < 60000) continue;
    try { guardar(ckey(action, data), await api(action, data)); } catch (e) { if (e instanceof NetworkError) return; }
  }
}

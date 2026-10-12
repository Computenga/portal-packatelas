// Llamadas a Apps Script. Con ?demo en la URL usa datos simulados (para ver la app sin backend).
import { CONFIG } from './config.js';

export const DEMO = new URLSearchParams(location.search).has('demo');
const K = DEMO ? 'ppd_' : 'pp_';

export const session = {
  get token() { return localStorage.getItem(K + 'token'); },
  get user() { try { return JSON.parse(localStorage.getItem(K + 'user')); } catch { return null; } },
  set(token, user) { localStorage.setItem(K + 'token', token); localStorage.setItem(K + 'user', JSON.stringify(user)); },
  clear() { localStorage.removeItem(K + 'token'); localStorage.removeItem(K + 'user'); },
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
  return j.data;
}

/** Guarda la última respuesta para mostrarla sin señal. */
export async function cached(action, data = {}) {
  const key = K + 'c_' + action + JSON.stringify(data);
  try {
    const r = await api(action, data);
    try { localStorage.setItem(key, JSON.stringify(r)); } catch {}
    return { data: r, offline: false };
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    const c = localStorage.getItem(key);
    if (!c) throw e;
    return { data: JSON.parse(c), offline: true };
  }
}

// Fotos/archivos y notificaciones push (Firebase Cloud Messaging, mismo proyecto que la flotilla).
import { CONFIG } from './config.js';
import { api, DEMO } from './api.js';

const MAX_SIDE = 1600, QUALITY = 0.8;

export function pickFile(accept = 'image/*,application/pdf') {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

/** Imagen → JPEG reducido; PDF u otros → tal cual. */
export async function readFile(file) {
  if (!file.type.startsWith('image/')) return { base64: await toBase64(file), mime: file.type || 'application/octet-stream', name: file.name, dataUrl: null };
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadImg(file));
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', QUALITY);
  return { base64: dataUrl.split(',')[1], mime: 'image/jpeg', name: (file.name || 'foto').replace(/\.\w+$/, '') + '.jpg', dataUrl };
}
function loadImg(file) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
function toBase64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); }); }

/** Abre/descarga un archivo que llegó en base64. */
export function openBase64({ base64, mime, nombre }) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = nombre || 'archivo'; a.target = '_blank'; a.rel = 'noopener';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ───────── Push ─────────
let messagingP = null;
async function messaging() {
  if (!messagingP) {
    messagingP = (async () => {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      const m = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
      return { m, msg: m.getMessaging(initializeApp(CONFIG.firebase)) };
    })();
  }
  return messagingP;
}

export function pushState() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'no_soportado';
  return Notification.permission;
}
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permiso de notificaciones denegado');
  if (DEMO) return 'demo';
  const reg = await navigator.serviceWorker.ready;
  const { m, msg } = await messaging();
  const token = await m.getToken(msg, { vapidKey: CONFIG.vapidKey, serviceWorkerRegistration: reg });
  if (!token) throw new Error('No se obtuvo token de notificaciones');
  const plataforma = /android/i.test(navigator.userAgent) ? 'android' : isIOS() ? 'ios' : 'otro';
  await api('registerDevice', { fcm_token: token, plataforma });
  localStorage.setItem('pp_push_token', token);
  return token;
}

export async function refreshPush(onForeground) {
  if (DEMO || pushState() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const { m, msg } = await messaging();
    const token = await m.getToken(msg, { vapidKey: CONFIG.vapidKey, serviceWorkerRegistration: reg });
    if (token && token !== localStorage.getItem('pp_push_token')) {
      await api('registerDevice', { fcm_token: token });
      localStorage.setItem('pp_push_token', token);
    }
    m.onMessage(msg, p => onForeground && onForeground(p.notification || {}, p.data || {}));
  } catch (e) { console.warn('push', e); }
}
